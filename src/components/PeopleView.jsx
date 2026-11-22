import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Search, Trash2, Repeat, Cake, X } from 'lucide-react';
import { getLocalDateString } from '../lib/dates';
import { describeCustomFrequency } from '../lib/frequency';
import { MAX_TASK_LENGTH } from '../lib/constants';
import {
  BIRTHDAY_TAG,
  MONTH_NAMES,
  REMINDER_REPEATS,
  TOUCH_CHOICES,
  MAX_PERSON_NAME,
  MAX_PERSON_FIELD,
  MAX_PERSON_LONG_FIELD,
  MAX_PERSON_NOTES,
  MAX_UPDATE_LENGTH,
  daysInBirthdayMonth,
  formatBirthday,
  nextBirthday,
  turningAge,
  nextDue,
  lastContact,
  isOverdue,
  formatAgo,
  formatDay,
} from '../lib/people';

const KINDS = [
  { value: 'personal', label: 'Personal' },
  { value: 'work', label: 'Work' },
  { value: 'both', label: 'Both' },
];

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-500 focus:outline-none';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1';
const cardCls = 'rounded-2xl bg-white border border-gray-200 shadow-sm p-4';

// A text box that saves when you leave it (or press Enter on one line).
// Its text starts from the saved value; the person's page is rebuilt per
// person (keyed), so it never shows another person's text.
function Field({ label, value, onSave, maxLength, multiline, placeholder }) {
  const [text, setText] = useState(value ?? '');
  const commit = () => {
    const next = text.trim();
    if (next !== (value ?? '')) onSave(next === '' ? null : next);
  };
  const shared = {
    value: text,
    maxLength,
    placeholder,
    onChange: (e) => setText(e.target.value),
    onBlur: commit,
    className: inputCls,
  };
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {multiline ? (
        <textarea rows={3} {...shared} />
      ) : (
        <input
          type="text"
          {...shared}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur();
          }}
        />
      )}
    </label>
  );
}

// Spouse is always another profile: shown as a link to it, or a box that
// finds an existing person by name or creates a new one and links both ways.
function SpouseField({ person, people, actions, onOpenPerson }) {
  // Text typed before spouses were links is offered as the name to link
  const [text, setText] = useState(person.spouse ?? '');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const spouse = people.find((p) => p.id === person.spouse_id) || null;

  if (spouse) {
    return (
      <div>
        <span className={labelCls}>Spouse / partner</span>
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
          <button
            type="button"
            onClick={() => onOpenPerson(spouse.id)}
            className="min-w-0 flex-1 truncate text-left text-sm font-medium text-blue-700 hover:underline"
            title={`Open ${spouse.name}`}
          >
            {spouse.name}
          </button>
          <button
            type="button"
            onClick={() => actions.setSpouse(person.id, null)}
            className="text-gray-400 hover:text-red-600"
            aria-label={`Unlink ${spouse.name} as spouse`}
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  const q = text.trim().toLowerCase();
  const matches = q
    ? people.filter((p) => p.id !== person.id && p.name.toLowerCase().includes(q)).slice(0, 6)
    : [];
  const exact = matches.some((p) => p.name.toLowerCase() === q);
  const link = async (other) => {
    if (busy) return;
    setBusy(true);
    await actions.setSpouse(person.id, other);
    setBusy(false);
  };
  const create = async () => {
    if (busy || !q) return;
    setBusy(true);
    const made = await actions.addPerson(text, person.kind);
    if (made) await actions.setSpouse(person.id, made);
    setBusy(false);
  };

  return (
    <div>
      <span className={labelCls}>Spouse / partner</span>
      <input
        type="text"
        aria-label="Spouse or partner"
        className={inputCls}
        placeholder="Type a name to link or create"
        maxLength={MAX_PERSON_NAME}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        // late enough that a tap on a choice below still lands
        onBlur={() => setTimeout(() => setFocused(false), 200)}
      />
      {q && (focused || person.spouse) && (
        <ul className="mt-1 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => link(p)}
                className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                Link to <span className="font-medium">{p.name}</span>
              </button>
            </li>
          ))}
          {!exact && (
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={create}
                className="flex w-full items-center gap-1 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                <Plus size={14} /> Create <span className="font-medium">{text.trim()}</span> and
                link
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function BirthdayField({ person, onSave }) {
  const [month, setMonth] = useState(person.birthday_month ?? '');
  const [dayOf, setDayOf] = useState(person.birthday_day ?? '');
  const [year, setYear] = useState(person.birthday_year ?? '');

  // Saved once there is both a month and a day, or once both are cleared
  const commit = (m, d, y) => {
    const yearNum = Number(y);
    const validYear = Number.isInteger(yearNum) && yearNum >= 1900 && yearNum <= 2100;
    if (m && d) {
      const day = Math.min(Number(d), daysInBirthdayMonth(Number(m)));
      if (day !== Number(d)) setDayOf(day); // e.g. the 31st in a 30-day month
      onSave({
        birthday_month: Number(m),
        birthday_day: day,
        birthday_year: validYear ? yearNum : null,
      });
    } else if (!m && !d && (person.birthday_month || person.birthday_day)) {
      onSave({ birthday_month: null, birthday_day: null, birthday_year: null });
    }
  };
  const next = nextBirthday(person);
  const age = turningAge(person);

  return (
    <div>
      <span className={labelCls}>Birthday</span>
      <div className="flex gap-2">
        <select
          aria-label="Birthday month"
          className={`${inputCls} flex-[2]`}
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            commit(e.target.value, dayOf, year);
          }}
        >
          <option value="">Month</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Birthday day"
          className={`${inputCls} flex-1`}
          value={dayOf}
          onChange={(e) => {
            setDayOf(e.target.value);
            commit(month, e.target.value, year);
          }}
        >
          <option value="">Day</option>
          {Array.from({ length: daysInBirthdayMonth(Number(month) || null) }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <input
          aria-label="Birthday year (optional)"
          className={`${inputCls} flex-1`}
          inputMode="numeric"
          maxLength={4}
          placeholder="Year"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
          onBlur={() => {
            if (String(year) !== String(person.birthday_year ?? '')) commit(month, dayOf, year);
          }}
        />
      </div>
      {next && (
        <p className="mt-1 text-xs text-gray-500">
          Next: {formatDay(getLocalDateString(next))}
          {age ? ` (turns ${age})` : ''}. A yearly reminder is on your list for that day.
        </p>
      )}
    </div>
  );
}

function PersonDetail({ person, data, actions, onBack, onOpenDate, onOpenPerson }) {
  const today = getLocalDateString(new Date());
  const [updateText, setUpdateText] = useState('');
  const [updateDate, setUpdateDate] = useState(today);
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState(today);
  const [reminderRepeat, setReminderRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const myUpdates = data.updates.filter((u) => u.person_id === person.id);
  const last = lastContact(person.id, data);

  // Open reminders with the next date each is due, soonest first
  const myReminders = useMemo(() => {
    return data.reminders
      .filter((r) => r.person_id === person.id)
      .map((r) => {
        const done = new Set(
          data.completions.filter((c) => c.todo_id === r.id).map((c) => c.completion_date)
        );
        return { row: r, due: nextDue(r, done) };
      })
      .filter((x) => x.due)
      .sort((a, b) => (a.due < b.due ? -1 : 1));
  }, [data.reminders, data.completions, person.id]);

  const save = (patch) => actions.savePerson(person.id, patch);

  const submitUpdate = async (e) => {
    e.preventDefault();
    if (!updateText.trim() || busy) return;
    setBusy(true);
    const saved = await actions.addUpdate(person.id, updateText, updateDate);
    setBusy(false);
    if (saved) {
      setUpdateText('');
      setUpdateDate(today);
    }
  };

  const submitReminder = async (e) => {
    e.preventDefault();
    if (!reminderText.trim() || !reminderDate || busy) return;
    setBusy(true);
    const saved = await actions.addReminder(person.id, reminderText, reminderDate, reminderRepeat);
    setBusy(false);
    if (saved) {
      setReminderText('');
      setReminderRepeat('');
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> All people
      </button>

      <div className={cardCls}>
        <div className="space-y-3">
          <Field
            label="Name"
            value={person.name}
            maxLength={MAX_PERSON_NAME}
            onSave={(v) => v && save({ name: v })}
          />
          <div>
            <span className={labelCls}>Type</span>
            <div className="flex gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  onClick={() => person.kind !== k.value && save({ kind: k.value })}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    person.kind === k.value
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <BirthdayField person={person} onSave={save} />
          <SpouseField
            person={person}
            people={actions.people}
            actions={actions}
            onOpenPerson={onOpenPerson}
          />
          <Field
            label="Kids"
            value={person.kids}
            maxLength={MAX_PERSON_LONG_FIELD}
            placeholder="Names, ages"
            onSave={(v) => save({ kids: v })}
          />
          <Field
            label="Employer"
            value={person.employer}
            maxLength={MAX_PERSON_FIELD}
            placeholder="Company, role"
            onSave={(v) => save({ employer: v })}
          />
          <Field
            label="From"
            value={person.from_place}
            maxLength={MAX_PERSON_FIELD}
            onSave={(v) => save({ from_place: v })}
          />
          <Field
            label="Sports teams"
            value={person.sports_teams}
            maxLength={MAX_PERSON_LONG_FIELD}
            onSave={(v) => save({ sports_teams: v })}
          />
          <Field
            label="Notes"
            value={person.notes}
            maxLength={MAX_PERSON_NOTES}
            multiline
            onSave={(v) => save({ notes: v })}
          />
          <label className="block">
            <span className={labelCls}>Keep in touch</span>
            <select
              className={inputCls}
              value={person.touch_months ?? ''}
              onChange={(e) =>
                save({ touch_months: e.target.value ? Number(e.target.value) : null })
              }
            >
              {TOUCH_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-500">
              Last contact: {formatAgo(last)}
              {isOverdue(person, last) ? ' · due to reach out' : ''}
            </span>
          </label>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Reminders</h3>
        <form onSubmit={submitReminder} className="space-y-2">
          <input
            type="text"
            aria-label="Reminder"
            className={inputCls}
            placeholder={`e.g. Call ${person.name.split(' ')[0]}`}
            maxLength={MAX_TASK_LENGTH}
            value={reminderText}
            onChange={(e) => setReminderText(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="Reminder date"
              className={`${inputCls} flex-1`}
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
            />
            <select
              aria-label="Repeat"
              className={`${inputCls} flex-1`}
              value={reminderRepeat}
              onChange={(e) => setReminderRepeat(e.target.value)}
            >
              {REMINDER_REPEATS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!reminderText.trim() || !reminderDate || busy}
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
          >
            Add to my to-do list
          </button>
        </form>
        {myReminders.length > 0 && (
          <ul className="mt-3 divide-y divide-gray-100">
            {myReminders.map(({ row, due }) => (
              <li key={row.id} className="flex items-center gap-2 py-2">
                <button
                  onClick={() => onOpenDate(due)}
                  className="min-w-0 flex-1 text-left"
                  title="Open that day in the to-do list"
                >
                  <div className="truncate text-sm text-gray-800">{row.text}</div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    {row.person_tag === BIRTHDAY_TAG ? <Cake size={12} /> : null}
                    {formatDay(due)}
                    {row.recurring && (
                      <>
                        <Repeat size={11} className="ml-1" />
                        {(describeCustomFrequency(row.repeat_frequency) || 'Repeats').replace(
                          'Repeats ',
                          ''
                        )}
                      </>
                    )}
                  </div>
                </button>
                {row.person_tag !== BIRTHDAY_TAG && (
                  <button
                    onClick={() => actions.deleteReminder(row.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    aria-label={`Delete reminder: ${row.text}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cardCls}>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Updates</h3>
        <form onSubmit={submitUpdate} className="space-y-2">
          <textarea
            rows={2}
            aria-label="New update"
            className={inputCls}
            placeholder="What's new with them?"
            maxLength={MAX_UPDATE_LENGTH}
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="Date of update"
              className={`${inputCls} flex-1`}
              value={updateDate}
              max={today}
              onChange={(e) => setUpdateDate(e.target.value)}
            />
            <button
              type="submit"
              disabled={!updateText.trim() || busy}
              className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
            >
              Save update
            </button>
          </div>
        </form>
        {myUpdates.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">No updates yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {myUpdates.map((u) => (
              <li key={u.id} className="flex items-start gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500">{formatDay(u.happened_on)}</div>
                  <div className="whitespace-pre-wrap break-words text-sm text-gray-800">
                    {u.text}
                  </div>
                </div>
                <button
                  onClick={() => actions.deleteUpdate(u.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600"
                  aria-label="Delete update"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-center">
        {confirmDelete ? (
          <div className="inline-flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-sm text-red-800">
              Delete {person.name}, their updates and their open reminders?
            </span>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (await actions.deletePerson(person.id)) onBack();
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700"
              >
                Keep
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-gray-400 hover:text-red-600"
          >
            Delete this person
          </button>
        )}
      </div>
    </div>
  );
}

// The People screen: a searchable list, and one person's page. `peopleData`
// is the usePeople hook; `onOpenDate(YYYY-MM-DD)` opens that day's to-do list.
export default function PeopleView({ peopleData, openPersonId, setOpenPersonId, onOpenDate }) {
  const { people, updates, reminders, completions, loaded, error, dismissError } = peopleData;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const data = useMemo(
    () => ({ updates, reminders, completions }),
    [updates, reminders, completions]
  );
  const person = people.find((p) => p.id === openPersonId) || null;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const spouseName = Object.fromEntries(people.map((p) => [p.id, p.name]));
    return people
      .filter((p) => kind === 'all' || p.kind === kind || p.kind === 'both')
      .filter(
        (p) =>
          !q ||
          [
            p.name,
            p.employer,
            spouseName[p.spouse_id],
            p.kids,
            p.from_place,
            p.sports_teams,
            p.notes,
          ].some((f) => f && f.toLowerCase().includes(q))
      )
      .map((p) => {
        const last = lastContact(p.id, data);
        return { p, last, overdue: isOverdue(p, last) };
      });
  }, [people, data, query, kind]);
  const overdue = rows.filter((r) => r.overdue);
  const rest = rows.filter((r) => !r.overdue);

  const add = async (e) => {
    e.preventDefault();
    if (!newName.trim() || adding) return;
    setAdding(true);
    const made = await peopleData.addPerson(newName, kind === 'work' ? 'work' : 'personal');
    setAdding(false);
    if (made) {
      setNewName('');
      setOpenPersonId(made.id);
    }
  };

  const row = ({ p, last, overdue: due }) => (
    <li key={p.id}>
      <button
        onClick={() => setOpenPersonId(p.id)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-900">{p.name}</div>
          <div className="truncate text-xs text-gray-500">
            {[p.employer, p.from_place, formatBirthday({ ...p, birthday_year: null })]
              .filter(Boolean)
              .join(' · ') || (p.kind === 'work' ? 'Work' : 'Personal')}
          </div>
        </div>
        <div
          className={`flex-shrink-0 text-xs ${due ? 'font-semibold text-red-600' : 'text-gray-400'}`}
        >
          {last ? formatAgo(last) : 'no contact yet'}
        </div>
      </button>
    </li>
  );

  return (
    <div className="max-w-md mx-auto">
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span className="flex-1">{error}</span>
          <button onClick={dismissError} aria-label="Dismiss" className="text-red-500">
            <X size={16} />
          </button>
        </div>
      )}
      {person ? (
        <PersonDetail
          key={person.id}
          person={person}
          data={data}
          actions={peopleData}
          onOpenPerson={(id) => {
            setOpenPersonId(id);
            window.scrollTo(0, 0);
          }}
          onBack={() => setOpenPersonId(null)}
          onOpenDate={onOpenDate}
        />
      ) : (
        <div className="space-y-3 pb-10">
          <form onSubmit={add} className="flex gap-2">
            <input
              type="text"
              aria-label="New person's name"
              className={inputCls}
              placeholder="Add a person"
              maxLength={MAX_PERSON_NAME}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="submit"
              disabled={!newName.trim() || adding}
              className="flex flex-shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
            >
              <Plus size={16} /> Add
            </button>
          </form>
          {people.length > 0 && (
            <>
              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  aria-label="Search people"
                  className={`${inputCls} pl-9`}
                  placeholder="Search names, employers, teams, notes"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5">
                {[{ value: 'all', label: 'All' }, ...KINDS.slice(0, 2)].map((k) => (
                  <button
                    key={k.value}
                    onClick={() => setKind(k.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border ${
                      kind === k.value
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {!loaded && !error && <p className="py-6 text-center text-sm text-gray-400">Loading…</p>}
          {loaded && people.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              Nobody here yet. Add the first person above.
            </p>
          )}
          {loaded && people.length > 0 && rows.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">No one matches.</p>
          )}
          {overdue.length > 0 && (
            <div>
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-red-600">
                Due to reach out
              </div>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
                {overdue.map(row)}
              </ul>
            </div>
          )}
          {rest.length > 0 && (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {rest.map(row)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
