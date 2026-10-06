// src/components/layout/SideMenu.tsx
//
// התפריט שבצד.
//
// ⚠️ מה שהיה פרוס בתחתית מסך העבודה יושב כאן: החברים, הייבוא, והגדרת הקוד.
// מסך העבודה נשאר עם ארבעה דברים: כותרת, רצועת הקוד, הלוח, המקרא.
// DOCS/PLANING/26
//
// ⚠️⚠️ והוא נצמד לקצה הסופי, כלומר לשמאל בעברית.
// inset-inline, ולא left. כלל הפרויקט הוא תכונות לוגיות. CLAUDE.md, עיצוב.

import { Button } from '../common/Button';
import { useEffect, useRef } from 'react';
import { t } from '../../i18n/dictionary';

interface Props {
  onClose: () => void;
  children: React.ReactNode;
}

export function SideMenu({ onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      /* ⚠️ ms-auto דוחף אותו לקצה הסופי. בעברית זה שמאל, ובלי שנכתוב left. */
      className="m-0 ms-auto h-dvh max-h-none w-[min(22rem,100vw)] max-w-none border-s border-line bg-surface p-0 text-ink shadow-soft backdrop:bg-ink/40"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="flex-1 text-base font-semibold text-ink">{t.menu.title}</h2>
          <Button tone="quiet" onClick={() => ref.current?.close()}>
            {t.menu.close}
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}

/** כפתור הפתיחה. ⚠️ נושא מילה ולא רק שלושה קווים. */
export function MenuButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-brand-soft"
    >
      <span aria-hidden="true" className="flex flex-col gap-[3px]">
        <span className="block h-0.5 w-4 rounded-full bg-ink" />
        <span className="block h-0.5 w-4 rounded-full bg-ink" />
        <span className="block h-0.5 w-4 rounded-full bg-ink" />
      </span>
      {t.menu.open}
    </button>
  );
}
