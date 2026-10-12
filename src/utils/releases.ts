// src/utils/releases.ts
//
// ⚠️ אזור ליבה. הדוח קורא שורות על אנשים אמיתיים, ומה שהוא אומר עליהם מגיע
// למנהלת. DOCS/PLANING/29-nothing-records-that-someone-cancelled.md
//
// ⚠️⚠️ ופונקציות טהורות ולא רכיב, בכוונה. ההכרעות שיושבות כאן הן מה שמבדיל
// בין כלי לבין כתב אישום, ולכן הן נבדקות בלי מסך:
//
//   1. מי שאיבד את המשמרת ולא מי שלחץ. שחרור בידי מנהלת אינו ביטול של החבר.
//   2. ⚠️ שחרור שאחריו אותו אדם חזר לאותה משמרת אינו נספר. בהכרעת בעל המוצר
//      12/10, סעיף 2: הדוח קיים כדי שהמנהלת תדבר עם האדם הנכון. רשומה 32.
//   3. ⚠️ "ברגע האחרון" הוא פחות מ-24 שעות לפני תחילת המשמרת. בהכרעת 12/10,
//      סעיף 3.
//   4. ⚠️ שלושה ערכים ל"משמרת אחרת באותו חודש", ולא שניים. חודש שעוד לא
//      נגמר אינו "לא עשה".
//   5. ⚠️ שורה לכל אדם בתוך חודש, ולא שורה לכל אירוע. בהכרעת 12/10, סעיף 1:
//      השאלה היא על אדם בתוך חודש. רשומה 33.

import type { Attendance, SalonEvent, Shift } from '../types';
// ⚠️ סיומת `.ts` מפורשת. בלעדיה `node --test --experimental-strip-types` אינו
// מוצא את המודול. tsconfig.app.json מתיר את זה במפורש.
import { fromDateKey, monthKeyOfDateKey, toMonthKey } from './dates.ts';

/** ⚠️ 24 שעות, בהכרעת בעל המוצר 12/10, סעיף 3. */
export const LATE_HOURS = 24;

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
   * ⚠️ שלילי פירושו אחרי שהמשמרת התחילה, ו-null פירושו שאי אפשר לחשב.
   */
  noticeHours: number | null;
  /** ⚠️ פחות מ-24 שעות, וגם אחרי שהמשמרת התחילה. */
  late: boolean;
  after: AfterVerdict;
  /** מי מחזיק את המשמרת עכשיו, כשמישהו לקח אותה. */
  afterMemberId: string | null;
  afterName: string | null;
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
 * האם לחבר יש משמרת באותו חודש.
 *
 * ⚠️ אותה נוסחה כמו הזכאות: משמרת שהוא מחזיק, או משמרת שהוא מסר בהחלפה
 * שהושלמה. DOCS/PLANING/10-shift-handover.md
 *
 * ⚠️ ואין כאן חריג למשמרת ששוחררה. שחרור שנספר הוא שחרור שהאדם לא חזר ממנו,
 * ולכן הוא אינו מחזיק אותה ממילא. וכשהוא חזר, השחרור אינו נספר בכלל.
 */
function holdsShiftInMonth(shifts: Shift[], memberId: string, monthKey: string): boolean {
  return shifts.some((shift) => {
    if (monthKeyOfDateKey(shift.date) !== monthKey) return false;
    if (shift.assigneeMemberId === memberId) return true;
    return shift.handoverFromMemberId === memberId && shift.handoverState === 'completed';
  });
}

/**
 * ⚠️⚠️ האם אחרי השחרור הזה אותו אדם חזר לאותה משמרת. רשומה 32.
 *
 * "חזר" הוא שורה מאוחרת יותר שבה הוא עצמו תפס את המשמרת, לפני שחרור נוסף
 * שלו. ⚠️ ובלי השורות, למשל משמרת שנתפסה לפני שהרשומה הייתה קיימת, המשמרת
 * עצמה מכריעה: אם הוא מחזיק אותה עכשיו, הוא חזר.
 */
function wasUndone(release: SalonEvent, events: SalonEvent[], shift: Shift | undefined): boolean {
  const memberId = release.subjectMemberId;
  if (!memberId || !release.shiftId) return false;

  const later = events
    .filter((event) => event.shiftId === release.shiftId && event.at > release.at)
    .sort((a, b) => a.at - b.at);

  for (const event of later) {
    const returned =
      (event.action === 'shiftAssigned' || event.action === 'handoverTaken') &&
      event.actorMemberId === memberId;
    if (returned) return true;
    // ⚠️ שחרור נוסף שלו קודם לחזרה כלשהי: השחרור הזה נשאר בתוקף, והבא אחריו
    // ייבדק בנפרד.
    if (event.action === 'shiftReleased' && event.subjectMemberId === memberId) return false;
  }

  return Boolean(shift) && shift!.assigneeMemberId === memberId;
}

/**
 * שורה לכל שחרור שנספר, האחרון ראשון.
 *
 * @param events  כל השורות שנקראו. ⚠️ לא רק שחרורים: כדי לדעת אם אדם חזר
 *                למשמרת צריך לראות גם את הלקיחות.
 * @param shifts  כל משמרות הסניף.
 */
export function releaseRows(events: SalonEvent[], shifts: Shift[]): ReleaseRow[] {
  const byId = new Map(shifts.map((shift) => [shift.id, shift]));

  return events
    .filter((event) => event.action === 'shiftReleased')
    .filter((event) => !wasUndone(event, events, event.shiftId ? byId.get(event.shiftId) : undefined))
    .map((event) => {
      const shift = event.shiftId ? byId.get(event.shiftId) : undefined;
      const date = event.shiftDate ?? shift?.date ?? null;
      const memberId = event.subjectMemberId ?? null;
      const noticeHours = date
        ? (startsAt(date, shift?.startTime) - event.at) / 3_600_000
        : null;

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
        noticeHours,
        late: noticeHours !== null && noticeHours < LATE_HOURS,
        after,
        afterMemberId: shift?.assigneeMemberId ?? null,
        afterName: shift?.assigneeName ?? null,
        attendance: shift?.attendance ?? null,
      };
    })
    .sort((a, b) => b.at - a.at);
}

export interface PersonRow {
  memberId: string;
  releases: number;
  /** ⚠️ כמה מהם בידי מנהלת. הם נספרים לאדם שאיבד את המשמרת, ומסומנים. */
  byManager: number;
  late: number;
  /** ⚠️ שוחררה ואין לה אחראי עד עכשיו. */
  uncovered: number;
  month: MonthVerdict;
  rows: ReleaseRow[];
}

export interface MonthReport {
  monthKey: string;
  /** משמרות החודש, ⚠️ בלי ימים שהמנהלת סגרה לחברים. */
  shifts: number;
  assigned: number;
  releases: number;
  people: number;
  late: number;
  uncovered: number;
  rows: PersonRow[];
}

/**
 * חודש אחד: ארבעה מספרים, ושורה לכל אדם ששחרר.
 *
 * ⚠️ השחרור שייך לחודש של המשמרת ולא לחודש שבו לחצו. שחרור ב-28 בספטמבר של
 * משמרת ב-2 באוקטובר הוא שחרור של אוקטובר, כי שם נשאלת שאלת הזכאות.
 *
 * @param shutDates ימים שהמנהלת סגרה לחברים. ⚠️ אין בהם משמרת, ולכן הם אינם
 *                  נספרים, בדיוק כמו בלוח. DOCS/PLANING/26
 */
export function monthReport(
  events: SalonEvent[],
  shifts: Shift[],
  monthKey: string,
  shutDates: Set<string> = new Set(),
  now: number = Date.now(),
): MonthReport {
  const inMonth = shifts.filter(
    (shift) => monthKeyOfDateKey(shift.date) === monthKey && !shutDates.has(shift.date),
  );
  const rows = releaseRows(events, shifts).filter(
    (row) => row.shiftDate !== null && monthKeyOfDateKey(row.shiftDate) === monthKey,
  );
  const monthEnded = monthKey < toMonthKey(new Date(now));

  const byPerson = new Map<string, ReleaseRow[]>();
  for (const row of rows) {
    if (!row.memberId) continue;
    const list = byPerson.get(row.memberId) ?? [];
    list.push(row);
    byPerson.set(row.memberId, list);
  }

  const people: PersonRow[] = [...byPerson.entries()].map(([memberId, list]) => {
    let month: MonthVerdict = 'monthOpen';
    if (holdsShiftInMonth(shifts, memberId, monthKey)) month = 'otherShift';
    // ⚠️ רק כאן אפשר לומר "לא עשה". חודש שעוד פתוח אינו תשובה.
    else if (monthEnded) month = 'none';

    return {
      memberId,
      releases: list.length,
      byManager: list.filter((row) => row.byManager).length,
      late: list.filter((row) => row.late).length,
      uncovered: list.filter((row) => row.after === 'open').length,
      month,
      rows: list,
    };
  });

  // ⚠️ מה שדורש תשומת לב ראשון: ברגע האחרון, ואחריו מה שנשאר בלי אחראי.
  people.sort(
    (a, b) => b.late - a.late || b.uncovered - a.uncovered || b.releases - a.releases,
  );

  return {
    monthKey,
    shifts: inMonth.length,
    assigned: inMonth.filter((shift) => shift.assigneeMemberId).length,
    releases: rows.length,
    people: people.length,
    late: rows.filter((row) => row.late).length,
    uncovered: rows.filter((row) => row.after === 'open').length,
    rows: people,
  };
}
