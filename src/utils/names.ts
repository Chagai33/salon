// src/utils/names.ts
//
// ⚠️ השם שמגיע מ-Google הוא מה שאדם כתב לעצמו בפרופיל, ולא שם.
// "Chagai yechiel (Aum.Music)" הוא שם אמיתי מהשטח, והוא חזר שלושים פעמים
// על לוח אחד והשתלט עליו.
//
// ⚠️⚠️ ובהכרעת בעל המוצר 06/10: מה שחברי האופן ספייס רואים הוא שם פרטי ואות
// ראשונה של שם המשפחה. זו גם קריאות וגם צמצום: השם המלא אינו נדרש כדי לדעת
// מי משובץ למשמרת.
//
// ⚠️ והשם המלא נשמר במסד ומוצג במסך החברים, שם המנהלת צריכה לזהות אדם.

/** מוריד סיומת בסוגריים. `דנה שמש (עיצוב)` הופך ל-`דנה שמש`. */
export function fullName(raw: string): string {
  const withoutSuffix = raw.replace(/\s*[([{].*$/u, '').trim();
  return withoutSuffix || raw.trim();
}

/**
 * השם שחבר רואה. `דנה שמש` הופך ל-`דנה ש.`
 *
 * ⚠️ ושם של מילה אחת נשאר כמו שהוא, בלי נקודה. "דנה." נראה כמו טעות.
 */
export function displayName(raw: string): string {
  const parts = fullName(raw).split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return raw.trim();
  if (parts.length === 1) return parts[0];
  const [first, second] = parts;
  return `${first} ${second[0]}.`;
}

/** השם הפרטי בלבד, לפנייה. `שלום, דנה`. */
export function firstName(raw: string): string {
  const [first] = fullName(raw).split(/\s+/u);
  return first || fullName(raw);
}
