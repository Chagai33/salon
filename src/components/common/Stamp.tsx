// src/components/common/Stamp.tsx
//
// תאריך ושעה בתוך עברית, וטווח שעות.
//
// ⚠️⚠️ רק הספרות ב-`num`, ושם החודש בזרם העברי.
// `num` הוא בלוק משמאל לימין, ועברית בתוכו מסודרת הפוך: "12 באוקטובר, 13:21"
// נקרא "באוקטובר, 13:21 12". זה קרה בשני המסכים של המנהלת, רשומה 31, והאזהרה
// הייתה כתובה כבר ב-SalonsPage.
//
// ⚠️ ו-`whitespace-nowrap` על טווח השעות. בתא צר `18:00-22:00` נשבר במקף לשתי
// שורות, וזה נקרא כמו שני ערכים.

import { shortDateLabel, timeOf, toDateKey } from '../../utils/dates';

/** `12 באוקטובר, 13:21`. */
export function Stamp({ at }: { at: number }) {
  return (
    <>
      {shortDateLabel(toDateKey(new Date(at)))},{' '}
      <span className="num whitespace-nowrap">{timeOf(at)}</span>
    </>
  );
}

/** `18:00-22:00`. ⚠️ מקף טווח ולא מקף מפריד, כמו בכל הלוח. */
export function TimeRange({ from, to }: { from: string; to: string }) {
  return (
    <span className="num whitespace-nowrap">
      {from}-{to}
    </span>
  );
}
