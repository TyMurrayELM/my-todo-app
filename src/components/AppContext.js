import { createContext } from 'react';

// App-wide context bag: task data, handlers, and UI state shared by
// DaySection and TaskItem. Provided once from App.
export const AppContext = createContext(null);

export const AppProvider = AppContext.Provider;
