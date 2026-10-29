import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth';
import { getPatient } from './patientContext';
import { fetchActiveSleepSession } from './sleepSession';
import { lightColors, nightColors, type AppColors } from './theme';

type ThemeModeContextValue = {
  colors: AppColors;
  isSleeping: boolean;
  refreshTheme: () => Promise<void>;
};

const ThemeModeContext = createContext<ThemeModeContextValue>({
  colors: lightColors,
  isSleeping: false,
  refreshTheme: async () => {},
});

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [isSleeping, setIsSleeping] = useState(false);

  const refreshTheme = useCallback(async () => {
    if (!session) {
      setIsSleeping(false);
      return;
    }
    try {
      const patient = await getPatient();
      if (!patient?.id) {
        setIsSleeping(false);
        return;
      }
      const active = await fetchActiveSleepSession(patient.id);
      setIsSleeping(!!active);
    } catch {
      setIsSleeping(false);
    }
  }, [session]);

  useEffect(() => {
    void refreshTheme();
    const interval = setInterval(() => void refreshTheme(), 45_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshTheme();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refreshTheme]);

  const value = useMemo(
    () => ({
      colors: (isSleeping ? nightColors : lightColors) as AppColors,
      isSleeping,
      refreshTheme,
    }),
    [isSleeping, refreshTheme]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useAppColors() {
  return useContext(ThemeModeContext).colors;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
