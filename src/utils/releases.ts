// src/utils/releases.ts
//
// ⚠️ אזור ליבה. הדוח קורא שורות על אנשים אמיתיים, ומה שהוא אומר עליהם מגיע
// למנהלת. DOCS/PLANING/29-nothing-records-that-someone-cancelled.md
//
// ⚠️⚠️ ופונקציה טהורה ולא רכיב, בכוונה.
// שלוש ההכרעות שיושבות כאן הן בדיוק מה שמבדיל בין כלי לבין כתב אישום, ולכן
// הן צריכות להיות ניתנות לבדיקה בלי מסך:
//
//   1. מי שאיבד את המשמרת ולא מי שלחץ. שחרור בידי מנהלת אינו ביטול של החבר.
//   2. כמה זמן לפני. שחרור שבועיים לפני ושחרור בבוקר המשמרת אינם אותו דבר.
//   3. ⚠️ שלושה ערכים ל"משמרת אחרת באותו חודש", ולא שניים. חודש שעוד לא
//      נגמר אינו "לא עשה".

import type { Attendance, SalonEvent, Shift } from '../types';
// ⚠️ סיומת `.ts` מפורשת, וזה היחיד בפרויקט. בלעדיה `node --test
// --experimental-strip-types` אינו מוצא את המודול, ולא הייתה דרך להריץ את
// הבדיקה של הקובץ הזה בלי מסך. tsconfig.app.json מתיר את זה במפורש.
import { fromDateKey, monthKeyOfDateKey, toMonthKey } from './dates.ts';

/** ⚠️ שלושה ערכים. `monthOpen` אינו `none`. */
export type MonthVerdict = 'otherShift' | 'none' | 'monthOpen';

export type AfterVerdict = 'taken' | 'open' | 'unknown';

export interface ReleaseRow {
  eventId: string;
  at: number;
  /** מי איבד את המשמרת. ⚠️ ולא מי לחץ. */
  memberId: string | null;
  /** ⚠️ מנהלת שחררה משמרת של חבר, והחבר לא החליט על זה. */
  byManager: boolean;
  shiftId: string | null;
  shiftDate: string | null;
  startTime: string | null;
  endTime: string | null;
  /**
   * שעות מהשחרור עד תחילת המשמרת.
   *
   * ⚠️ שלילי פירושו שהשחרור נעשה אחרי שהמשמרת התחילה, ו-null פירושו שאין
   * תאריך על השורה ואי אפשר לחשב.
   */
  noticeHours: number | null;
  after: AfterVerdict;
  /** מי מחזיק את המשמרת עכשיו, כשמישהו לקח אותה. */
  afterName: string | null;
  month: MonthVerdict;
  /** ⚠️ הנוכחות שנרשמה על המשמרת, ו-`assumed` אינו "הגיע". */
  attendance: Attendance | null;
}

/** תחילת המשמרת, כרגע בזמן. ⚠️ מהשעות שהועתקו אל המשמרת, ולא מהתבנית. */
function startsAt(dateKey: string, startTime: string | undefined): number {
  const [hour, minute] = (startTime ?? '00:00').split(':').map(Number);
  const date = fromDateKey(dateKey);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

/**
 * האם לחבר יש משמרת אחרת באותו חודש.
 *
 * ⚠️ אותה נוסחה כמו הזכאות: משמרת שהוא מחזיק, או משמרת שהוא מסר בהחלפה
 * שהושלמה. DOCS/PLANING/10-shift-handover.md
 *
 * ⚠️ ובלי המשמרת ששוחררה עצמה, כי השדות שלה כבר נמחקו ממילא.
 */
function hasOtherShift(
  shifts: Shift[],
  memberId: string,
  monthKey: string,
  exceptShiftId: string | null,
): boolean {
  return shifts.some((shift) => {
    if (shift.id === exceptShiftId) return false;
    if (monthKeyOfDateKey(shift.date) !== monthKey) return false;
    if (shift.assigneeMemberId === memberId) return true;
    return shift.handoverFromMemberId === memberId && shift.handoverState === 'completed';
  });
}

/**
 * שורה לכל שחרור.
 *
 * @param events  שורות `shiftReleased`, בסדר שהמסד החזיר.
 * @param shifts  כל משמרות הסניף, לקריאת מה שקרה אחרי.
 */
export function releaseRows(
  events: SalonEvent[],
  shifts: Shift[],
  now: number = Date.now(),
): ReleaseRow[] {
  const byId = new Map(shifts.map((shift) => [shift.id, shift]));
  const thisMonth = toMonthKey(new Date(now));

  return events
    .filter((event) => event.action === 'shiftReleased')
    .map((event) => {
      const shift = event.shiftId ? byId.get(event.shiftId) : undefined;
      const date = event.shiftDate ?? shift?.date ?? null;
      /*
        ⚠️ `subjectMemberId` ולא `actorMemberId`, בהכרעת בעל המוצר 12/10.
        ⚠️ ובשורות שנכתבו על משמרת שלא היה לה משובץ אין נושא, וזה אפשרי.
      */
      const memberId = event.subjectMemberId ?? null;

      let month: MonthVerdict = 'monthOpen';
      if (date && memberId) {
        const monthKey = monthKeyOfDateKey(date);
        if (hasOtherShift(shifts, memberId, monthKey, event.shiftId ?? null)) {
          month = 'otherShift';
        } else if (monthKey < thisMonth) {
          // ⚠️ רק כאן אפשר לומר "לא עשה". חודש שעוד פתוח אינו תשובה.
          month = 'none';
        }
      }

      let after: AfterVerdict = 'unknown';
      if (shift) after = shift.assigneeMemberId ? 'taken' : 'open';

      return {
        eventId: event.id,
        at: event.at,
        memberId,
        byManager: Boolean(memberId) && event.actorMemberId !== memberId,
        shiftId: event.shiftId ?? null,
        shiftDate: date,
        startTime: shift?.startTime ?? null,
        endTime: shift?.endTime ?? null,
        noticeHours: date
          ? (startsAt(date, shift?.startTime) - event.at) / 3_600_000
          : null,
        after,
        afterName: shift?.assigneeName ?? null,
        month,
        attendance: shift?.attendance ?? null,
      };
    })
    .sort((a, b) => b.at - a.at);
}
