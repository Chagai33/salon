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

interface Props {
  visibility: CodeVisibility;
  compact?: boolean;
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
      {state === 'failed' && (
        <span role="alert" className="text-xs text-danger">
          {t.code.copyFailed}
        </span>
      )}
    </div>
  );
}

export function AccessCodePanel({ visibility, compact = false }: Props) {
  const { canSee, code, eligibility, codeIsStale } = visibility;

  return (
    <section
      className="rounded-xl border border-line bg-surface p-4"
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
            <p className="mt-2 rounded-lg bg-shift-open px-3 py-2 text-xs text-shift-open-ink">
              {t.code.staleWarning}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
