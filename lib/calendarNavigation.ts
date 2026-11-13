import type { Href } from 'expo-router';
import type { useRouter } from 'expo-router';
import { stashCalendarFeedback } from './calendarFeedback';

type AppRouter = ReturnType<typeof useRouter>;

export function returnToCalendarAfterSave(router: AppRouter, message: string, date?: string) {
  stashCalendarFeedback({ message, date });

  const href = (date
    ? `/(tabs)/calendar?date=${encodeURIComponent(date)}`
    : '/(tabs)/calendar') as Href;

  const go = () => {
    try {
      if (typeof router.canDismiss === 'function' && router.canDismiss()) {
        router.dismissTo(href);
        return;
      }
    } catch {
      /* fallback */
    }
    router.replace(href);
  };

  queueMicrotask(go);
}
