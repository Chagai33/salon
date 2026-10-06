// src/utils/hebrew.ts
//
// שם החג של יום לועזי, ומה מצב הגישה שלו.
//
// ⚠️ הטבלה הועברה מ-`tools/hebrew-closures.mjs`, שנמדד מול הגיליון: 11 מתוך
// 11 ימי החול נמצאו בו. DOCS/PLANING/14-the-hebrew-calendar.md
//
// ⚠️⚠️ ומה שהטבלה אינה: היא אינה לוח חגים ואינה קובעת מדיניות.
// רשומה 14 מסיימת במשפט "הטבלה היא הצעה שהמנהלת מאשרת", ולכן כאן היא מספקת
// **שם בלבד.** מצב הגישה נקרא מרשומת היום שהמנהלת כתבה, ואם אין כזו היום
// נחשב פתוח. שלושה חגים שהנחתי שהסלון סוגר בהם היו פתוחים ומשובצים בגיליון,
// וזה בדיוק למה שם ומדיניות מופרדים כאן.
//
// ⚠️ ו-`Intl` עם לוח `ca-hebrew` מובנה, ואין כאן תלות. `@hebcal` הוא GPL-2.0.

import type { ActivityDay, MemberAccess, PublicAccess } from '../types';
import { weekdayOf } from './dates';

const MONTH = {
  TISHRI: 'Tishri',
  NISAN: 'Nisan',
  SIVAN: 'Sivan',
  ADAR: 'Adar',
  ADAR_II: 'Adar II',
} as const;

/** שם בלבד. ⚠️ בלי `publicAccess` ובלי `memberAccess`, בכוונה. */
const NAMED_DAYS: { name: string; month: string; day: number; days: number }[] = [
  { name: 'ראש השנה', month: MONTH.TISHRI, day: 1, days: 2 },
  { name: 'ערב יום כיפור', month: MONTH.TISHRI, day: 9, days: 1 },
  { name: 'יום כיפור', month: MONTH.TISHRI, day: 10, days: 1 },
  { name: 'סוכות', month: MONTH.TISHRI, day: 15, days: 1 },
  { name: 'חול המועד סוכות', month: MONTH.TISHRI, day: 16, days: 5 },
  { name: 'שמחת תורה', month: MONTH.TISHRI, day: 22, days: 1 },
  { name: 'פורים', month: MONTH.ADAR, day: 14, days: 1 },
  { name: 'ליל הסדר', month: MONTH.NISAN, day: 14, days: 1 },
  { name: 'פסח', month: MONTH.NISAN, day: 15, days: 1 },
  { name: 'חול המועד פסח', month: MONTH.NISAN, day: 16, days: 5 },
  { name: 'שביעי של פסח', month: MONTH.NISAN, day: 21, days: 1 },
  { name: 'ליל שבועות', month: MONTH.SIVAN, day: 5, days: 1 },
  { name: 'שבועות', month: MONTH.SIVAN, day: 6, days: 1 },
];

const HEBREW_PARTS = new Intl.DateTimeFormat('en-US-u-ca-hebrew', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

function hebrewOf(utcMillis: number): { month: string; day: number } {
  const parts = Object.fromEntries(
    HEBREW_PARTS.formatToParts(new Date(utcMillis)).map((p) => [p.type, p.value]),
  );
  return { month: String(parts.month), day: Number(parts.day) };
}

const DAY = 86_400_000;

/**
 * שמות החגים של חודש לועזי, לפי תאריך.
 *
 * ⚠️ סריקה של החודש ולא חישוב הפוך. היא רצה פעם לחודש, והיא קלה לאימות.
 * מימוש אלגוריתם הלוח העברי הוא בדיוק מה שאנחנו לא רוצים לכתוב.
 */
export function namedDaysOfMonth(monthKey: string): Map<string, string> {
  const [year, month] = monthKey.split('-').map(Number);
  const names = new Map<string, string>();

  // ⚠️ מתחיל חמישה ימים לפני החודש, כי חג שמתחיל בסוף החודש הקודם נמשך לתוכו.
  const start = Date.UTC(year, month - 1, 1, 12) - 5 * DAY;
  const end = Date.UTC(year, month, 1, 12) + DAY;

  for (let t = start; t < end; t += DAY) {
    const hebrew = hebrewOf(t);
    for (const named of NAMED_DAYS) {
      const matches =
        hebrew.month === named.month ||
        (named.month === MONTH.ADAR && hebrew.month === MONTH.ADAR_II);
      if (!matches || hebrew.day !== named.day) continue;

      for (let i = 0; i < named.days; i += 1) {
        const date = new Date(t + i * DAY);
        const key = date.toISOString().slice(0, 10);
        if (key.startsWith(monthKey) && !names.has(key)) names.set(key, named.name);
      }
    }
  }
  return names;
}

export const WEEKDAY_FRIDAY = 5;
export const WEEKDAY_SATURDAY = 6;

/** שישי ושבת. ⚠️ בהכרעת בעל המוצר 06/10: סגור למי שאינו חבר אופן ספייס. */
export function isWeekend(dateKey: string): boolean {
  const weekday = weekdayOf(dateKey);
  return weekday === WEEKDAY_FRIDAY || weekday === WEEKDAY_SATURDAY;
}

export interface DayAccess {
  publicAccess: PublicAccess;
  memberAccess: MemberAccess;
  closesAt?: string;
  /** מאיפה המצב בא. ⚠️ זה מה שמונע הצגת הצעה כאילו היא החלטה. */
  from: 'manager' | 'weekend' | 'default';
  /** שם החג, אם יש. מידע, ולא מדיניות. */
  name?: string;
  /** ההערה שהמנהלת כתבה ליום. */
  note?: string;
}

/**
 * מצב הגישה של יום, בסדר עדיפות אחד ויחיד.
 *
 * 1. ⚠️ מה שהמנהלת כתבה. זו מדיניות, והיא מנצחת תמיד.
 * 2. שישי ושבת: סגור לציבור ופתוח לחברים.
 * 3. פתוח.
 *
 * ⚠️⚠️ ושם החג אינו משתתף בהכרעה. הוא נוסף לתשובה כמידע, וגם אם היום הוא יום
 * כיפור, כל עוד המנהלת לא כתבה רשומה ליום הזה, המוצר אינו טוען שהסלון סגור.
 */
export function dayAccessOf(
  dateKey: string,
  stored: ActivityDay | undefined,
  name: string | undefined,
): DayAccess {
  if (stored) {
    return {
      publicAccess: stored.publicAccess,
      memberAccess: stored.memberAccess,
      closesAt: stored.closesAt,
      from: 'manager',
      name,
      note: stored.note,
    };
  }

  if (isWeekend(dateKey)) {
    return { publicAccess: 'closed', memberAccess: 'open', from: 'weekend', name };
  }

  return { publicAccess: 'open', memberAccess: 'open', from: 'default', name };
}
