// src/components/common/Sheet.tsx
//
// חלון שנפתח מעל המסך.
//
// ⚠️ dialog אמיתי ולא div עם position. showModal נותן מלכודת מיקוד, סגירה
// ב-Escape, ורקע שאי אפשר ללחוץ דרכו, בלי שנכתוב אף אחד מהם.
//
// ⚠️⚠️ ובטלפון הוא נצמד לתחתית ולא ממורכז.
// רוב השימוש הוא בטלפון, ויד אחת מגיעה לתחתית המסך ולא למרכזו.
// DOCS/PLANING/26

import { useEffect, useRef } from 'react';
import { t } from '../../i18n/dictionary';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** כותרת תחתונה נעוצה. ⚠️ שם יושבת פעולת השמירה, ולא בסוף גלילה ארוכה. */
  footer?: React.ReactNode;
}

export function Sheet({ title, onClose, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      /* ⚠️ לחיצה על הרקע סוגרת. היעד הוא ה-dialog עצמו רק כשלחצו מחוצה לו. */
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full rounded-t-2xl border border-line bg-surface p-0 text-ink shadow-soft backdrop:bg-ink/40 sm:m-auto sm:max-h-[85dvh] sm:w-[min(42rem,92vw)] sm:rounded-card"
    >
      <div className="flex max-h-[92dvh] flex-col sm:max-h-[85dvh]">
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="flex-1 text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="min-h-11 min-w-11 rounded-lg text-sm text-ink-soft hover:bg-brand-soft"
          >
            {t.menu.close}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

        {footer && (
          <footer className="shrink-0 border-t border-line bg-surface px-4 py-3">{footer}</footer>
        )}
      </div>
    </dialog>
  );
}
