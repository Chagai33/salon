// src/utils/theme.ts
//
// ⚠️ בהיר וכהה, ושניהם בבחירה של המשתמש ולא של מערכת ההפעלה.
//
// קודם המצב נגזר מ-prefers-color-scheme, ומי שהמערכת שלו כהה לא ראה את המצב
// הבהיר אף פעם ולא הייתה לו דרך להגיע אליו. ואז הורדתי את הכהה לגמרי, וזו
// הייתה טעות בכיוון השני: שני המצבים נדרשים, והבחירה היא של מי שמסתכל.

export type Theme = 'light' | 'dark';

const KEY = 'hasalon:theme';

/** ⚠️ localStorage נכשל בחלון פרטי ובדפדפן שחוסם אחסון. בהיר הוא ברירת המחדל. */
export function storedTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // בחירה שלא נשמרת עדיין עובדת לאורך הביקור הזה.
  }
}
