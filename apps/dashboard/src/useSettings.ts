import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import type { UserPreferences } from './types';

const STORAGE_KEY = 'app-settings';

export interface AppSettings {
  autoRefreshInterval: number;
  theme: 'light' | 'dark' | 'system';
  notifyOnCritical: boolean;
  notifyOnEscalation: boolean;
  defaultSeverityFilter: string;
  tablePageSize: number;
}

export const defaults: AppSettings = {
  autoRefreshInterval: 15,
  theme: 'dark',
  notifyOnCritical: true,
  notifyOnEscalation: true,
  defaultSeverityFilter: 'all',
  tablePageSize: 12,
};

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  } catch {
    return defaults;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const loaded = useRef(false);

  // Load from server on mount (per-account preferences)
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const token = localStorage.getItem('auth-token');
    if (!token) return;
    api.getPreferences().then((serverPrefs: UserPreferences | { error: string }) => {
      if (serverPrefs && !('error' in serverPrefs)) {
        const merged = { ...defaults, ...serverPrefs };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        setSettings(merged);
        window.dispatchEvent(new Event('settings-changed'));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSettings(loadSettings());
    };
    window.addEventListener('storage', handler);

    const customHandler = () => setSettings(loadSettings());
    window.addEventListener('settings-changed', customHandler);

    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('settings-changed', customHandler);
    };
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    const next = { ...loadSettings(), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSettings(next);
    window.dispatchEvent(new Event('settings-changed'));
    // Persist to server (fire-and-forget)
    const token = localStorage.getItem('auth-token');
    if (token) {
      api.updatePreferences(partial).catch(() => {});
    }
  }, []);

  return { settings, updateSettings };
}
