import { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Repeat,
  Cake,
  X,
  Check,
  Pencil,
  User,
  Heart,
  Briefcase,
  StickyNote,
  Bell,
  MessageSquare,
  MapPin,
  Clock,
  CalendarDays,
  Tag,
} from 'lucide-react';
import { getLocalDateString } from '../lib/dates';
import { describeCustomFrequency } from '../lib/frequency';
import SkyIcon from './SkyIcon';
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
  currentAge,
  nextDue,
  lastContact,
  updateIsOn,
  isOverdue,
  formatAgo,
  formatDay,
  comingUp,
  formatUntil,
  snippetAround,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_PERSON,
  cleanTag,
  tagsOf,
  hasTag,
  tagCounts,
  addTag,
  removeTag,
  suggestTags,
} from '../lib/people';

const KINDS = [
  { value: 'personal', label: 'Personal' },
  { value: 'work', label: 'Work' },
  { value: 'both', label: 'Both' },
];

// The People screen takes its accent from the colour theme picked in the
// header. The shades are set once as CSS variables on the screen's outer
// element (--pa-50 ... --pa-800) and every class below reads them.
const ACCENTS = {
  amber: ['#fffbeb', '#fef3c7', '#fde68a', '#fbbf24', '#f59e0b', '#b45309', '#92400e'],
  blue: ['#eff6ff', '#dbeafe', '#bfdbfe', '#60a5fa', '#3b82f6', '#1d4ed8', '#1e40af'],
  green: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#4ade80', '#22c55e', '#15803d', '#166534'],
  purple: ['#faf5ff', '#f3e8ff', '#e9d5ff', '#c084fc', '#a855f7', '#7e22ce', '#6b21a8'],
  pink: ['#fdf2f8', '#fce7f3', '#fbcfe8', '#f472b6', '#ec4899', '#be185d', '#9d174d'],
};
const ACCENT_SHADES = [50, 100, 200, 400, 500, 700, 800];
const accentVars = (theme) =>
  Object.fromEntries(
    (ACCENTS[theme] || ACCENTS.amber).map((hex, i) => [`--pa-${ACCENT_SHADES[i]}`, hex])
  );

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-[color:var(--pa-500)] focus:outline-none focus:ring-2 focus:ring-[color:var(--pa-200)]';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1';
const cardCls = 'rounded-2xl bg-white border border-gray-200 shadow-sm p-4';
const solidBtnCls =
  'font-semibold text-white bg-[color:var(--pa-700)] hover:bg-[color:var(--pa-800)] disabled:opacity-40';
const pillOnCls = 'border-[color:var(--pa-700)] bg-[color:var(--pa-700)] text-white';
const pillOffCls = 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50';
const linkCls = 'text-[color:var(--pa-700)] hover:underline';
const tagChipCls =
  'inline-flex items-center gap-1 rounded-full border border-[color:var(--pa-200)] bg-[color:var(--pa-50)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--pa-800)]';
const checkboxCls = 'h-4 w-4 rounded border-gray-300 accent-[color:var(--pa-700)]';

// Initials in a tinted circle. The tint is one of three, picked by the name,
// so a list of people is not one flat column of the same colour.
const AVATAR_TINTS = [
  { background: 'var(--pa-100)', color: 'var(--pa-800)' },
  { background: 'var(--pa-200)', color: 'var(--pa-800)' },
  {
    background: 'var(--pa-50)',
    color: 'var(--pa-700)',
    boxShadow: 'inset 0 0 0 1px var(--pa-200)',
  },
];
function Avatar({ name, large }) {
  const words = String(name || '')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  const initials =
    ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() ||
    '?';
  let hash = 0;
  for (const ch of String(name || '')) hash = (hash * 31 + ch.codePointAt(0)) % 997;
  return (
    <span
      aria-hidden="true"
      style={AVATAR_TINTS[hash % AVATAR_TINTS.length]}
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-semibold ${
        large ? 'h-14 w-14 text-lg' : 'h-9 w-9 text-xs'
      }`}
    >
      {initials}
    </span>
  );
}

// A card's heading: a small tinted icon and the title
function CardTitle({ icon: Icon, children }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
      <span
        className="flex h-6 w-6 items-center justify-center rounded-md"
        style={{ background: 'var(--pa-100)', color: 'var(--pa-700)' }}
      >
        <Icon size={14} />
      </span>
      {children}
    </h3>
  );
}

// One fact in the strip under a person's name
function Fact({ icon: Icon, alert, children }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
        alert ? 'bg-red-50 font-medium text-red-700' : 'bg-gray-100 text-gray-700'
      }`}
    >
      <Icon size={12} className="flex-shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

// A small green "Saved" that shows for a moment after a save lands
function SavedTick({ show }) {
  return show ? (
    <span className="ml-2 inline-flex items-center gap-0.5 text-[11px] font-semibold normal-case tracking-normal text-emerald-600">
      <Check size={12} /> Saved
    </span>
  ) : null;
}

// true for ~2 seconds after flash() is called
function useFlash() {
  const [on, setOn] = useState(false);
  const flash = () => {
    setOn(true);
    setTimeout(() => setOn(false), 2000);
  };
  return [on, flash];
}

// A text box that saves when you leave it (or press Enter on one line) and
// says "Saved" once it has. Its text starts from the saved value; the
// person's page is rebuilt per person (keyed), so it never shows another
// person's text.
function Field({ label, value, onSave, maxLength, multiline, placeholder }) {
  const [text, setText] = useState(value ?? '');
  const [saved, flash] = useFlash();
  const commit = async () => {
    const next = text.trim();
    if (next === (value ?? '')) return;
    if (await onSave(next === '' ? null : next)) flash();
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
      <span className={labelCls}>
        {label}
        <SavedTick show={saved} />
      </span>
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

// A box that finds an existing profile by name or offers to create one.
// onPick(person) / onCreate(name) do the linking; both may be async.
function PersonPicker({
  people,
  excludeIds,
  initialText,
  keepOpen,
  ariaLabel,
  placeholder,
  onPick,
  onCreate,
}) {
  const [text, setText] = useState(initialText ?? '');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = text.trim().toLowerCase();
  const matches = q
    ? people
        .filter((x) => !excludeIds.includes(x.id) && x.name.toLowerCase().includes(q))
        .slice(0, 6)
    : [];
  const exact = people.some((x) => x.name.toLowerCase() === q);
  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    await fn();
    setBusy(false);
    setText('');
  };
  return (
    <div>
      <input
        type="text"
        aria-label={ariaLabel}
        className={inputCls}
        placeholder={placeholder}
        maxLength={MAX_PERSON_NAME}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        // late enough that a tap on a choice below still lands
        onBlur={() => setTimeout(() => setFocused(false), 200)}
      />
      {q && (focused || keepOpen) && (
        <ul className="mt-1 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {matches.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => onPick(x))}
                className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                Link to <span className="font-medium">{x.name}</span>
              </button>
            </li>
          ))}
          {!exact && (
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => onCreate(text.trim()))}
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

// A linked profile: its name opens it, the x removes the link
function PersonLink({ person, note, extra, onOpen, onRemove, removeLabel }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
      <button
        type="button"
        onClick={() => onOpen(person.id)}
        className={`min-w-0 flex-1 truncate text-left text-sm font-medium ${linkCls}`}
        title={`Open ${person.name}`}
      >
        {person.name}
        {note ? <span className="font-normal text-gray-500"> {note}</span> : null}
      </button>
      {extra}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600"
          aria-label={removeLabel}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

// Spouse is always another profile: shown as a link to it, or a box that
// finds an existing person by name or creates a new one and links both ways.
function SpouseField({ person, people, actions, onOpenPerson }) {
  const spouse = people.find((x) => x.id === person.spouse_id) || null;
  return (
    <div>
      <span className={labelCls}>Spouse / partner</span>
      {spouse ? (
        <PersonLink
          person={spouse}
          onOpen={onOpenPerson}
          onRemove={() => actions.setSpouse(person.id, null)}
          removeLabel={`Unlink ${spouse.name} as spouse`}
        />
      ) : (
        <PersonPicker
          people={people}
          excludeIds={[person.id]}
          // text typed before spouses were links is offered as the name to link
          initialText={person.spouse}
          keepOpen={!!person.spouse}
          ariaLabel="Spouse or partner"
          placeholder="Type a name to link or create"
          onPick={(other) => actions.setSpouse(person.id, other)}
          onCreate={async (name) => {
            const made = await actions.addPerson(name, person.kind);
            if (made) await actions.setSpouse(person.id, made);
          }}
        />
      )}
    </div>
  );
}

// Kids are links to profiles too. Adding one on a person with a spouse links
// the child to both; the x removes it from this person only.
function KidsField({ person, people, childLinks, actions, onOpenPerson }) {
  const byId = (id) => people.find((x) => x.id === id);
  const kids = childLinks
    .filter((l) => l.parent_id === person.id)
    .map((l) => byId(l.child_id))
    .filter(Boolean);
  const parentIds = childLinks.filter((l) => l.child_id === person.id).map((l) => l.parent_id);
  return (
    <div>
      <span className={labelCls}>Kids</span>
      <div className="space-y-1.5">
        {kids.map((kid) => {
          const age = currentAge(kid);
          return (
            <PersonLink
              key={kid.id}
              person={kid}
              note={age !== null ? `(${age})` : ''}
              extra={
                <button
                  type="button"
                  aria-pressed={!!kid.is_minor}
                  onClick={() => actions.setMinor(kid.id, !kid.is_minor)}
                  title="Under 18: lives with their parents, so Currently lives follows theirs"
                  className={`flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    kid.is_minor ? pillOnCls : pillOffCls
                  }`}
                >
                  {kid.is_minor && <Check size={11} />}
                  Under 18
                </button>
              }
              onOpen={onOpenPerson}
              onRemove={() => actions.removeChild(person.id, kid.id)}
              removeLabel={`Unlink ${kid.name} as a child`}
            />
          );
        })}
        <PersonPicker
          people={people}
          excludeIds={[person.id, person.spouse_id, ...kids.map((k) => k.id), ...parentIds]}
          ariaLabel="Add a child"
          placeholder={kids.length ? 'Add another: type a name' : 'Type a name to link or create'}
          onPick={(other) => actions.addChild(person.id, other)}
          onCreate={async (name) => {
            const made = await actions.addPerson(name, person.kind);
            if (made) await actions.addChild(person.id, made);
          }}
        />
      </div>
      {person.kids && (
        <p className="mt-1 flex items-start gap-1 text-xs text-gray-500">
          <span className="min-w-0 flex-1 break-words">Typed earlier: {person.kids}</span>
          <button
            type="button"
            onClick={() => actions.savePerson(person.id, { kids: null })}
            className="text-gray-400 hover:text-red-600"
            aria-label="Clear the earlier kids note"
          >
            <X size={13} />
          </button>
        </p>
      )}
    </div>
  );
}

// "Also add to:" family pills, for putting one update on several profiles
function AlsoPills({ family, ids, onChange }) {
  if (family.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-500">Also add to:</span>
      {family.map((f) => {
        const on = ids.includes(f.id);
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? ids.filter((x) => x !== f.id) : [...ids, f.id])}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
              on ? pillOnCls : pillOffCls
            }`}
          >
            {on && <Check size={12} />}
            {f.name}
          </button>
        );
      })}
    </div>
  );
}

// One dated update: shown, or being edited in place. `family` is who else it
// can be put on (this profile's spouse, kids and parents).
function UpdateRow({ update, person, family, today, flash, actions, onOpenPerson }) {
  const nameOf = (id) => actions.people.find((x) => x.id === id);
  // Written on another family member's profile and linked to this one
  const from = update.person_id !== person.id ? nameOf(update.person_id) : null;
  const also = (update.also_person_ids || []).map(nameOf).filter(Boolean);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(update.text);
  const [date, setDate] = useState(update.happened_on);
  // Family this update can be switched on or off for: not the profile it was
  // written on, which always has it
  const choices = family.filter((f) => f.id !== update.person_id);
  const linkedIds = update.also_person_ids || [];
  const [alsoIds, setAlsoIds] = useState(linkedIds);
  const [saved, showSaved] = useFlash();
  if (editing) {
    return (
      <li className="relative space-y-2 py-2 pl-4">
        <textarea
          rows={3}
          aria-label="Edit update"
          className={inputCls}
          maxLength={MAX_UPDATE_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <AlsoPills family={choices} ids={alsoIds} onChange={setAlsoIds} />
        <div className="flex gap-2">
          <input
            type="date"
            aria-label="Date of update"
            className={`${inputCls} flex-1`}
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            type="button"
            disabled={!text.trim() || !date}
            onClick={async () => {
              setEditing(false);
              // links to profiles not offered here (and this one) are kept
              const nextAlso = [
                ...linkedIds.filter((id) => !choices.some((f) => f.id === id)),
                ...alsoIds.filter((id) => choices.some((f) => f.id === id)),
              ];
              const sameAlso =
                nextAlso.length === linkedIds.length &&
                nextAlso.every((id) => linkedIds.includes(id));
              if (text.trim() === update.text && date === update.happened_on && sameAlso) return;
              if (await actions.editUpdate(update.id, text, date, sameAlso ? undefined : nextAlso))
                showSaved();
            }}
            className={`rounded-lg px-3 py-2 text-sm ${solidBtnCls}`}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setText(update.text);
              setDate(update.happened_on);
              setEditing(false);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }
  return (
    <li
      className={`relative flex items-start gap-1 rounded-r-lg py-2 pl-4 transition-colors duration-700 ${
        flash || saved ? 'bg-emerald-50' : ''
      }`}
    >
      {/* the dot on the timeline line drawn by the list */}
      <span
        aria-hidden="true"
        className="absolute -left-[5px] top-[13px] h-2 w-2 rounded-full ring-2 ring-white"
        style={{ background: 'var(--pa-400)' }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-[color:var(--pa-700)]">
          {formatDay(update.happened_on)}
          <SavedTick show={flash || saved} />
        </div>
        <div className="whitespace-pre-wrap break-words text-sm text-gray-800">{update.text}</div>
        {(from || also.length > 0) && (
          <div className="mt-0.5 text-xs text-gray-500">
            {from ? 'From ' : 'Also on '}
            {(from ? [from] : also).map((x, i) => (
              <span key={x.id}>
                {i > 0 ? ', ' : ''}
                <button type="button" onClick={() => onOpenPerson(x.id)} className={linkCls}>
                  {x.name}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={() => {
          setText(update.text);
          setDate(update.happened_on);
          setAlsoIds(linkedIds);
          setEditing(true);
        }}
        className="p-1.5 text-gray-400 hover:text-gray-700"
        aria-label="Edit update"
      >
        <Pencil size={15} />
      </button>
      <button
        onClick={() =>
          from ? actions.unlinkUpdate(update.id, person.id) : actions.deleteUpdate(update.id)
        }
        className="p-1.5 text-gray-400 hover:text-red-600"
        aria-label={from ? 'Remove update from this profile' : 'Delete update'}
        title={from ? `Remove from this profile (stays on ${from.name})` : 'Delete'}
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}

// A person's tags as chips with an x, and a box to add one. Focused, the box
// offers tags already in use (most used first); Enter, a comma or leaving the
// box adds what was typed. Saves at once.
function TagsField({ person, knownTags, onSave }) {
  const tags = tagsOf(person);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [saved, flash] = useFlash();
  const full = tags.length >= MAX_TAGS_PER_PERSON;

  const saveTags = async (next) => {
    if (next === tags) return;
    if (await onSave({ tags: next })) flash();
  };
  const add = (value) => {
    setText('');
    saveTags(addTag(tags, value, knownTags));
  };

  const typed = cleanTag(text);
  const isNew =
    typed && ![...knownTags, ...tags].some((t) => t.toLowerCase() === typed.toLowerCase());
  const suggestions = focused && !full ? suggestTags(text, knownTags, tags) : [];
  // a tap on a suggestion must not take focus from the box first, or leaving
  // the box would add the half-typed text as well
  const keepFocus = (e) => e.preventDefault();

  return (
    <div>
      <span className={labelCls}>
        Tags
        <SavedTick show={saved} />
      </span>
      {tags.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className={tagChipCls}>
              {t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                onClick={() => saveTags(removeTag(tags, t))}
                className="-mr-1 rounded-full p-0.5 text-[color:var(--pa-700)] hover:bg-[color:var(--pa-100)]"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      {full ? (
        <p className="text-xs text-gray-500">
          {MAX_TAGS_PER_PERSON} tags is the most one person can have.
        </p>
      ) : (
        <input
          type="text"
          aria-label="Add a tag"
          className={inputCls}
          placeholder={tags.length ? 'Add another tag' : 'Add a tag, like College or Golf'}
          maxLength={MAX_TAG_LENGTH}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(',')) {
              // a comma finishes the tag; anything after it starts the next
              const [first, ...rest] = v.split(',');
              if (cleanTag(first)) add(first);
              setText(rest.join(','));
            } else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (typed) add(text);
            } else if (e.key === 'Escape') {
              setText('');
              e.target.blur();
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (typed) add(text);
          }}
        />
      )}
      {(suggestions.length > 0 || (focused && isNew)) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions.map((t) => (
            <button
              key={t}
              type="button"
              onMouseDown={keepFocus}
              onClick={() => add(t)}
              className={`inline-flex items-center gap-0.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${pillOffCls}`}
            >
              <Plus size={12} /> {t}
            </button>
          ))}
          {isNew && focused && (
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => add(text)}
              className={`inline-flex items-center gap-0.5 rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium ${pillOffCls}`}
            >
              <Plus size={12} /> New tag &ldquo;{typed}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// "Has pets" checkbox; ticked, it opens a list of pets (name and kind) to
// add to. Unticking hides the list but keeps what was entered.
function PetsField({ person, onSave }) {
  const pets = Array.isArray(person.pets) ? person.pets : [];
  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [saved, flash] = useFlash();
  const savePets = async (next) => {
    if (await onSave({ pets: next })) flash();
  };
  const add = async () => {
    if (!name.trim()) return;
    const next = [...pets, { name: name.trim(), kind: kind.trim() }];
    setName('');
    setKind('');
    await savePets(next);
  };
  return (
    <div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className={checkboxCls}
          checked={!!person.has_pets}
          onChange={(e) => onSave({ has_pets: e.target.checked })}
        />
        <span className={`${labelCls} mb-0`}>
          Has pets
          <SavedTick show={saved} />
        </span>
      </label>
      {person.has_pets && (
        <div className="mt-1.5 space-y-1.5">
          {pets.map((pet, i) => (
            <div
              key={`${pet.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
                <span className="font-medium">{pet.name}</span>
                {pet.kind ? <span className="text-gray-500"> · {pet.kind}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => savePets(pets.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-600"
                aria-label={`Remove ${pet.name}`}
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              aria-label="Pet name"
              className={`${inputCls} flex-[2]`}
              placeholder="Pet's name"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <input
              type="text"
              aria-label="Kind of pet"
              className={`${inputCls} flex-1`}
              placeholder="Dog"
              maxLength={40}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button
              type="button"
              onClick={add}
              disabled={!name.trim() || pets.length >= 20}
              className={`flex-shrink-0 rounded-lg px-3 py-2 text-sm ${solidBtnCls}`}
            >
              Add
            </button>
          </div>
        </div>
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

  const myUpdates = data.updates.filter((u) => updateIsOn(u, person.id));
  // Family an update can also be put on: spouse, kids, parents
  const family = [
    person.spouse_id,
    ...actions.childLinks.filter((l) => l.parent_id === person.id).map((l) => l.child_id),
    ...actions.childLinks.filter((l) => l.child_id === person.id).map((l) => l.parent_id),
  ]
    .filter((id, i, all) => id && all.indexOf(id) === i)
    .map((id) => actions.people.find((x) => x.id === id))
    .filter(Boolean);
  const [alsoIds, setAlsoIds] = useState([]);
  // The update just added: highlighted for a moment so it is clear it saved
  const [newUpdateId, setNewUpdateId] = useState(null);
  const parents = actions.childLinks
    .filter((l) => l.child_id === person.id)
    .map((l) => actions.people.find((x) => x.id === l.parent_id))
    .filter(Boolean);
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
  const knownTags = useMemo(() => tagCounts(actions.people).map((x) => x.tag), [actions.people]);

  const submitUpdate = async (e) => {
    e.preventDefault();
    if (!updateText.trim() || busy) return;
    setBusy(true);
    const saved = await actions.addUpdate(
      person.id,
      updateText,
      updateDate,
      alsoIds.filter((id) => family.some((f) => f.id === id))
    );
    setBusy(false);
    if (saved) {
      setUpdateText('');
      setUpdateDate(today);
      setAlsoIds([]);
      setNewUpdateId(saved.id);
      setTimeout(() => setNewUpdateId((cur) => (cur === saved.id ? null : cur)), 2500);
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

      <div className={`${cardCls} relative overflow-hidden pt-5`}>
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background: 'linear-gradient(to right, var(--pa-200), var(--pa-500), var(--pa-800))',
          }}
        />
        <div className="flex items-center gap-3">
          <Avatar name={person.name} large />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold leading-tight text-gray-900">
              {person.name}
            </h2>
            <p className="truncate text-sm text-gray-500">
              {[KINDS.find((k) => k.value === person.kind)?.label, person.employer]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Fact icon={Clock} alert={isOverdue(person, last)}>
            {last ? `Last contact ${formatAgo(last)}` : 'No contact yet'}
            {isOverdue(person, last) ? ' · reach out' : ''}
          </Fact>
          {formatBirthday(person) && (
            <Fact icon={Cake}>
              {formatBirthday({ ...person, birthday_year: null })}
              {turningAge(person) ? ` · turns ${turningAge(person)}` : ''}
            </Fact>
          )}
          {person.lives_in && (
            <Fact icon={MapPin}>
              {person.lives_in}
              {actions.weather[person.id] ? ` · ${actions.weather[person.id].tempF}°` : ''}
            </Fact>
          )}
        </div>
      </div>

      <div className={cardCls}>
        <CardTitle icon={User}>Basics</CardTitle>
        <div className="space-y-3">
          <Field
            label="Name"
            value={person.name}
            maxLength={MAX_PERSON_NAME}
            onSave={(v) => (v ? save({ name: v }) : false)}
          />
          <div>
            <span className={labelCls}>Type</span>
            <div className="flex gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  onClick={() => person.kind !== k.value && save({ kind: k.value })}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    person.kind === k.value ? pillOnCls : pillOffCls
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <BirthdayField person={person} onSave={save} />
          <TagsField person={person} knownTags={knownTags} onSave={save} />
        </div>
      </div>

      <div className={cardCls}>
        <CardTitle icon={Heart}>Family</CardTitle>
        <div className="space-y-3">
          <SpouseField
            person={person}
            people={actions.people}
            actions={actions}
            onOpenPerson={onOpenPerson}
          />
          <KidsField
            person={person}
            people={actions.people}
            childLinks={actions.childLinks}
            actions={actions}
            onOpenPerson={onOpenPerson}
          />
          {parents.length > 0 && (
            <div>
              <span className={labelCls}>Parents</span>
              <div className="space-y-1.5">
                {parents.map((x) => (
                  <PersonLink key={x.id} person={x} onOpen={onOpenPerson} />
                ))}
              </div>
              <label className="mt-1.5 flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  className={checkboxCls}
                  checked={!!person.is_minor}
                  onChange={(e) => actions.setMinor(person.id, e.target.checked)}
                />
                Under 18 (lives with parents)
              </label>
            </div>
          )}
          <PetsField person={person} onSave={save} />
        </div>
      </div>

      <div className={cardCls}>
        <CardTitle icon={Briefcase}>Work and places</CardTitle>
        <div className="space-y-3">
          <Field
            label="Employer"
            value={person.employer}
            maxLength={MAX_PERSON_FIELD}
            placeholder="Company, role"
            onSave={(v) => save({ employer: v })}
          />
          <div>
            {person.is_minor && parents.length > 0 ? (
              // under 18: the place is their parents', changed on a parent's page
              <div>
                <span className={labelCls}>Currently lives</span>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {person.lives_in || 'Not set on their parents yet'}
                  <span className="text-gray-400"> · with parents</span>
                </div>
              </div>
            ) : (
              <Field
                // rebuilt when the place is changed from a spouse's or parent's page
                key={person.lives_in ?? ''}
                label="Currently lives"
                value={person.lives_in}
                maxLength={MAX_PERSON_FIELD}
                placeholder="City, State"
                onSave={(v) => actions.saveLivesIn(person.id, v)}
              />
            )}
            {person.lives_in && person.lives_lat == null && (
              <p className="mt-1 text-xs text-gray-500">
                No weather: couldn&apos;t match that place. Try &quot;City, State&quot;.
              </p>
            )}
            {person.lives_lat != null && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                {actions.weather[person.id] ? (
                  <>
                    <SkyIcon
                      sky={actions.weather[person.id].sky}
                      night={actions.weather[person.id].night}
                    />
                    <span className="font-medium text-gray-700">
                      {actions.weather[person.id].tempF}°
                    </span>
                    <span>{actions.weather[person.id].label} now in</span>
                  </>
                ) : (
                  <span>Weather for</span>
                )}
                <span className="truncate">{person.lives_label}</span>
              </p>
            )}
          </div>
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
        </div>
      </div>

      <div className={cardCls}>
        <CardTitle icon={StickyNote}>Notes and keeping in touch</CardTitle>
        <div className="space-y-3">
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
            <span
              className={`mt-1 block text-xs ${
                isOverdue(person, last) ? 'font-medium text-red-600' : 'text-gray-500'
              }`}
            >
              Last contact: {formatAgo(last)}
              {isOverdue(person, last) ? ' · due to reach out' : ''}
            </span>
          </label>
        </div>
      </div>

      <div className={cardCls}>
        <CardTitle icon={Bell}>Reminders</CardTitle>
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
            className={`w-full rounded-lg px-3 py-2 text-sm ${solidBtnCls}`}
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
        <CardTitle icon={MessageSquare}>Updates</CardTitle>
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
          <AlsoPills family={family} ids={alsoIds} onChange={setAlsoIds} />
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
              className={`flex-1 rounded-lg px-3 py-2 text-sm ${solidBtnCls}`}
            >
              Save update
            </button>
          </div>
        </form>
        {myUpdates.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">No updates yet.</p>
        ) : (
          <ul className="ml-1 mt-4 border-l-2 border-[color:var(--pa-100)]">
            {myUpdates.map((u) => (
              <UpdateRow
                key={u.id}
                update={u}
                person={person}
                family={family}
                onOpenPerson={onOpenPerson}
                today={today}
                flash={u.id === newUpdateId}
                actions={actions}
              />
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

// Shown while a tag filter is on: how many have it, and renaming or removing
// it on everyone. Renaming onto a tag already in use merges the two. Tapping
// the tag's chip again turns the filter off.
function TagFilterBar({ tag, count, onRename, onDelete }) {
  const [mode, setMode] = useState(null); // null | 'rename' | 'delete'
  const [text, setText] = useState(tag);
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok) setMode(null);
  };
  const who = `${count} ${count === 1 ? 'person' : 'people'}`;
  const linkBtn = `text-xs font-medium ${linkCls}`;
  if (mode === 'rename') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (cleanTag(text) && cleanTag(text) !== tag) run(() => onRename(text));
          else setMode(null);
        }}
        className="flex items-center gap-2 px-1"
      >
        <input
          type="text"
          aria-label={`New name for the tag ${tag}`}
          className={`${inputCls} py-1.5`}
          maxLength={MAX_TAG_LENGTH}
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setMode(null)}
        />
        <button
          type="submit"
          disabled={busy || !cleanTag(text)}
          className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs ${solidBtnCls}`}
        >
          Rename
        </button>
        <button
          type="button"
          onClick={() => setMode(null)}
          className="flex-shrink-0 text-xs text-gray-500"
        >
          Cancel
        </button>
      </form>
    );
  }
  if (mode === 'delete') {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-gray-700">
        <span>
          Remove &ldquo;{tag}&rdquo; from {who}? Their profiles stay.
        </span>
        <button
          disabled={busy}
          onClick={() => run(onDelete)}
          className="font-semibold text-red-600 hover:underline"
        >
          Remove tag
        </button>
        <button onClick={() => setMode(null)} className="text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-gray-500">
      <span>
        {who} tagged <span className="font-medium text-gray-700">{tag}</span>
      </span>
      <button
        onClick={() => {
          setText(tag);
          setMode('rename');
        }}
        className={linkBtn}
      >
        Rename
      </button>
      <button onClick={() => setMode('delete')} className={linkBtn}>
        Remove tag
      </button>
    </div>
  );
}

// The People screen: a searchable list, and one person's page. `peopleData`
// is the usePeople hook; `onOpenDate(YYYY-MM-DD)` opens that day's to-do list.
export default function PeopleView({
  peopleData,
  openPersonId,
  setOpenPersonId,
  onOpenDate,
  colorTheme,
}) {
  const {
    people,
    updates,
    reminders,
    completions,
    childLinks,
    weather,
    loaded,
    error,
    dismissError,
  } = peopleData;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [tagFilter, setTagFilter] = useState(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const data = useMemo(
    () => ({ updates, reminders, completions }),
    [updates, reminders, completions]
  );
  const person = people.find((p) => p.id === openPersonId) || null;

  // Kids marked under 18 are not contacts of their own: they are left out of
  // the list and shown under each parent instead (a marked kid with no parent
  // linked still gets a row, or there would be no way to reach them)
  const { tucked, minorsOf } = useMemo(() => {
    const byId = Object.fromEntries(people.map((p) => [p.id, p]));
    const hidden = new Set();
    const under = {};
    childLinks.forEach((l) => {
      const kid = byId[l.child_id];
      if (!kid?.is_minor || !byId[l.parent_id]) return;
      hidden.add(kid.id);
      (under[l.parent_id] ||= []).push(kid);
    });
    return { tucked: hidden, minorsOf: under };
  }, [people, childLinks]);

  // Tags in use on the list (kids shown under a parent don't count), most used
  // first. A filter whose tag is gone (renamed or removed) shows everyone.
  const tagList = useMemo(
    () => tagCounts(people.filter((p) => !tucked.has(p.id))),
    [people, tucked]
  );
  const activeTag = tagFilter
    ? (tagList.find((t) => t.tag.toLowerCase() === tagFilter.toLowerCase()) ?? null)
    : null;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const spouseName = Object.fromEntries(people.map((p) => [p.id, p.name]));
    const kidNames = {};
    childLinks.forEach((l) => {
      kidNames[l.parent_id] = `${kidNames[l.parent_id] ?? ''} ${spouseName[l.child_id] ?? ''}`;
    });
    return people
      .filter((p) => !tucked.has(p.id))
      .filter((p) => kind === 'all' || p.kind === kind || p.kind === 'both')
      .filter((p) => !activeTag || hasTag(p, activeTag.tag))
      .filter(
        (p) =>
          !q ||
          [
            p.name,
            p.employer,
            spouseName[p.spouse_id],
            kidNames[p.id],
            p.from_place,
            p.lives_in,
            p.has_pets && Array.isArray(p.pets) ? p.pets.map((x) => x.name).join(' ') : null,
            p.sports_teams,
            p.notes,
            tagsOf(p).join(' '),
          ].some((f) => f && f.toLowerCase().includes(q)) ||
          // or something logged about them says it
          data.updates.some((u) => updateIsOn(u, p.id) && u.text.toLowerCase().includes(q))
      )
      .map((p) => {
        const last = lastContact(p.id, data);
        // the newest update that matches the search, shown under their name
        const hit = q
          ? data.updates.find((u) => updateIsOn(u, p.id) && u.text.toLowerCase().includes(q))
          : null;
        return { p, last, overdue: isOverdue(p, last), hit };
      });
  }, [people, childLinks, tucked, data, query, kind, activeTag]);
  const overdue = rows.filter((r) => r.overdue);
  const rest = rows.filter((r) => !r.overdue);
  // Everyone due, whatever the search box and filter are showing
  const dueCount = useMemo(
    () => people.filter((p) => !tucked.has(p.id) && isOverdue(p, lastContact(p.id, data))).length,
    [people, tucked, data]
  );
  // Birthdays and reminders in the next 30 days
  const upcoming = useMemo(() => comingUp(reminders, completions), [reminders, completions]);
  const [allUpcoming, setAllUpcoming] = useState(false);
  const nameById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p.name])), [people]);

  const add = async (e) => {
    e.preventDefault();
    if (!newName.trim() || adding) return;
    setAdding(true);
    const made = await peopleData.addPerson(
      newName,
      kind === 'work' ? 'work' : 'personal',
      activeTag ? [activeTag.tag] : []
    );
    setAdding(false);
    if (made) {
      setNewName('');
      setOpenPersonId(made.id);
    }
  };

  const row = ({ p, last, overdue: due, hit }) => (
    <li key={p.id}>
      <button
        onClick={() => setOpenPersonId(p.id)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <Avatar name={p.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-900">{p.name}</div>
          <div className="truncate text-xs text-gray-500">
            {[p.employer, p.lives_in || p.from_place, formatBirthday({ ...p, birthday_year: null })]
              .filter(Boolean)
              .join(' · ') || (p.kind === 'work' ? 'Work' : 'Personal')}
          </div>
          {hit && (
            <div className="truncate text-xs text-[color:var(--pa-700)]">
              {formatDay(hit.happened_on)}: {snippetAround(hit.text, query)}
            </div>
          )}
        </div>
        <div
          className={`flex-shrink-0 text-right text-xs ${due ? 'font-semibold text-red-600' : 'text-gray-400'}`}
        >
          {last ? formatAgo(last) : 'no contact yet'}
          {weather[p.id] && (
            <div
              className="mt-0.5 flex items-center justify-end gap-1 font-normal text-gray-500"
              title={`${weather[p.id].label}, ${weather[p.id].tempF}° in ${p.lives_label}`}
            >
              <SkyIcon
                sky={weather[p.id].sky}
                night={weather[p.id].night}
                className="h-[15px] w-[15px]"
              />
              {weather[p.id].tempF}°
            </div>
          )}
        </div>
      </button>
      {minorsOf[p.id] && (
        <ul className="pb-2 pl-16 pr-4">
          {minorsOf[p.id].map((kid) => {
            const age = currentAge(kid);
            return (
              <li key={kid.id}>
                <button
                  onClick={() => setOpenPersonId(kid.id)}
                  className="flex w-full items-center gap-1.5 rounded py-1 text-left text-xs text-gray-600 hover:bg-gray-50"
                >
                  <span className="text-gray-300" aria-hidden="true">
                    └
                  </span>
                  <span className="truncate">{kid.name}</span>
                  {age !== null && <span className="flex-shrink-0 text-gray-400">({age})</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );

  return (
    <div className="max-w-md mx-auto" style={accentVars(colorTheme)}>
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
          <div className="flex items-baseline justify-between px-1">
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">People</h1>
            {loaded && people.length > 0 && (
              <span className="text-xs text-gray-500">
                {people.length - tucked.size} people
                {dueCount > 0 ? ` · ${dueCount} to reach out` : ''}
              </span>
            )}
          </div>
          <form onSubmit={add} className="flex gap-2">
            <input
              type="text"
              aria-label="New person's name"
              className={inputCls}
              placeholder={activeTag ? `Add a person tagged ${activeTag.tag}` : 'Add a person'}
              maxLength={MAX_PERSON_NAME}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="submit"
              disabled={!newName.trim() || adding}
              className={`flex flex-shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm ${solidBtnCls}`}
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
                  placeholder="Search names, notes, updates"
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
                      kind === k.value ? pillOnCls : pillOffCls
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              {tagList.length > 0 && (
                <div
                  className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5"
                  role="group"
                  aria-label="Filter by tag"
                >
                  <Tag
                    size={14}
                    className="mt-1.5 flex-shrink-0 text-gray-400"
                    aria-hidden="true"
                  />
                  {tagList.map(({ tag: t, count }) => {
                    const on = activeTag?.tag === t;
                    return (
                      <button
                        key={t}
                        aria-pressed={on}
                        onClick={() => setTagFilter(on ? null : t)}
                        className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${
                          on ? pillOnCls : pillOffCls
                        }`}
                      >
                        {t}
                        <span className={on ? 'ml-1 opacity-75' : 'ml-1 text-gray-400'}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {activeTag && (
                <TagFilterBar
                  key={activeTag.tag}
                  tag={activeTag.tag}
                  count={activeTag.count}
                  onRename={async (to) => {
                    const ok = await peopleData.renameTag(activeTag.tag, to);
                    if (ok) setTagFilter(cleanTag(to));
                    return ok;
                  }}
                  onDelete={async () => {
                    const ok = await peopleData.deleteTag(activeTag.tag);
                    if (ok) setTagFilter(null);
                    return ok;
                  }}
                />
              )}
            </>
          )}
          {!query.trim() && !activeTag && upcoming.length > 0 && (
            <div className={cardCls}>
              <CardTitle icon={CalendarDays}>Coming up</CardTitle>
              <ul className="-my-1">
                {(allUpcoming ? upcoming : upcoming.slice(0, 5)).map(({ row: r, due }) => {
                  const late = formatUntil(due) === 'overdue';
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => setOpenPersonId(r.person_id)}
                        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-gray-800">{r.text}</div>
                          <div className="truncate text-xs text-gray-500">
                            {r.person_tag === BIRTHDAY_TAG
                              ? formatDay(due)
                              : [nameById[r.person_id], formatDay(due)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <span
                          className={`flex-shrink-0 text-xs ${
                            late ? 'font-semibold text-red-600' : 'text-gray-400'
                          }`}
                        >
                          {formatUntil(due)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {upcoming.length > 5 && (
                <button
                  onClick={() => setAllUpcoming((v) => !v)}
                  className={`mt-2 text-xs font-medium ${linkCls}`}
                >
                  {allUpcoming ? 'Show fewer' : `Show all ${upcoming.length}`}
                </button>
              )}
            </div>
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
