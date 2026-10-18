import { useEffect, useState } from 'react';
import { ThemeContext } from './useTheme';

const KEY = 'prestamo-theme';

function temaInicial() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return stored === 'dark';
  } catch {
    // Sin almacenamiento: se usa la preferencia del sistema.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(KEY, dark ? 'dark' : 'light');
    } catch {
      // Ventana privada: el tema no se recuerda.
    }
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}
