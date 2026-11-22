import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { getLocalDateString, parseUTCDateAsLocal } from '../lib/dates';
import {
  BIRTHDAY_TAG,
  BIRTHDAY_FREQUENCY,
  birthdayAnchor,
  birthdayTaskText,
  reminderDateFields,
} from '../lib/people';

// Remembers which account has the People screen, so its button shows at once
// on the next visit instead of after the check below. Holds a user id.
const ACCESS_KEY = 'peopleAccess';

const REMINDER_COLUMNS =
  'id,text,actual_date,recurring,repeat_frequency,completed,completed_at,person_id,person_tag';

// Owns the People screen's data: who may see it, the people, their dated
// updates, and the tasks linked to them (reminders are ordinary todos rows
// with person_id set, so they show in the week like any task).
//
// Access is a row in people_access (supabase/people.sql). The database
// refuses everyone else, so `hasAccess` only decides whether to show the UI.
export function usePeople(session) {
  const userId = session?.user?.id ?? null;
  const [accessFor, setAccessFor] = useState(() => localStorage.getItem(ACCESS_KEY));
  const hasAccess = !!userId && accessFor === userId;

  const [people, setPeople] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from('people_access')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error: accessError }) => {
        if (!alive) return;
        if (data) {
          localStorage.setItem(ACCESS_KEY, userId);
          setAccessFor(userId);
        } else if (!accessError || accessError.code) {
          // No row, or the database answered with an error (table not there
          // yet): no access. A dropped connection keeps the remembered answer.
          localStorage.removeItem(ACCESS_KEY);
          setAccessFor(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    if (!userId) return;
    const seq = ++loadSeq.current;
    const [peopleRes, updatesRes, remindersRes] = await Promise.all([
      supabase.from('people').select('*').eq('user_id', userId).order('name'),
      supabase
        .from('person_updates')
        .select('*')
        .eq('user_id', userId)
        .order('happened_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('todos')
        .select(REMINDER_COLUMNS)
        .eq('user_id', userId)
        .not('person_id', 'is', null)
        .is('parent_task_id', null),
    ]);
    const failed = peopleRes.error || updatesRes.error || remindersRes.error;
    if (failed) {
      logError('Error loading people:', failed);
      if (seq === loadSeq.current) setError(failed.message || 'Could not load People');
      return;
    }
    const repeating = remindersRes.data.filter((r) => r.recurring).map((r) => r.id);
    let completionRows = [];
    if (repeating.length > 0) {
      const { data, error: completionsError } = await supabase
        .from('recurring_completions')
        .select('todo_id,completion_date,completed_at,skipped')
        .eq('user_id', userId)
        .in('todo_id', repeating);
      if (completionsError) {
        logError('Error loading reminder completions:', completionsError);
        if (seq === loadSeq.current) setError(completionsError.message);
        return;
      }
      completionRows = data || [];
    }
    if (seq !== loadSeq.current) return;
    setPeople(peopleRes.data);
    setUpdates(updatesRes.data);
    setReminders(remindersRes.data);
    setCompletions(completionRows);
    setError(null);
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (hasAccess) load();
  }, [hasAccess, load]);

  // Any failed write: say so, then reload so the screen shows what is saved
  const fail = (message, err) => {
    logError(message, err);
    setError(message);
    load();
    return null;
  };

  // Keep the person's yearly birthday task in step with their name and
  // birthday: made when a birthday is entered, moved or renamed when either
  // changes, removed when the birthday is cleared.
  const syncBirthdayTask = async (person, current) => {
    const existing = current.find(
      (r) => r.person_id === person.id && r.person_tag === BIRTHDAY_TAG
    );
    const hasBirthday = !!person.birthday_month && !!person.birthday_day;
    if (!hasBirthday) {
      if (!existing) return;
      const { error: delError } = await supabase
        .from('todos')
        .delete()
        .eq('id', existing.id)
        .eq('user_id', userId);
      if (delError) throw delError;
      setReminders((prev) => prev.filter((r) => r.id !== existing.id));
      return;
    }
    const text = birthdayTaskText(person.name);
    if (existing) {
      const start = parseUTCDateAsLocal(existing.actual_date);
      const sameDay =
        start.getMonth() + 1 === person.birthday_month && start.getDate() === person.birthday_day;
      if (sameDay && existing.text === text) return;
      const patch = { text };
      if (!sameDay) {
        Object.assign(
          patch,
          reminderDateFields(birthdayAnchor(person.birthday_month, person.birthday_day))
        );
      }
      const { data, error: upError } = await supabase
        .from('todos')
        .update(patch)
        .eq('id', existing.id)
        .eq('user_id', userId)
        .select(REMINDER_COLUMNS)
        .single();
      if (upError) throw upError;
      setReminders((prev) => prev.map((r) => (r.id === existing.id ? data : r)));
      return;
    }
    const { data, error: insError } = await supabase
      .from('todos')
      .insert([
        {
          user_id: userId,
          text,
          ...reminderDateFields(birthdayAnchor(person.birthday_month, person.birthday_day)),
          completed: false,
          recurring: true,
          repeat_frequency: BIRTHDAY_FREQUENCY,
          person_id: person.id,
          person_tag: BIRTHDAY_TAG,
        },
      ])
      .select(REMINDER_COLUMNS)
      .single();
    if (insError) throw insError;
    setReminders((prev) => [...prev, data]);
  };

  const addPerson = async (name, kind = 'personal') => {
    const { data, error: insError } = await supabase
      .from('people')
      .insert([{ user_id: userId, name: name.trim(), kind }])
      .select()
      .single();
    if (insError) return fail("Couldn't add that person", insError);
    setPeople((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  };

  // Save changed fields of a person. Shows at once; a failed save reloads.
  const savePerson = async (id, patch) => {
    const before = people.find((p) => p.id === id);
    if (!before) return;
    const after = { ...before, ...patch };
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? after : p)).sort((a, b) => a.name.localeCompare(b.name))
    );
    const { error: upError } = await supabase
      .from('people')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId);
    if (upError) return fail("Couldn't save that change", upError);
    if ('name' in patch || 'birthday_month' in patch || 'birthday_day' in patch) {
      try {
        await syncBirthdayTask(after, reminders);
      } catch (e) {
        fail("Saved, but couldn't update the birthday reminder", e);
      }
    }
  };

  // Removes the person, their updates, their birthday task and every reminder
  // not yet done. Finished one-time tasks stay in the week, unlinked.
  const deletePerson = async (id) => {
    const open = reminders.filter((r) => r.person_id === id && (r.recurring || !r.completed));
    if (open.length > 0) {
      const { error: delError } = await supabase
        .from('todos')
        .delete()
        .in(
          'id',
          open.map((r) => r.id)
        )
        .eq('user_id', userId);
      if (delError) return fail("Couldn't delete their reminders", delError);
    }
    const { error: personError } = await supabase
      .from('people')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (personError) return fail("Couldn't delete that person", personError);
    setPeople((prev) => prev.filter((p) => p.id !== id));
    setUpdates((prev) => prev.filter((u) => u.person_id !== id));
    setReminders((prev) => prev.filter((r) => r.person_id !== id));
    return true;
  };

  const addUpdate = async (personId, text, happenedOn) => {
    const { data, error: insError } = await supabase
      .from('person_updates')
      .insert([
        {
          user_id: userId,
          person_id: personId,
          text: text.trim(),
          happened_on: happenedOn || getLocalDateString(new Date()),
        },
      ])
      .select()
      .single();
    if (insError) return fail("Couldn't save that update", insError);
    setUpdates((prev) => [data, ...prev].sort((a, b) => (a.happened_on < b.happened_on ? 1 : -1)));
    return data;
  };

  const deleteUpdate = async (id) => {
    setUpdates((prev) => prev.filter((u) => u.id !== id));
    const { error: delError } = await supabase
      .from('person_updates')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (delError) fail("Couldn't delete that update", delError);
  };

  // A reminder is a task on that date (repeating when a frequency is given)
  const addReminder = async (personId, text, dateStr, frequency) => {
    const { data, error: insError } = await supabase
      .from('todos')
      .insert([
        {
          user_id: userId,
          text: text.trim(),
          ...reminderDateFields(parseUTCDateAsLocal(dateStr)),
          completed: false,
          recurring: !!frequency,
          repeat_frequency: frequency || null,
          person_id: personId,
        },
      ])
      .select(REMINDER_COLUMNS)
      .single();
    if (insError) return fail("Couldn't set that reminder", insError);
    setReminders((prev) => [...prev, data]);
    return data;
  };

  const deleteReminder = async (id) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    const { error: delError } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (delError) fail("Couldn't delete that reminder", delError);
  };

  // person id -> name, for the chip on a linked task
  const personNames = useMemo(() => {
    const map = {};
    people.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [people]);

  return {
    hasAccess,
    loaded,
    error,
    dismissError: () => setError(null),
    reload: load,
    people,
    updates,
    reminders,
    completions,
    personNames,
    addPerson,
    savePerson,
    deletePerson,
    addUpdate,
    deleteUpdate,
    addReminder,
    deleteReminder,
  };
}
