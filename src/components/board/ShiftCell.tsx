// src/components/board/ShiftCell.tsx
//
// תא משמרת אחד.
//
// ⚠️ כפתור, ולא div שאפשר ללחוץ עליו. מקלדת מגיעה אליו, וקורא מסך מקריא את מה
// שהוא עושה. DOCS/PLANING/03-the-design-standard.md

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
  mineHandover: t.shift.handoverRequested,
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

  return (
    <div className={`flex h-full flex-col gap-1.5 rounded-lg border p-2 ${SURFACE[state]}`}>
      <div className="flex items-baseline justify-between gap-2">
        {/* מקף טווח ולא מקף מפריד. הגיליון עצמו כותב 10:00-14:00, ובלי משהו
            בין השעות הן נקראות כשתי שעות ולא כטווח. */}
        <span className="num text-xs text-ink-soft">
          {shift.startTime}-{shift.endTime}
        </span>
        <StatusPill tone={TONE[state]}>{LABEL[state]}</StatusPill>
      </div>

      <div className="min-h-5 text-sm leading-tight">
        {shift.assigneeName ? (
          <bdi className="font-medium text-ink">{displayName(shift.assigneeName)}</bdi>
        ) : (
          <span className="text-ink-faint">{t.shift.open}</span>
        )}
      </div>

      {shift.handoverFromName && state !== 'past' && (
        <div className="text-xs text-ink-faint">{t.shift.handoverFrom(shift.handoverFromName)}</div>
      )}

      {action && (
        <button
          type="button"
          onClick={action.run}
          disabled={busy}
          className="mt-auto w-full rounded-md border border-line-strong bg-surface px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-brand-soft disabled:opacity-50"
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
