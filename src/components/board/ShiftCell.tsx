// src/components/board/ShiftCell.tsx
//
// תא משמרת אחד.
//
// ⚠️ כפתור, ולא div שאפשר ללחוץ עליו. מקלדת מגיעה אליו וקורא מסך מקריא את מה
// שהוא עושה. DOCS/PLANING/03-the-design-standard.md
//
// ⚠️⚠️ ומקום השם ריק כשאין משובץ, ולא נושא את המילה "פתוחה".
// בצילום של בעל המוצר, 06/10, כל משמרת פתוחה כתבה "פתוחה" פעמיים: בתגית
// ומתחתיה. ⚠️ ובמשמרת שעברה זה היה גרוע יותר, כי התגית אמרה "עברה" והטקסט
// מתחתיה אמר "פתוחה", ושתי המילים סותרות. DOCS/PLANING/26

import type { Shift } from '../../types';
import { t } from '../../i18n/dictionary';
import { displayName } from '../../utils/names';
import { StatusPill } from '../common/StatusPill';
import type { PillTone } from '../common/StatusPill';

export type ShiftViewState = 'open' | 'mine' | 'taken' | 'handoverRequested' | 'mineHandover' | 'past';

export function shiftViewState(shift: Shift, memberId: string | null, past: boolean): ShiftViewState {
  const isMine = Boolean(memberId) && shift.assigneeMemberId === memberId;
  if (past) return 'past';
  if (shift.handoverState === 'requested') return isMine ? 'mineHandover' : 'handoverRequested';
  if (isMine) return 'mine';
  if (shift.assigneeMemberId) return 'taken';
  return 'open';
}

const LABEL: Record<ShiftViewState, string> = {
  open: t.shift.open,
  mine: t.shift.mine,
  taken: t.shift.taken,
  handoverRequested: t.shift.handoverRequested,
  // ⚠️ כשזו המשמרת שלי המצב נאמר במילים שלי, ולא באותן מילים
  // שבהן הוא נאמר למי שרואה משמרת של אחר. DOCS/PLANING/26
  mineHandover: t.shift.handoverMine,
  past: t.shift.past,
};

const TONE: Record<ShiftViewState, PillTone> = {
  open: 'open',
  mine: 'mine',
  taken: 'taken',
  handoverRequested: 'handover',
  mineHandover: 'handover',
  past: 'taken',
};

const SURFACE: Record<ShiftViewState, string> = {
  open: 'bg-shift-open border-shift-open-line',
  mine: 'bg-shift-mine border-shift-mine-line',
  taken: 'bg-shift-taken border-shift-taken-line',
  handoverRequested: 'bg-shift-handover border-shift-handover-line',
  mineHandover: 'bg-shift-handover border-shift-handover-line',
  past: 'bg-surface-sunken border-line',
};

interface Props {
  shift: Shift;
  state: ShiftViewState;
  canAct: boolean;
  busy: boolean;
  /** ⚠️ בטלפון כרטיס אחד בשורה, והפעולה יושבת בצד ולא מתחת. */
  wide?: boolean;
  onClaim: () => void;
  onRelease: () => void;
  onRequestHandover: () => void;
  onCancelHandover: () => void;
}

export function ShiftCell({
  shift,
  state,
  canAct,
  busy,
  wide = false,
  onClaim,
  onRelease,
  onRequestHandover,
  onCancelHandover,
}: Props) {
  const interactive = canAct && state !== 'past';

  const action = (() => {
    if (!interactive) return null;
    switch (state) {
      case 'open':
        return { label: busy ? t.shift.claiming : t.shift.claim, run: onClaim };
      case 'handoverRequested':
        return { label: busy ? t.shift.claiming : t.shift.takeOver, run: onClaim };
      case 'mine':
        return { label: t.shift.requestHandover, run: onRequestHandover };
      case 'mineHandover':
        return { label: t.shift.cancelHandover, run: onCancelHandover };
      default:
        return null;
    }
  })();

  /*
    ⚠️⚠️ כפתור נראה כמו כפתור, ותגית נראית כמו תווית.
    בעל המוצר דיווח 06/10 שלא ברור אם "צריך מחליף" הוא הסטטוס שלו או פעולה
    שעליו ללחוץ. ⚠️ שתי ההפרדות יחד: הכפתור מלא בצבע הפעולה ונושא פועל בגוף
    ראשון, והתגית שטוחה ונושאת שם של מצב. DOCS/PLANING/26

    ⚠️ ו-44 פיקסלים ולא py-1.5. זה יעד הנגיעה המינימלי, ורוב השימוש בטלפון.
  */
  const actionClass =
    'min-h-11 rounded-md bg-brand px-3 text-sm font-semibold text-brand-ink transition-opacity hover:opacity-90 disabled:opacity-50';

  const name = shift.assigneeName ? (
    <bdi className="font-medium text-ink">{displayName(shift.assigneeName)}</bdi>
  ) : null;

  /*
    ⚠️⚠️ משמרת שעברה אינה נושאת תגית.
    בלשון בעל המוצר, 06/10: "באירועים שעברו במקום לכתוב עברה פשוט להציג
    באפור, ואם מישהו לא שובץ אז להשאיר ריק ורק השעות יופיעו".
    ⚠️ והמילה נשארת ב-sr-only, כי קורא מסך אינו רואה אפור. DOCS/PLANING/26
  */
  const past = state === 'past';
  const pill = past ? (
    <span className="sr-only">{LABEL.past}</span>
  ) : (
    <StatusPill tone={TONE[state]}>{LABEL[state]}</StatusPill>
  );

  if (wide) {
    /*
      ⚠️⚠️ עוטף, ולא שורה אחת שנדחסת.
      ברוחב 393 שעה, שם, תגית ושני כפתורים הם כ-370 פיקסלים, והשורה גלשה
      מהמסך. בעל המוצר דיווח 06/10 ש"משהו נדפק בתצוגה לנייד".
      ⚠️ ולכן הפעולות יורדות לשורה משלהן בטלפון, ומצטרפות לשורה בדסקטופ.
      DOCS/PLANING/26
    */
    return (
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-2.5 ${SURFACE[state]}`}>
        {/* מקף טווח ולא מקף מפריד. הגיליון עצמו כותב 10:00-14:00. */}
        <span className="num shrink-0 text-sm text-ink-soft">
          {shift.startTime}-{shift.endTime}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm leading-tight">{name}</span>

        {pill}

        {(action || (interactive && state === 'mine')) && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {action && (
              <button type="button" onClick={action.run} disabled={busy} className={`${actionClass} flex-1 sm:flex-none`}>
                {action.label}
              </button>
            )}

            {interactive && state === 'mine' && (
              <button
                type="button"
                onClick={onRelease}
                disabled={busy}
                className="min-h-11 shrink-0 px-2 text-sm text-ink-faint underline-offset-2 hover:underline disabled:opacity-50"
              >
                {t.shift.release}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col gap-1.5 rounded-lg border p-2 ${SURFACE[state]}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-xs text-ink-soft">
          {shift.startTime}-{shift.endTime}
        </span>
        {pill}
      </div>

      {/* ⚠️ ואינו תופס מקום כשאין משובץ. אין מה לכתוב שם. */}
      {name && <div className="truncate text-sm leading-tight">{name}</div>}

      {shift.handoverFromName && state !== 'past' && (
        <div className="truncate text-xs text-ink-faint">{t.shift.handoverFrom(shift.handoverFromName)}</div>
      )}

      {action && (
        <button
          type="button"
          onClick={action.run}
          disabled={busy}
          className="mt-auto w-full rounded-md bg-brand px-2 py-1.5 text-xs font-semibold text-brand-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {action.label}
        </button>
      )}

      {interactive && state === 'mine' && (
        <button
          type="button"
          onClick={onRelease}
          disabled={busy}
          className="w-full rounded-md px-2 py-1 text-xs text-ink-faint underline-offset-2 hover:underline disabled:opacity-50"
        >
          {t.shift.release}
        </button>
      )}
    </div>
  );
}
