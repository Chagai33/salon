// src/components/layout/ThemeToggle.tsx
//
// ⚠️ הועבר לכאן מ-App.tsx, כדי שאותו כפתור ישמש גם בכותרת הלוח.
// בהכרעת בעל המוצר 06/10: "האייקון של מצב כהה בדסקטופ ובנייד צריך להיות מחוץ
// לתפריט המבורגר". DOCS/PLANING/26

import { useState } from 'react';
import { t } from '../../i18n/dictionary';
import { applyTheme, storedTheme } from '../../utils/theme';
import type { Theme } from '../../utils/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme());
  const label = theme === 'dark' ? t.theme.toLight : t.theme.toDark;

  return (
    <button
      type="button"
      onClick={() => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-brand-soft hover:text-ink"
    >
      {/*
        ⚠️⚠️ אותו אייקון תמיד, ובלי שום שינוי בין המצבים.
        בעל המוצר, 06/10, פעמיים: "שיישאר אותו אייקון ורק יחליף מצבים", ואז
        "תחזיר לאייקון הקודם שבכל לחיצה עליו הוא מחליף את המצב מבלי שהוא עצמו
        ישתנה". ⚠️ ומה שמשתנה הוא השם הנגיש בלבד. DOCS/PLANING/26
        ⚠️ וסהר אינו אייקון כיווני, ולכן אינו מתהפך ב-RTL.
      */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
      </svg>
    </button>
  );
}
