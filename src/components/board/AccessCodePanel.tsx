// src/components/board/AccessCodePanel.tsx
//
// ⚠️ אזור ליבה. קוד שנחשף לחבר שאינו זכאי הוא כשל במוצר.
// הפאנל אינו מחשב זכאות בעצמו: הוא מקבל את התשובה מ-utils/eligibility.

import type { CodeVisibility } from '../../utils/eligibility';
import { t } from '../../i18n/dictionary';
import { shortDateLabel } from '../../utils/dates';

interface Props {
  visibility: CodeVisibility;
}

export function AccessCodePanel({ visibility }: Props) {
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
          <p className="num mt-2 text-4xl font-bold tracking-[0.2em] text-ink">{code.code}</p>

          <p className="mt-2 text-xs text-ink-faint">
            {t.code.basedOn(eligibility.shiftDates.map(shortDateLabel))}
          </p>
          <p className="mt-1 text-xs text-ink-faint">{t.code.disclaimer}</p>

          {codeIsStale && (
            <p className="mt-2 rounded-md bg-shift-open px-3 py-2 text-xs text-shift-open-ink">
              {t.code.staleWarning}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
