// src/components/layout/Footer.tsx
//
// ⚠️ מינימליסטי, בהכרעת בעל המוצר. שורה אחת, ואינה מתחרה בתוכן.

import { Link } from 'react-router-dom';
import { t } from '../../i18n/dictionary';

export function Footer() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-6 text-sm text-ink-faint">
      <span>{t.footer.org}</span>
      <span aria-hidden="true">·</span>
      <Link to="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
        {t.footer.privacy}
      </Link>
    </footer>
  );
}
