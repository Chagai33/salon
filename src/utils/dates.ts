// src/utils/dates.ts
//
// המקום היחיד שבו נבנה פורמט תאריך או שעה.
// אל תכתוב פורמטר משלך, ואל תציג שעה בלי הפונקציות כאן.

/** ⚠️ אפס הוא ראשון, בכל המוצר. זה אינו `Date.getDay` במקרה, זה בכוונה. */
export const WEEKDAY_SUNDAY = 0;

export const WEEKDAY_NAMES = [
  'ראשון',
  'שני',
  'שלישי',
  'רביעי',
  'חמישי',
  'שישי',
  'שבת',
] as const;

const MONTH_NAMES = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
] as const;

/**
 * `2026-10-08` ללא אזור זמן.
 *
 * ⚠️ נבנה מהחלקים המקומיים ולא מ-toISOString. toISOString ממיר ל-UTC, ובישראל
 * זה מקדים את התאריך ביום שלם אחרי חצות.
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** `2026-10` */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthKeyOfDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function dayNumber(dateKey: string): number {
  return Number(dateKey.slice(8, 10));
}

export function weekdayOf(dateKey: string): number {
  return fromDateKey(dateKey).getDay();
}

/** `8 באוקטובר` */
export function shortDateLabel(dateKey: string): string {
  const date = fromDateKey(dateKey);
  return `${date.getDate()} ב${MONTH_NAMES[date.getMonth()]}`;
}

export function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return toMonthKey(date);
}

/** כל התאריכים בחודש שנופלים על אחד מימי השבוע שנתבקשו. */
export function datesInMonth(monthKey: string, weekdays: number[]): string[] {
  const [year, month] = monthKey.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= last; day += 1) {
    const date = new Date(year, month - 1, day);
    if (weekdays.includes(date.getDay())) out.push(toDateKey(date));
  }
  return out;
}

/**
 * החודש מחולק לשבועות, כפי שהגיליון מציג אותו.
 *
 * כל שבוע הוא מערך באורך ימי השבוע הפעילים, ותא ריק הוא יום שאינו בחודש.
 * זה מה שמחזיק את צורת הטבלה: שורה לשבוע, עמודה ליום.
 */
export function weeksOfMonth(monthKey: string, weekdays: number[]): (string | null)[][] {
  const active = [...weekdays].sort((a, b) => a - b);
  const dates = datesInMonth(monthKey, active);
  if (dates.length === 0) return [];

  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = active.map(() => null);
  let lastIndex = -1;

  for (const dateKey of dates) {
    const index = active.indexOf(weekdayOf(dateKey));
    if (index <= lastIndex) {
      weeks.push(week);
      week = active.map(() => null);
    }
    week[index] = dateKey;
    lastIndex = index;
  }
  weeks.push(week);
  return weeks;
}

export function isPast(dateKey: string): boolean {
  return dateKey < toDateKey(new Date());
}

export function isToday(dateKey: string): boolean {
  return dateKey === toDateKey(new Date());
}
