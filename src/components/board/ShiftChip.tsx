// src/components/board/ShiftChip.tsx
//
// משמרת בלוח החודש, בשורה אחת.
//
// ⚠️⚠️ ובלי כפתור פעולה.
// לוח חודש הוא משטח סריקה: שלושים תאים, ובכל אחד שתי משמרות, ובכל משמרת
// כפתור, הם שישים כפתורים על מסך אחד. הפעולה יושבת בגיליון היום, והצ'יפ הוא
// מה שפותח אותו. DOCS/PLANING/26
//
// ⚠️ וזה גם מה שמאפשר גובה תא קבוע: שורה אחת לכל משמרת, ולא כרטיס.

import type { Shift } from '../../types';
import { t } from '../../i18n/dictionary';
import { displayName } from '../../utils/names';
import { WEEKDAY_NAMES, shortDateLabel, weekdayOf } from '../../utils/dates';
import type { ShiftViewState } from './ShiftCell';

/*
  ⚠️ גבול דק בצד ההתחלה ולא מסגרת מלאה.
  מסגרת סביב כל צ'יפ בחודש שלם היא שישים מסגרות על מסך אחד, ואז שום דבר אינו
  בולט. הקו בצד הוא מה שנושא את הגוון. DOCS/PLANING/03
*/
const SURFACE: Record<ShiftViewState, string> = {
  open: 'bg-shift-open border-s-shift-open-line text-shift-open-ink',
  mine: 'bg-shift-mine border-s-shift-mine-line text-shift-mine-ink',
  taken: 'bg-shift-taken border-s-shift-taken-line text-shift-taken-ink',
  handoverRequested: 'bg-shift-handover border-s-shift-handover-line text-shift-handover-ink',
  mineHandover: 'bg-shift-handover border-s-shift-handover-line text-shift-handover-ink',
  past: 'bg-surface-sunken border-s-line text-ink-faint',
};

/** ⚠️ מילה ולא צבע לבד, גם בשורה אחת. הכלל אינו משתנה לפי גודל הרכיב. */
const WORD: Record<ShiftViewState, string> = {
  open: t.shift.open,
  mine: t.shift.mine,
  taken: t.shift.taken,
  handoverRequested: t.shift.handoverRequested,
  // ⚠️ כשזו המשמרת שלי המצב נאמר במילים שלי, ולא באותן מילים
  // שבהן הוא נאמר למי שרואה משמרת של אחר. DOCS/PLANING/26
  mineHandover: t.shift.handoverMine,
  past: t.shift.past,
};

interface Props {
  shift: Shift;
  state: ShiftViewState;
  onOpen: () => void;
}

export function ShiftChip({ shift, state, onOpen }: Props) {
  /*
    ⚠️ מה שנכתב בצ'יפ הוא מי שמשובץ, וכשאין משובץ המילה היא המצב.
    ולא שניהם: "פתוחה" שנכתב בתגית ושוב מתחתיה הוא מה שבעל המוצר ראה בצילום.
  */
  const label = shift.assigneeName ? displayName(shift.assigneeName) : WORD[state];
  const needsPerson = !shift.assigneeName && state !== 'past';

  return (
    <button
      type="button"
      onClick={onOpen}
      /* ⚠️ יום, תאריך, שעות ומצב. ולא מפתח ISO, שקורא מסך מקריא ספרה ספרה. */
      aria-label={t.a11y.shiftCell(
        WEEKDAY_NAMES[weekdayOf(shift.date)],
        shortDateLabel(shift.date),
        `${shift.startTime}-${shift.endTime}`,
        WORD[state],
      )}
      className={`flex w-full items-baseline gap-1.5 rounded-md border-s-2 px-1.5 py-1 text-start text-xs ${SURFACE[state]} ${
        needsPerson ? 'font-medium' : ''
      }`}
    >
      <span className="num shrink-0 opacity-80">{shift.startTime}</span>
      <bdi className="min-w-0 flex-1 truncate">{label}</bdi>
    </button>
  );
}
