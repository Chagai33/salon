// src/components/layout/Footer.tsx
//
// ⚠️ מינימליסטי וממורכז, בהכרעת בעל המוצר.
//
// ⚠️⚠️ ושם העמותה אינו כאן. הוא היה, וזה היה מטעה: בלשון בעל המוצר
// "אני לא יוצאים לשינוי וזה לא אתר רשמי". ההסתייגות עצמה יושבת בתנאי השימוש.
//
// ⚠️ וגם הגרסה אינה כאן. היא הייתה, ובעל המוצר ראה אותה 06/10 ואמר "זה לא
// נראה טוב, אני מעדיף שאת הגרסה תכניס בתוך תנאי השימוש". שני קישורים, וזהו.
// DOCS/PLANING/26

import { Link } from 'react-router-dom';
import { t } from '../../i18n/dictionary';

export function Footer() {
  const link = 'underline-offset-4 hover:text-ink hover:underline';

  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-6 text-sm text-ink-faint">
      <Link to="/terms" className={link}>
        {t.footer.terms}
      </Link>
      <span aria-hidden="true">·</span>
      <Link to="/privacy" className={link}>
        {t.footer.privacy}
      </Link>

    </footer>
  );
}
