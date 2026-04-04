import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ThemeChoice = 'light' | 'dark';

interface DarkModeContextValue {
  isDark: boolean;
  setDarkMode: (value: boolean) => void;
  toggleDarkMode: () => void;
}

const STORAGE_KEY = 'trustcircle_theme';

const DarkModeContext = createContext<DarkModeContextValue | null>(null);

const resolveInitialTheme = (): ThemeChoice => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const DarkModeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeChoice>(resolveInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setDarkMode = useCallback((value: boolean) => {
    setTheme(value ? 'dark' : 'light');
  }, []);

  const toggleDarkMode = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<DarkModeContextValue>(
    () => ({
      isDark: theme === 'dark',
      setDarkMode,
      toggleDarkMode,
    }),
    [theme, setDarkMode, toggleDarkMode]
  );

  return <DarkModeContext.Provider value={value}>{children}</DarkModeContext.Provider>;
};

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within DarkModeProvider');
  }

  return context;
};
