import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/log';
import { geocodePlace, fetchCurrentWeather } from '../lib/weather';
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
  // Parent -> child links between profiles: { id, parent_id, child_id }
  const [childLinks, setChildLinks] = useState([]);
  // person id -> current weather where they live ({ tempF, sky, night, label })
  const [weather, setWeather] = useState({});
  const [weatherTick, setWeatherTick] = useState(0);
  const weatherAt = useRef(0);
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
    // Kids links. A database without the table yet (supabase/people.sql,
    // section 6) just has none, so the rest of the screen still loads.
    const linksRes = await supabase
      .from('person_children')
      .select('id,parent_id,child_id')
      .eq('user_id', userId);
    if (linksRes.error) logError('Error loading kids links:', linksRes.error);
    if (seq !== loadSeq.current) return;
    setChildLinks(linksRes.data || []);
    setPeople(peopleRes.data);
    setUpdates(updatesRes.data);
    setReminders(remindersRes.data);
    setCompletions(completionRows);
    setError(null);
    setLoaded(true);
    // Opening People again after a while brings fresh weather
    if (Date.now() - weatherAt.current > 15 * 60 * 1000) setWeatherTick((t) => t + 1);
  }, [userId]);

  // Current weather for everyone with a matched "Currently lives" place, in
  // one request. Runs when someone's place changes and on the refresh above.
  const placesKey = people
    .filter((p) => p.lives_lat != null && p.lives_lon != null)
    .map((p) => `${p.id}:${p.lives_lat},${p.lives_lon}`)
    .join('|');
  useEffect(() => {
    if (!placesKey) return;
    let alive = true;
    const places = placesKey.split('|').map((entry) => {
      const [id, coords] = entry.split(':');
      const [lat, lon] = coords.split(',');
      return { id, lat, lon };
    });
    fetchCurrentWeather(places)
      .then((list) => {
        if (!alive) return;
        const map = {};
        places.forEach((place, i) => {
          if (list[i]) map[place.id] = list[i];
        });
        weatherAt.current = Date.now();
        setWeather(map);
      })
      .catch((e) => logError('Error loading weather:', e));
    return () => {
      alive = false;
    };
  }, [placesKey, weatherTick]);

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
    return true;
  };

  // Spouses live in the same place: put one profile's place on another
  const PLACE_FIELDS = ['lives_in', 'lives_lat', 'lives_lon', 'lives_label'];
  const copyPlace = async (from, toId) => {
    const patch = Object.fromEntries(PLACE_FIELDS.map((f) => [f, from[f] ?? null]));
    setPeople((prev) => prev.map((p) => (p.id === toId ? { ...p, ...patch } : p)));
    const { error: upError } = await supabase
      .from('people')
      .update(patch)
      .eq('id', toId)
      .eq('user_id', userId);
    if (upError) fail("Couldn't copy where they live to their spouse", upError);
  };

  // Kids marked under 18 live with their parents: put a place on every such
  // child of the given parents
  const copyPlaceToMinors = async (from, parentIds) => {
    const kidIds = [
      ...new Set(childLinks.filter((l) => parentIds.includes(l.parent_id)).map((l) => l.child_id)),
    ].filter((kidId) => people.find((p) => p.id === kidId)?.is_minor);
    for (const kidId of kidIds) await copyPlace(from, kidId);
  };

  // Mark a child as under 18 (or not). Marked, they take their parents' place
  // now and follow it from then on.
  const setMinor = async (childId, on) => {
    const ok = await savePerson(childId, { is_minor: on });
    if (!ok || !on) return ok;
    const parent = childLinks
      .filter((l) => l.child_id === childId)
      .map((l) => people.find((p) => p.id === l.parent_id))
      .find((p) => p?.lives_in);
    if (parent) await copyPlace(parent, childId);
    return ok;
  };

  // Save where someone lives, looking the place up so its weather can show.
  // A place that can't be matched is still saved, just without weather.
  const saveLivesIn = async (id, text) => {
    let place = null;
    if (text) {
      try {
        place = await geocodePlace(text);
      } catch (e) {
        logError('Error looking up place:', e);
      }
    }
    const patch = {
      lives_in: text || null,
      lives_lat: place?.lat ?? null,
      lives_lon: place?.lon ?? null,
      lives_label: place?.label ?? null,
    };
    const spouseId = people.find((p) => p.id === id)?.spouse_id;
    const ok = await savePerson(id, patch);
    // a spouse and any kids under 18 move with them (clearing the place
    // clears it for all of them)
    if (ok && spouseId) await copyPlace(patch, spouseId);
    if (ok) await copyPlaceToMinors(patch, [id, spouseId].filter(Boolean));
    return ok;
  };

  // Link a profile as this person's child. When the person has a spouse the
  // child is linked to both of them (remove it from one if that is wrong).
  // `child` is a people row (it may have just been created).
  const addChild = async (parentId, child) => {
    const parent = people.find((p) => p.id === parentId);
    if (!parent || !child || child.id === parentId) return;
    const linked = (a, b) => childLinks.some((l) => l.parent_id === a && l.child_id === b);
    if (linked(child.id, parentId)) {
      setError(`${child.name} is already listed as a parent of ${parent.name}`);
      return;
    }
    const parents = [parentId];
    if (parent.spouse_id && parent.spouse_id !== child.id && !linked(child.id, parent.spouse_id)) {
      parents.push(parent.spouse_id);
    }
    const rows = parents
      .filter((id) => !linked(id, child.id))
      .map((id) => ({ user_id: userId, parent_id: id, child_id: child.id }));
    if (rows.length === 0) return true;
    const { data, error: insError } = await supabase
      .from('person_children')
      .insert(rows)
      .select('id,parent_id,child_id');
    if (insError) return fail("Couldn't save that link", insError);
    setChildLinks((prev) => [...prev, ...data]);
    // a child already marked under 18 takes the parent's place
    if (child.is_minor && parent.lives_in) await copyPlace(parent, child.id);
    return true;
  };

  // Unlink a child from this one parent (a link to the other parent stays)
  const removeChild = async (parentId, childId) => {
    setChildLinks((prev) =>
      prev.filter((l) => !(l.parent_id === parentId && l.child_id === childId))
    );
    const { error: delError } = await supabase
      .from('person_children')
      .delete()
      .eq('parent_id', parentId)
      .eq('child_id', childId)
      .eq('user_id', userId);
    if (delError) fail("Couldn't remove that link", delError);
  };

  // Link two people as spouses, or unlink with null. The link is kept on both
  // profiles: each one's earlier spouse, if any, is unlinked first. `spouse` is
  // a people row (it may have just been created) or null.
  const setSpouse = async (personId, spouse) => {
    const me = people.find((p) => p.id === personId);
    if (!me || (spouse && spouse.id === personId)) return;
    const next = {}; // person id -> new spouse_id
    next[personId] = spouse ? spouse.id : null;
    if (me.spouse_id && me.spouse_id !== spouse?.id) next[me.spouse_id] = null;
    if (spouse) {
      if (spouse.spouse_id && spouse.spouse_id !== personId) next[spouse.spouse_id] = null;
      next[spouse.id] = personId;
    }
    setPeople((prev) =>
      prev.map((p) =>
        p.id in next
          ? { ...p, spouse_id: next[p.id], ...(p.id === personId ? { spouse: null } : {}) }
          : p
      )
    );
    // Unlinks first, so nobody is ever saved as the spouse of two people
    const ids = Object.keys(next).sort(
      (a, b) => (next[a] === null ? 0 : 1) - (next[b] === null ? 0 : 1)
    );
    for (const id of ids) {
      const { error: upError } = await supabase
        .from('people')
        // the old free-text spouse on this profile is replaced by the link
        .update(id === personId ? { spouse_id: next[id], spouse: null } : { spouse_id: next[id] })
        .eq('id', id)
        .eq('user_id', userId);
      if (upError) return fail("Couldn't save the spouse link", upError);
    }
    // Newly linked spouses share where they live: this profile's place if it
    // has one, else the spouse's
    if (spouse) {
      if (me.lives_in) {
        await copyPlace(me, spouse.id);
        await copyPlaceToMinors(me, [spouse.id]);
      } else if (spouse.lives_in) {
        await copyPlace(spouse, personId);
        await copyPlaceToMinors(spouse, [personId]);
      }
    }
    return true;
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
    setPeople((prev) =>
      prev
        .filter((p) => p.id !== id)
        .map((p) => (p.spouse_id === id ? { ...p, spouse_id: null } : p))
    );
    setUpdates((prev) => prev.filter((u) => u.person_id !== id));
    setChildLinks((prev) => prev.filter((l) => l.parent_id !== id && l.child_id !== id));
    setReminders((prev) => prev.filter((r) => r.person_id !== id));
    return true;
  };

  // `alsoIds`: family profiles the same update should also show on
  const addUpdate = async (personId, text, happenedOn, alsoIds = []) => {
    const { data, error: insError } = await supabase
      .from('person_updates')
      .insert([
        {
          user_id: userId,
          person_id: personId,
          text: text.trim(),
          happened_on: happenedOn || getLocalDateString(new Date()),
          // only sent when used, so a plain update saves on a database that
          // does not have the column yet (supabase/people.sql, section 7)
          ...(alsoIds.length > 0 ? { also_person_ids: alsoIds } : {}),
        },
      ])
      .select()
      .single();
    if (insError) return fail("Couldn't save that update", insError);
    setUpdates((prev) => [data, ...prev].sort((a, b) => (a.happened_on < b.happened_on ? 1 : -1)));
    return data;
  };

  // Change an update's text and/or date. Shows at once; a failed save reloads.
  const editUpdate = async (id, text, happenedOn) => {
    const patch = { text: text.trim(), happened_on: happenedOn };
    setUpdates((prev) =>
      prev
        .map((u) => (u.id === id ? { ...u, ...patch } : u))
        .sort((a, b) => (a.happened_on < b.happened_on ? 1 : -1))
    );
    const { error: upError } = await supabase
      .from('person_updates')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId);
    if (upError) return fail("Couldn't save that update", upError);
    return true;
  };

  // Take a linked update off one family profile; it stays everywhere else
  const unlinkUpdate = async (id, personId) => {
    const row = updates.find((u) => u.id === id);
    if (!row) return;
    const also = (row.also_person_ids || []).filter((x) => x !== personId);
    setUpdates((prev) => prev.map((u) => (u.id === id ? { ...u, also_person_ids: also } : u)));
    const { error: upError } = await supabase
      .from('person_updates')
      .update({ also_person_ids: also })
      .eq('id', id)
      .eq('user_id', userId);
    if (upError) fail("Couldn't remove that update", upError);
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
    childLinks,
    weather,
    personNames,
    addPerson,
    setSpouse,
    addChild,
    removeChild,
    editUpdate,
    unlinkUpdate,
    savePerson,
    saveLivesIn,
    setMinor,
    deletePerson,
    addUpdate,
    deleteUpdate,
    addReminder,
    deleteReminder,
  };
}
