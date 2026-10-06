// src/components/board/AccessCodePanel.tsx
//
// ⚠️ אזור ליבה. קוד שנחשף לחבר שאינו זכאי הוא כשל במוצר.
// הפאנל אינו מחשב זכאות בעצמו: הוא מקבל את התשובה מ-utils/eligibility.
//
// ⚠️⚠️ ו-`compact` הוא צורה ולא הרשאה. מי רואה את הקוד ומתי נקבע ב-
// codeVisibilityFor בלבד, ושתי הצורות מקבלות את אותה תשובה.
// לחבר הקוד הוא העיקר ולכן הוא גדול ובראש המסך. למנהלת הוא מידע נגיש.

import { useState } from 'react';
import type { CodeVisibility } from '../../utils/eligibility';
import { t } from '../../i18n/dictionary';
import { shortDateLabel } from '../../utils/dates';

import { toReadableError } from '../../utils/errors';

interface Props {
  visibility: CodeVisibility;
  compact?: boolean;
  /**
   * ⚠️ להגדיר קוד ולראות קוד הם שני דברים נפרדים, ובכוונה.
   *
   * מנהלת שלא השתבצה החודש אינה זכאית לראות את הקוד, והיא כן זו שמגדירה
   * אותו. לכן הטופס אינו תלוי ב-canSee, ושום דבר כאן אינו משנה את הזכאות.
   * DOCS/PLANING/15-the-code-is-not-enforced-yet.md
   */
  onSetCode?: (code: string) => Promise<void>;
}

function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          // ⚠️ "הועתק" מוצג רק אחרי העתקה שהצליחה בפועל. כפתור שאומר הועתק
          // כשהלוח חסום הוא שקר קטן שמתגלה רק כשמדביקים.
          //
          // ⚠️ ו-navigator.clipboard אינו קיים בהקשר שאינו מאובטח. הטיפוסים
          // מבטיחים שהוא תמיד שם, והדפדפן לא.
          const clipboard = navigator.clipboard as Clipboard | undefined;
          if (!clipboard) {
            setState('failed');
            return;
          }
          void clipboard
            .writeText(value)
            .then(() => setState('done'))
            .catch(() => setState('failed'));
        }}
        className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-brand-soft"
      >
        {state === 'done' ? t.code.copied : t.code.copy}
      </button>
      {/* ⚠️ role="status" ולא טקסט שקט: "הועתק" צריך להישמע, לא רק להיראות. */}
      <span role="status" aria-live="polite" className="text-xs text-danger">
        {state === 'failed' ? t.code.copyFailed : ''}
      </span>
    </div>
  );
}

/** הטופס שבו המנהלת מגדירה את הקוד. ⚠️ לא היה קיים, והפונקציה הייתה כתובה. */
function SetCodeForm({ onSetCode }: { onSetCode: (code: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-sm text-brand underline-offset-4 hover:underline"
      >
        {t.manager.setCode}
      </button>
    );
  }

  return (
    <form
      className="mt-3 border-t border-line pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        const next = value.trim();
        if (next.length < 3) {
          setProblem(t.manager.codeTooShort);
          return;
        }
        setBusy(true);
        setProblem(null);
        void onSetCode(next)
          .then(() => {
            setDone(true);
            setValue('');
            setOpen(false);
          })
          .catch((error: unknown) => setProblem(toReadableError(error, t.errors.saveFailed)))
          .finally(() => setBusy(false));
      }}
    >
      <label className="block text-sm text-ink-soft" htmlFor="new-code">
        {t.manager.setCode}
      </label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {/* ⚠️ dir="ltr" ו-inputMode numeric: הקוד הוא מספר, והוא נקרא משמאל. */}
        <input
          id="new-code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t.manager.codePlaceholder}
          aria-required="true"
          aria-invalid={problem ? 'true' : 'false'}
          aria-describedby="new-code-hint new-code-error"
          className="num w-28 rounded-card border border-line-strong bg-surface px-3 py-2 text-start text-ink"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-card bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-50"
        >
          {busy ? t.manager.saving : t.manager.save}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setProblem(null);
          }}
          className="rounded-card px-3 py-2 text-sm text-ink-soft hover:underline"
        >
          {t.salons.cancel}
        </button>
      </div>

      <p id="new-code-hint" className="mt-2 text-xs text-ink-faint">
        {t.manager.setCodeHint}
      </p>

      <p id="new-code-error" role="alert" className="mt-2 text-xs text-danger">
        {problem ?? ''}
      </p>
      {done && <p className="mt-2 text-xs text-shift-mine-ink">{t.manager.saved}</p>}
    </form>
  );
}

export function AccessCodePanel({ visibility, compact = false, onSetCode }: Props) {
  const { canSee, code, eligibility, codeIsStale } = visibility;

  return (
    <section
      className="rounded-card border border-line bg-surface p-4 shadow-soft"
      aria-labelledby="access-code-title"
    >
      <h2 id="access-code-title" className="text-sm font-semibold text-ink-soft">
        {t.code.title}
      </h2>

      {!code && <p className="mt-2 text-sm text-ink-soft">{t.code.noCode}</p>}

      {code && !canSee && (
        <div className="mt-2">
          <p className="text-sm font-medium text-ink">{t.code.notEligible}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.code.notEligibleHint}</p>
        </div>
      )}

      {code && canSee && (
        <div className="mt-2">
          <p className="text-sm text-ink-soft">
            {eligibility.reason === 'handedOver' ? t.code.eligibleByHandover : t.code.eligible}
          </p>

          {/*
            ⚠️ dir="ltr" דרך .num, והוא הדבר החשוב ביותר במסך הזה.
            קוד שמסתדר הפוך הוא קוד אחר שנראה סביר.
          */}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p
              className={`num font-bold text-ink ${
                compact ? 'text-2xl tracking-[0.15em]' : 'text-4xl tracking-[0.2em]'
              }`}
            >
              {code.code}
            </p>
            <CopyButton value={code.code} />
          </div>

          {/* ⚠️ אצל המנהלת שתי השורות האלה אינן נחוצות: היא יודעת מה הקוד
              ומי הגדיר אותו. אצל חבר הן מה שמסביר למה הוא רואה אותו. */}
          {!compact && (
            <>
              <p className="mt-2 text-xs text-ink-faint">
                {t.code.basedOn(eligibility.shiftDates.map(shortDateLabel))}
              </p>
              <p className="mt-1 text-xs text-ink-faint">{t.code.disclaimer}</p>
            </>
          )}

          {codeIsStale && (
            <p className="mt-2 rounded-card bg-shift-open px-3 py-2 text-xs text-shift-open-ink">
              {t.code.staleWarning}
            </p>
          )}
        </div>
      )}

      {/* ⚠️ מחוץ לשלושת המצבים למעלה, ובכוונה: גם כשאין קוד וגם כשהמנהלת
          אינה זכאית לראות אותו, היא זו שמגדירה אותו. */}
      {onSetCode && <SetCodeForm onSetCode={onSetCode} />}
    </section>
  );
}
