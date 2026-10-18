import { createContext, useContext } from 'react';

/** Tema claro/oscuro que publica ThemeProvider (src/context/ThemeContext.jsx). */
export const ThemeContext = createContext(null);

export const useTheme = () => useContext(ThemeContext);
