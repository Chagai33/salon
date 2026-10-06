// src/utils/names.ts
//
// ⚠️ השם שמגיע מ-Google הוא מה שאדם כתב לעצמו בפרופיל, ולא שם.
// "Chagai yechiel (Aum.Music)" הוא שם אמיתי מהשטח, והוא חזר שלושים פעמים
// על לוח אחד והשתלט עליו.
//
// ⚠️ וזו קיצור לתצוגה בלבד. השם המלא נשמר במסד ומוצג במסך החברים, שם המנהלת
// צריכה לזהות אדם ולא לסרוק לוח.

/** מוריד סיומת בסוגריים. `דנה שמש (עיצוב)` הופך ל-`דנה שמש`. */
export function displayName(raw: string): string {
  const withoutSuffix = raw.replace(/\s*[([{].*$/u, '').trim();
  return withoutSuffix || raw.trim();
}

/** השם הפרטי בלבד, לפנייה. `שלום, דנה`. */
export function firstName(raw: string): string {
  const [first] = displayName(raw).split(/\s+/u);
  return first || displayName(raw);
}
