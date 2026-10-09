'use client';

import { THEME_STORAGE_KEY, getTheme } from '@miscellary/shared';
import { useLayoutEffect } from 'react';
import { useAuth } from '@/lib/auth';

export default function Theme() {
  const { user, loading } = useAuth();
  const theme = getTheme(user?.theme);
  useLayoutEffect(() => {
    if (loading) return;
    const root = document.documentElement;
    for (const [name, value] of Object.entries(theme.css)) root.style.setProperty(name, value);
    root.dataset.theme = theme.id;
    try {
      if (user) localStorage.setItem(THEME_STORAGE_KEY, theme.id);
      else localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // Browser storage may be disabled.
    }
  }, [theme, user, loading]);
  return null;
}
