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
   * ⚠️ שורה בכותרת ולא כרטיס.
   * בעל המוצר מדד על מסך 14 אינץ, 06/10: הכרטיס תפס גובה 230 פיקסלים לארבע
   * ספרות, ובתוכו ארבע שורות שאומרות כמעט אותו דבר. DOCS/PLANING/26
   */
  inline?: boolean;
  /**
   * ⚠️ הטופס בלבד, בלי הקוד.
   * בהכרעת בעל המוצר 06/10: "בתפריט המבורגר אין טעם להציג את הקוד אלא רק
   * כפתור החלפת הקוד". הקוד כבר מוצג בכותרת. DOCS/PLANING/26
   */
  formOnly?: boolean;
  /**
   * ⚠️ להגדיר קוד ולראות קוד הם שני דברים נפרדים, ובכוונה.
   *
   * מנהלת שלא השתבצה החודש אינה זכאית לראות את הקוד, והיא כן זו שמגדירה
   * אותו. לכן הטופס אינו תלוי ב-canSee, ושום דבר כאן אינו משנה את הזכאות.
   * DOCS/PLANING/15-the-code-is-not-enforced-yet.md
   */
  onSetCode?: (code: string) => Promise<void>;
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
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-ink disabled:opacity-50"
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

export function AccessCodePanel({
  visibility,
  compact = false,
  inline = false,
  formOnly = false,
  onSetCode,
}: Props) {
  const { canSee, code, eligibility, codeIsStale } = visibility;

  if (formOnly) {
    return onSetCode ? <SetCodeForm onSetCode={onSetCode} /> : null;
  }

  if (inline) {
    /*
      ⚠️ שלוש מילים ומספר, ובלי חזרות.
      "קוד הכניסה", "הקוד שלך החודש", "6 משמרות החודש" ו"זה הקוד שמנהלת הסלון
      הגדירה" הן ארבע שורות על אותו דבר. מה שנשאר: התווית, הקוד, והעתקה.
      ⚠️ וההסתייגות עברה ל-title, כדי שתהיה זמינה ולא תתפוס שורה.
    */
    if (!code) {
      return <span className="text-sm text-ink-faint">{t.code.noCode}</span>;
    }

    if (!canSee) {
      return (
        <span className="text-sm text-ink-soft" title={t.code.notEligibleHint}>
          {t.code.notEligible}
        </span>
      );
    }

    return (
      <span className="flex items-center gap-2" title={`${t.code.title}. ${t.code.disclaimer}`}>
        {/* ⚠️ בלי המילים "קוד הכניסה", בהכרעת בעל המוצר 06/10, ובשתי
            התצוגות. השם יושב ב-title וב-sr-only. */}
        <span className="sr-only">{t.code.title}</span>
        {/*
          ⚠️ dir="ltr" דרך .num. קוד שמסתדר הפוך הוא קוד אחר שנראה סביר.
          ⚠️⚠️ ובלי כפתור העתקה, בהכרעת בעל המוצר 06/10: "מיותר לחלוטין".
          ארבע ספרות נקראות ומוקלדות, ולא מועתקות ללוח. DOCS/PLANING/26
          ⚠️ ו-select-all כדי שסימון בעכבר יתפוס את הקוד כולו.
        */}
        {/* ⚠️ הוקטן, בהכרעת בעל המוצר 06/10: "קצת חורג מהגודל ההגיוני". */}
        <span className="num select-all text-lg font-bold tracking-[0.1em] text-ink">
          {code.code}
        </span>
        {/* ⚠️ אזהרת קוד ישן נשארת, והיא נקודה ולא פסקה. */}
        {codeIsStale && (
          <span className="size-2 rounded-full bg-shift-open-line" title={t.code.staleWarning} />
        )}
      </span>
    );
  }

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
          {/* ⚠️ בלי כפתור העתקה, בהכרעת בעל המוצר 06/10. select-all כדי
              שסימון בעכבר יתפוס את הקוד כולו. */}
          <p
            className={`num mt-2 select-all font-bold text-ink ${
              compact ? 'text-2xl tracking-[0.15em]' : 'text-4xl tracking-[0.2em]'
            }`}
          >
            {code.code}
          </p>

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
