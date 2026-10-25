import { create } from 'zustand';

export type ThemeMode = 'dark' | 'oled' | 'light';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const STORAGE_KEY = 'lyc_theme';

export const applyThemeToDocument = (theme: ThemeMode) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  document.body.classList.remove('theme-dark', 'theme-oled', 'theme-light');
  document.body.classList.add(`theme-${theme}`);
};

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'oled' || saved === 'light') {
      return saved;
    }
    // Backward compatibility if saved as 'midnight'
    if (saved === 'midnight') {
      return 'oled';
    }
  } catch (err) {
    console.error('Error reading theme from localStorage:', err);
  }
  return 'dark';
};

const initialTheme = getInitialTheme();
if (typeof document !== 'undefined') {
  applyThemeToDocument(initialTheme);
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (theme: ThemeMode) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch (err) {
      console.error('Error saving theme to localStorage:', err);
    }
    applyThemeToDocument(theme);
    set({ theme });
  },
}));

// Convenience hook
export const useTheme = () => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return { theme, setTheme };
};
