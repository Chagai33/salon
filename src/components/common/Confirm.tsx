// src/components/common/Confirm.tsx
//
// אישור לפעולה שאי אפשר לבטל בלחיצה אחת.
//
// ⚠️⚠️ ולא `window.confirm`, בהכרעת בעל המוצר 06/10: "בכפוף לחלון אישור של
// האפליקציה ולא של הדפדפן". חלון של הדפדפן אינו בעברית בהכרח, אינו RTL, ואינו
// נושא את שם הפעולה. DOCS/PLANING/26
//
// ⚠️ ו-dialog אמיתי: מלכודת מיקוד, Escape, ורקע שאי אפשר ללחוץ דרכו.

import { useEffect, useRef } from 'react';
import { t } from '../../i18n/dictionary';

interface Props {
  title: string;
  body: string;
  /** ⚠️ נושא את שם הפעולה ולא "אישור". כפתור אומר מה הוא עושה. */
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirm({ title, body, confirmLabel, busy = false, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[min(26rem,92vw)] rounded-card border border-line bg-surface p-0 text-ink shadow-soft backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="text-sm leading-relaxed text-ink-soft">{body}</p>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="min-h-11 rounded-card bg-danger px-4 text-sm font-semibold text-brand-ink disabled:opacity-50"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => ref.current?.close()}
            className="min-h-11 rounded-card px-3 text-sm text-ink-soft hover:underline disabled:opacity-50"
          >
            {t.salons.cancel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
