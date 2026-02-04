'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = 'spinchain-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Use a microtask to defer the state update
    Promise.resolve().then(() => {
      setMounted(true);
    });

    // Load saved theme
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved) {
      // Use a microtask to defer the state update
      Promise.resolve().then(() => {
        setThemeState(saved);
      });
    } else {
      // Use a microtask to defer the state update
      Promise.resolve().then(() => {
        setResolvedTheme(getSystemTheme());
      });
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        // Use a microtask to defer the state update
        Promise.resolve().then(() => {
          setResolvedTheme(getSystemTheme());
        });
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    
    // Apply theme class
    root.classList.remove('light', 'dark');
    root.classList.add(theme === 'system' ? getSystemTheme() : theme);
    
    // Store preference
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    
    const newResolvedTheme = theme === 'system' ? getSystemTheme() : theme;
    // Use a microtask to defer the state update
    Promise.resolve().then(() => {
      setResolvedTheme(newResolvedTheme);
    });
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(current => {
      const resolved = current === 'system' ? getSystemTheme() : current;
      return resolved === 'dark' ? 'light' : 'dark';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
