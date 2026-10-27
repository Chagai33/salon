// src/utils/importMonths.ts
//
// ⚠️⚠️ איזה חודש הלוח שהועלה, והאפליקציה היא שמכריעה.
//
// **עד 27/10/2026 ההנחיה אמרה למודל "והחזר אותו רק אם החודש שבו תואם".**
// ⚠️ וזו הייתה הוראה לסנן שניתנה למודל, **ושורה שהוא מחק בעצמו לא הגיעה לשום
// מונה.** ובמקרה הגרוע היא גם עלתה 164 שניות של המתנה לתשובה ריקה, כי המודל
// חיפש מה שאינו שם. DOCS/PLANING/57
//
// **ומ-27/10 המודל מחזיר את מה שהוא רואה**, והפרדה הזאת היא מה שמחליף את
// הסינון: הימים של החודש שנבחר, והימים של חודש אחר.
//
// ⚠️⚠️ **והייבוא כותב רק לחודש שנבחר.** המסך מציע לעבור לחודש האחר, **ואינו
// כותב אליו בשקט.**
//
// ⚠️ וזה קובץ של פונקציות טהורות, ב-`src/utils` ולא בשירות, כדי שהבדיקה לא
// תגרור את Firebase.

import type { ImportedDay } from '../services/importService';

export interface MonthSplit {
  /** הימים של החודש שמוצג עכשיו. ⚠️ ורק הם נכתבים. */
  chosen: ImportedDay[];
  /** הימים של כל חודש אחר, בסדר שהם נקראו. */
  other: ImportedDay[];
  /**
   * ⚠️ החודש האחר שיש לו הכי הרבה ימים, והוא זה שמוצע למנהלת.
   *
   * `undefined` כשאין אף יום של חודש אחר. ⚠️ **ובתיקו נבחר המוקדם**, כדי
   * שההצעה תהיה קבועה ולא תשתנה בין קריאה לקריאה.
   */
  suggested?: string;
}

/** `2026-11-03` אל `2026-11`. */
function monthOf(day: ImportedDay): string {
  return day.date.slice(0, 7);
}

/**
 * מפריד את מה שנקרא לפי החודש שמוצג.
 *
 * ⚠️ ושלושת המצבים של המסך נגזרים מהתוצאה ואינם שדה נוסף:
 * הכול בחודש הנבחר, הכול בחודש אחר, או מעורב.
 */
export function splitByMonth(days: ImportedDay[], monthKey: string): MonthSplit {
  const chosen: ImportedDay[] = [];
  const other: ImportedDay[] = [];

  for (const day of days) {
    if (monthOf(day) === monthKey) chosen.push(day);
    else other.push(day);
  }

  const counts = new Map<string, number>();
  for (const day of other) {
    const month = monthOf(day);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  let suggested: string | undefined;
  let best = 0;
  for (const month of [...counts.keys()].sort()) {
    const count = counts.get(month) ?? 0;
    if (count > best) {
      best = count;
      suggested = month;
    }
  }

  return { chosen, other, suggested };
}
