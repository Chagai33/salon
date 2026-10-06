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

import { Button } from '../common/Button';
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
    שעליו ללחוץ. ההפרדה: הכפתור נושא פועל בגוף ראשון ומסגרת בצבע הפעולה,
    והתגית שטוחה ונושאת שם של מצב.

    ⚠️⚠️ ומסגרת ולא מילוי, ובלי רוחב מלא.
    בצילום הנייד של בעל המוצר, 06/10, כל משמרת פתוחה נשאה בלוק ירוק מלא ברוחב
    המסך, והמסך כולו היה קיר ירוק. ⚠️ מילוי שחוזר בכל כרטיס אינו מדגיש דבר.
    DOCS/PLANING/26

    ⚠️ ו-44 פיקסלים הוא יעד הנגיעה המינימלי, ורוב השימוש בטלפון.
  */
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

  /*
    ⚠️⚠️ משמרת שעברה היא שורה דקה ולא כרטיס.
    בצילום הנייד, 06/10, יום שעבר תפס שני כרטיסים גבוהים ובתוכם שעה בלבד.
    אין בה פעולה ואין בה מה להדגיש, ולכן היא תופסת את מה שהיא אומרת.
    DOCS/PLANING/26
  */
  if (wide && past) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-surface-sunken px-2.5 py-1 text-xs text-ink-faint">
        <span className="num shrink-0">
          {shift.startTime}-{shift.endTime}
        </span>
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className="sr-only">{LABEL.past}</span>
      </div>
    );
  }

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
          /* ⚠️ נצמד לקצה ואינו נמתח. קיר של כפתורים אינו היררכיה. */
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {action && (
              <Button tone="action" onClick={action.run} disabled={busy}>
                {action.label}
              </Button>
            )}

            {interactive && state === 'mine' && (
              <Button tone="quiet" onClick={onRelease} disabled={busy}>
                {t.shift.release}
              </Button>
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
        <Button tone="action" size="xs" block onClick={action.run} disabled={busy} className="mt-auto">
          {action.label}
        </Button>
      )}

      {interactive && state === 'mine' && (
        <Button tone="quiet" size="xs" block onClick={onRelease} disabled={busy}>
          {t.shift.release}
        </Button>
      )}
    </div>
  );
}
