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

/**
 * שם לכל חבר במסכי המנהלת, ⚠️ ומייל כששני אנשים נושאים אותו שם.
 *
 * בצילום של בעל המוצר, 12/10, `chagai yechiel` ו-`Chagai yechiel` היו שני
 * חשבונות Google, ולא היה אפשר להבחין ביניהם. רשומה 32. ⚠️ וההשוואה בלי
 * אותיות גדולות, כי זה בדיוק ההבדל שהיה שם.
 *
 * ⚠️ ולמנהלת מותר לראות את המייל, רשומה 22. זה אינו נכון לחבר, ולכן זה אינו
 * משמש בשום מסך שחבר רואה.
 */
export interface ManagerLabel {
  name: string;
  /** ⚠️ רק כששני אנשים נושאים אותו שם. אחרת null. */
  email: string | null;
}

/*
  ⚠️⚠️ השם והמייל בנפרד, ולא במחרוזת אחת.
  "שם (מייל)" במחרוזת אחת גלש מעמודת השם בטלפון: מייל הוא מילה אחת ארוכה,
  והוא נדחס לעמודה של 30%. בצילום של בעל המוצר, 12/10. רשומה 34.
*/
export function managerLabels(
  members: { id: string; displayName: string; email?: string }[],
): Map<string, ManagerLabel> {
  const count = new Map<string, number>();
  for (const member of members) {
    const key = fullName(member.displayName).toLocaleLowerCase();
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  const out = new Map<string, ManagerLabel>();
  for (const member of members) {
    const name = fullName(member.displayName);
    const shared = (count.get(name.toLocaleLowerCase()) ?? 0) > 1;
    out.set(member.id, { name, email: shared && member.email ? member.email : null });
  }
  return out;
}

/** ⚠️ לשורה אחת בלבד, כמו אפשרות ברשימה נפתחת. בטבלה המייל בשורה משלו. */
export function labelText(label: ManagerLabel | undefined): string {
  if (!label) return '';
  return label.email ? `${label.name} (${label.email})` : label.name;
}

/** השם הפרטי בלבד, לפנייה. `שלום, דנה`. */
export function firstName(raw: string): string {
  const [first] = fullName(raw).split(/\s+/u);
  return first || fullName(raw);
}
