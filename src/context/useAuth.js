import { createContext, useContext } from 'react';

/** Estado de la sesión que publica AuthProvider (src/context/AuthContext.jsx). */
export const AuthContext = createContext({
  user:             null,
  loading:          true,
  supabaseReady:    false,
  isAuthModalOpen:  false,
  authModalTab:     'login',
  openAuthModal:    () => {},
  closeAuthModal:   () => {},
  login:            async () => {},
  register:         async () => {},
  logout:           async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
