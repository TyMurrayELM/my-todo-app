import { useContext, useState } from 'react';
import { isDatePickerActive } from '../lib/utils';
import { MAX_TASK_LENGTH } from '../lib/constants';
import { AppContext } from './AppContext';

// The "Add a new task..." box at the bottom of the open card. It holds its
// own text state so typing redraws only this box, not every task on screen.
// Unsent text, shared by every card's box: only the open card renders one,
// so text typed on one card follows to the next card opened.
let draft = '';

export default function AddTaskForm({ day, isDark, isTaskBank }) {
  const { addTask, isMobile, setExpandedTaskId, setPrimedTaskId } = useContext(AppContext);
  const [text, setText] = useState(() => draft);

  const update = (value) => {
    draft = value;
    setText(value);
  };

  const submit = async (e) => {
    e.preventDefault();
    const value = text;
    if (!value.trim() || value.trim().length > MAX_TASK_LENGTH) return;
    // Clear the box at once (a second Enter then has nothing to add); put
    // the text back if the save fails and nothing new was typed meanwhile.
    update('');
    if (!(await addTask(value, day)) && !draft) {
      update(value);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="pt-6"
      onClick={(e) => {
        e.stopPropagation();
        // Close expanded task when clicking the add task input on mobile
        // (but not from the stray click that follows opening a native date
        // picker — see the empty-space handler in DaySection)
        if (isMobile && !isDatePickerActive()) {
          setExpandedTaskId(null);
          setPrimedTaskId(null);
        }
      }}
    >
      <input
        type="text"
        value={text}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit(e);
        }}
        placeholder="Add a new task..."
        className={
          isTaskBank
            ? 'w-full bg-transparent text-sm placeholder-white focus:outline-none text-white'
            : `w-full bg-transparent text-sm placeholder-gray-400 focus:outline-none
                              ${isDark ? 'text-white placeholder-white' : 'text-gray-500'}`
        }
      />
    </form>
  );
}
