// src/utils/closing.ts
//
// ⚠️⚠️ חצי שעה לפני האירוע, והסלון מוכרז נסגר מוקדם.
//
// בקשת בעל המוצר, 26/10/2026: "להוסיף חצי שעה לפני כל אירוע מייובא (ולציין
// זאת) למשל אירע שמתחיל ב 19:00 יכריז על הסלון כסגור כבר ב 18:30".
//
// למה זה קיים: אירוע תופס את הסלון, וההיערכות אליו מתחילה לפניו. חבר שמגיע
// ב-18:45 לסלון שאירוע מתחיל בו ב-19:00 מגיע לחדר שכבר מסדרים בו כיסאות.
// DOCS/PLANING/38
//
// ⚠️⚠️ ונכתב למסד ולא מחושב בתצוגה, בהכרעת בעל המוצר ("3 א").
// בתצוגה בלבד הפיד ליומן היה ממשיך לומר שהסלון פתוח.
//
// ⚠️ והכלל הוא השעה המוקדמת ביותר מבין אירועי אותו יום, ולא "האירוע הראשון
// שאחרי שעות הפעילות": אירוע ב-19:00 בסלון שפתוח עד 22:00 הוא בתוך שעות
// הפעילות, והניסוח ההוא היה מייצר אפס בדיוק בדוגמה שבעל המוצר נתן.
//
// ⚠️ וזה קובץ של פונקציות טהורות, ונקרא מתוך `useMemo` או מתוך `planFor`.
// CLAUDE.md, זרימת נתונים.

import type { ActivityEvent } from '../types';
import { minusMinutes, minutesOf } from './times.ts';

/** ⚠️ חצי שעה, במילותיו. מספר אחד, במקום אחד. */
export const MINUTES_BEFORE_EVENT = 30;

/**
 * האירוע המוקדם ביותר ביום.
 *
 * ⚠️ אירוע בלי שעת התחלה אינו משתתף. אין ממה לגזור.
 * ⚠️ ואירוע שחוצה חצות משתתף בשעת ההתחלה שלו, כמו כל אירוע אחר.
 */
function earliestEvent(events: ActivityEvent[] | undefined): ActivityEvent | undefined {
  let earliest: ActivityEvent | undefined;
  let best: number | undefined;

  for (const event of events ?? []) {
    const at = minutesOf(event.startTime);
    if (at === undefined) continue;
    if (best === undefined || at < best) {
      best = at;
      earliest = event;
    }
  }

  return earliest;
}

/**
 * שעת הסגירה שנגזרת מאירועי היום.
 *
 * ⚠️ `undefined` כשאין אף אירוע עם שעה, וגם כשהגזירה נופלת לפני חצות.
 */
export function derivedClosesAt(events: ActivityEvent[] | undefined): string | undefined {
  return minusMinutes(earliestEvent(events)?.startTime, MINUTES_BEFORE_EVENT);
}

/**
 * שם האירוע שגרם לשעת הסגירה, ⚠️ ורק כשהיא באמת נגזרה ממנו.
 *
 * בלשון בעל המוצר, "ולציין זאת": התגית אומרת את השעה ואת שם האירוע.
 *
 * ⚠️⚠️ ושעה שהמנהלת כתבה ביד אינה מקבלת שם אירוע.
 * יום שהיא סגרה ב-16:00 מסיבה שלה אינו "נסגר לקראת" שום דבר, וליחס שם לשעה
 * כזאת זה להמציא סיבה. DOCS/PLANING/38
 */
export function closingCauseOf(
  events: ActivityEvent[] | undefined,
  closesAt: string | undefined,
): string | undefined {
  if (!closesAt) return undefined;
  if (derivedClosesAt(events) !== closesAt) return undefined;
  return earliestEvent(events)?.title.trim() || undefined;
}

/**
 * ⚠️⚠️ שני מצבי התנגשות ולא אחד, ומסך שאומר בשניהם אותו דבר מטעה.
 *
 *   `cut`        הסגירה חותכת את המשמרת באמצע. 18:00 עד 22:00 מול 18:30.
 *   `swallowed`  הסגירה כולה לפני המשמרת, ואין בה אף דקה של סלון פתוח.
 *                19:00 עד 22:00 מול 18:30.
 */
export type ShiftClash = 'cut' | 'swallowed';

/**
 * האם שעת הסגירה של היום מתנגשת במשמרת, ואיך.
 *
 * בלשון בעל המוצר, 28/10/2026: "וגם אם יש אירוע שמתחיל ב 19 אז אין משמרת
 * מ 18".
 *
 * ⚠️ `undefined` כשהמשמרת נגמרת עד שעת הסגירה, וגם כשאין שעת סגירה בכלל.
 * משמרת כזאת אינה מסומנת בכלום.
 *
 * ⚠️⚠️ ושעת סגירה שהמנהלת כתבה ביד נחשבת בדיוק כמו נגזרת. היא סגירה, ואין
 * למשמרת מה לשמור אחריה בלי קשר למי קבע אותה.
 *
 * ⚠️⚠️ ומשמרת שנגמרת לפני שהתחילה ממשיכה למחרת, ולכן אינה נגמרת עד הסגירה.
 * השוואת המספרים לבדה הייתה הופכת משמרת 22:00 עד 02:00 למשמרת שנגמרת
 * ב-02:00 "לפני" סגירה ב-18:30, כלומר למשמרת תקינה. DOCS/PLANING/42
 *
 * ⚠️ וזו פונקציה טהורה, ונקראת מתוך `useMemo` או ישירות. CLAUDE.md.
 */
export function shiftClashWith(
  shift: { startTime: string; endTime: string },
  closesAt: string | undefined,
): ShiftClash | undefined {
  const at = minutesOf(closesAt);
  const start = minutesOf(shift.startTime);
  const end = minutesOf(shift.endTime);
  if (at === undefined || start === undefined || end === undefined) return undefined;

  if (end > start && end <= at) return undefined;

  // ⚠️ שווה נחשב נבלעה: סגירה בדיוק בשעת ההתחלה אינה משאירה אף דקה.
  return at <= start ? 'swallowed' : 'cut';
}

/**
 * מה האירועים עושים למצב היום.
 *
 * ⚠️⚠️ ושני מקרים ולא אחד, בהכרעת בעל המוצר ("4א"):
 *
 *   1. השעה הנגזרת בתוך שעות הפתיחה: **היום נסגר מוקדם**, ונושא את השעה.
 *   2. ⚠️ השעה הנגזרת מוקדמת מהפתיחה, למשל אירוע ב-10:00 בסלון שנפתח ב-10:00:
 *      **היום סגור לציבור ופתוח לחברי אופן ספייס, בלי שעת סגירה.**
 *
 * **ולא "נסגר ב-09:30" ביום שנפתח ב-10:00**, שהוא מצב לא עקבי כמו זה שנמדד
 * ברשומה 25, והוא גם היה יוצא לפיד היומן.
 *
 * ⚠️ ו-`undefined` כשאין גזירה בכלל: אין אירוע עם שעה, או שהיום ממילא סגור
 * לציבור. יום סגור אינו נסגר מוקדם.
 */
export function closingFor(
  events: ActivityEvent[] | undefined,
  publicAccess: 'open' | 'closed' | 'closesEarly',
  hours: { open: string; close: string } | null | undefined,
): { publicAccess: 'closed' | 'closesEarly'; closesAt?: string } | undefined {
  // ⚠️ יום שסגור לציבור ממילא, כולל שישי ושבת, אינו נסגר מוקדם.
  if (publicAccess === 'closed') return undefined;

  const closesAt = derivedClosesAt(events);
  if (!closesAt) return undefined;

  const open = minutesOf(hours?.open);
  const at = minutesOf(closesAt);
  if (open !== undefined && at !== undefined && at < open) {
    return { publicAccess: 'closed' };
  }

  return { publicAccess: 'closesEarly', closesAt };
}
