/** Toast al volver al calendario (params de router a veces no llegan en tabs/web). */
export type CalendarFeedback = {
  message: string;
  date?: string;
};

const STORAGE_KEY = 'cande_calendar_feedback';

let pending: CalendarFeedback | null = null;

export function stashCalendarFeedback(feedback: CalendarFeedback) {
  pending = feedback;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(feedback));
    }
  } catch {
    /* quota / SSR */
  }
}

export function consumeCalendarFeedback(): CalendarFeedback | null {
  let fb = pending;
  pending = null;

  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        sessionStorage.removeItem(STORAGE_KEY);
        fb = JSON.parse(raw) as CalendarFeedback;
      }
    }
  } catch {
    /* ignore */
  }

  return fb;
}
