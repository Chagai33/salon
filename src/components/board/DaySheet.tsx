// src/components/board/DaySheet.tsx
//
// יום אחד, במלואו.
//
// ⚠️ זה המקום שאליו הלך מה שיצא מהתא בלוח: ההערה המלאה, האירוע השני והשלישי,
// והפעולות על המשמרות. גובה תא קבוע עובד רק כשיש לתוכן שנחתך מקום להיות בו.
// DOCS/PLANING/26
//
// ⚠️⚠️ ולמנהלת זה גם העורך, ליד היום שהיא בחרה.
// קודם העורך ישב מתחת ללוח, רחוק מהיום שנפתח בו.

import { Button } from '../common/Button';
import { useState } from 'react';
import type { ActivityDay, Shift } from '../../types';
import { t } from '../../i18n/dictionary';
import { WEEKDAY_NAMES, isPast, shortDateLabel, weekdayOf } from '../../utils/dates';
import { Sheet } from '../common/Sheet';
import { Confirm } from '../common/Confirm';
import { displayName } from '../../utils/names';
import { ShiftCell, shiftViewState } from './ShiftCell';
import { HandoverShare } from './HandoverShare';
import { DayStatus } from './DayStatus';
import { DayEvents, eventsWorthShowing } from './DayEvents';
import { DayEditor } from './DayEditor';
import { dayAccessOf, isWeekend } from '../../utils/hebrew';
import { shiftClashWith } from '../../utils/closing';

interface Props {
  branchId: string;
  dateKey: string;
  day: ActivityDay | undefined;
  name?: string;
  shifts: Shift[];
  memberId: string | null;
  canAct: boolean;
  isManager: boolean;
  busyId: string | null;
  onClose: () => void;
  onClaim: (shift: Shift) => void;
  onRelease: (shift: Shift) => void;
  onRequestHandover: (shift: Shift) => void;
  onCancelHandover: (shift: Shift) => void;
  /**
   * ⚠️⚠️ המנהלת משביתה משמרת שהסגירה בולעת או חותכת, או מחזירה אותה.
   * ושום משמרת אינה מושבתת מעצמה. DOCS/PLANING/59
   */
  onSetCancelled: (shift: Shift, cancelled: boolean) => void;
}

export function DaySheet({
  branchId,
  dateKey,
  day,
  name,
  shifts,
  memberId,
  canAct,
  isManager,
  busyId,
  onClose,
  onClaim,
  onRelease,
  onRequestHandover,
  onCancelHandover,
  onSetCancelled,
}: Props) {
  /** המשמרת שהמנהלת עומדת לשחרר. ⚠️ null פירושו שאין חלון אישור פתוח. */
  const [releasing, setReleasing] = useState<Shift | null>(null);

  const access = dayAccessOf(dateKey, day, name);
  const events = eventsWorthShowing(day?.events, name);
  const past = isPast(dateKey);
  const noShifts = access.publicAccess === 'closed' || access.memberAccess === 'closed';

  return (
    <Sheet
      title={`${WEEKDAY_NAMES[weekdayOf(dateKey)]}, ${shortDateLabel(dateKey)}`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {/* ⚠️ שם החג ומצב הגישה, במילים. והקבוע נאמר גם כשאין לו תגית בלוח. */}
        <div className="flex flex-wrap items-center gap-2">
          {access.name && <span className="text-sm font-medium text-activity">{access.name}</span>}
          {/* ⚠️ ובשישי ושבת לא נכתב "סגור לציבור": זה הקבוע, והוא נאמר פעם
              אחת בשורה שלמטה. DOCS/PLANING/26 */}
          <DayStatus access={access} weekend={isWeekend(dateKey)} />
        </div>

        {access.note && (
          <p className="rounded-card bg-surface-sunken px-3 py-2 text-sm leading-relaxed text-ink">
            {access.note}
          </p>
        )}

        {events.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-ink">{t.day.eventsLabel}</h3>
            <div className="mt-1.5">
              <DayEvents events={events} size="sm" />
            </div>
          </section>
        )}

        {/* ⚠️ וכאן הפעולות. בלוח החודש הן אינן קיימות, בכוונה. */}
        {!noShifts && shifts.length > 0 && (
          <section className="flex flex-col gap-1.5">
            {shifts.map((shift) => (
              <div key={shift.id} className="flex flex-col gap-1">
                <ShiftCell
                  wide
                  shift={shift}
                  state={shiftViewState(shift, memberId, past)}
                  canAct={canAct}
                  busy={busyId === shift.id}
                  onClaim={() => onClaim(shift)}
                  onRelease={() => onRelease(shift)}
                  onRequestHandover={() => onRequestHandover(shift)}
                  onCancelHandover={() => onCancelHandover(shift)}
                />

                {/*
                  ⚠️⚠️ וזה המקום שבו שעת הסגירה פוגשת את המשמרת.
                  בתא בלוח יש 60 פיקסלים, וכאן יש מקום למשפט, לשם האירוע, לשם
                  המשובץ ולהכרעה. DOCS/PLANING/59
                */}
                {!past && (
                  <ClosingNote
                    shift={shift}
                    closesAt={access.closesAt}
                    closesFor={access.closesFor}
                    isMine={Boolean(memberId) && shift.assigneeMemberId === memberId}
                    isManager={isManager}
                    busy={busyId === shift.id}
                    onSetCancelled={onSetCancelled}
                  />
                )}

                {/*
                  ⚠️⚠️ הלינק להעתקה, וליד הבקשה עצמה.

                  רק למי שביקש, ורק כל עוד הבקשה פתוחה. בלשון בעל המוצר:
                  "נייצר לינק כשמישהו מבקש מחליף ואת הלינק הוא משתף בקבוצת
                  הווצאפ של הסלון". DOCS/PLANING/28
                */}
                {shift.handoverState === 'requested' &&
                  shift.assigneeMemberId === memberId &&
                  !past && <HandoverShare branchId={branchId} shift={shift} />}

                {/*
                  ⚠️ שחרור של חבר אחר, למנהלת בלבד, ובכפתור נפרד.
                  הוא אינו יושב בתוך כרטיס המשמרת כדי שלא ייקרא כפעולה של מי
                  שרואה אותו. DOCS/PLANING/26
                */}
                {isManager &&
                  !past &&
                  shift.assigneeMemberId &&
                  shift.assigneeMemberId !== memberId && (
                    <Button
                      tone="danger"
                      size="xs"
                      className="self-start"
                      onClick={() => setReleasing(shift)}
                    >
                      {t.manager.releaseOther}
                    </Button>
                  )}
              </div>
            ))}
          </section>
        )}

        {/* ⚠️ חלון אישור של האפליקציה, ולא של הדפדפן. */}
        {releasing && (
          <Confirm
            title={t.manager.releaseOtherTitle}
            body={t.manager.releaseOtherBody(
              displayName(releasing.assigneeName ?? ''),
              shortDateLabel(dateKey),
            )}
            confirmLabel={t.manager.releaseOther}
            busy={busyId === releasing.id}
            onConfirm={() => {
              onRelease(releasing);
              setReleasing(null);
            }}
            onCancel={() => setReleasing(null)}
          />
        )}

        {isManager && (
          <DayEditor branchId={branchId} dateKey={dateKey} day={day} name={name} bare onClose={onClose} />
        )}
      </div>
    </Sheet>
  );
}

/**
 * שעת הסגירה מול משמרת אחת, והכרעת המנהלת.
 *
 * ⚠️⚠️ ושום משמרת אינה מושבתת מעצמה. בהכרעת בעל המוצר, 28/10/2026: *"כן אבל
 * צריך לאפשר למנהלת להחליט אם המשמרת מתבטלת או לא"*. הרכיב הזה מסמן, ואומר
 * מה ידוע, והכפתור הוא שלה.
 *
 * ⚠️ ושני מצבי התנגשות ולא אחד, והמשפט אינו זהה בהם: הסגירה חותכת את המשמרת
 * באמצע, או שהיא כולה לפניה. DOCS/PLANING/59
 *
 * ⚠️⚠️ ואינו אדום. אדום הוא מחיקה ודריסה, וההשבתה הפיכה ואינה מוחקת דבר.
 * DOCS/PLANING/58
 */
function ClosingNote({
  shift,
  closesAt,
  closesFor,
  isMine,
  isManager,
  busy,
  onSetCancelled,
}: {
  shift: Shift;
  closesAt?: string;
  closesFor?: string;
  isMine: boolean;
  isManager: boolean;
  busy: boolean;
  onSetCancelled: (shift: Shift, cancelled: boolean) => void;
}) {
  /*
    ⚠️ נגזר ואינו שדה, ומחזיר מחרוזת או undefined ולא אובייקט חדש.
    CLAUDE.md, זרימת נתונים.
  */
  const clash = shiftClashWith(shift, closesAt);
  const off = shift.attendance === 'cancelled';

  // ⚠️ משמרת שנגמרת עד שעת הסגירה אינה מסומנת בכלום.
  if (!clash && !off) return null;

  const sentence =
    clash === 'swallowed'
      ? t.shift.clashSwallowed(closesAt!, shift.startTime, closesFor)
      : clash === 'cut'
        ? t.shift.clashCut(closesAt!, shift.endTime, closesFor)
        : null;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface-sunken px-2.5 py-2 ring-1 ring-inset ring-line">
      {sentence && <p className="text-xs leading-snug text-ink">{sentence}</p>}

      {/* ⚠️ ולמי שמשובץ עליה נאמר מה שמעניין אותו: הזכאות נשמרת. */}
      {off && isMine && <p className="text-xs leading-snug text-ink">{t.shift.offMine}</p>}

      {isManager && (
        <>
          {/*
            ⚠️⚠️ ושם המשובץ והעדכון שלו, ונאמר ולא נרמז.
            בגרסה הראשונה אין מייל, ולכן המוצר אינו מודיע לו והמנהלת מודיעה.
            DOCS/PLANING/28
          */}
          {shift.assigneeName && (
            <p className="text-xs font-medium leading-snug text-ink">
              {t.shift.offNotice(displayName(shift.assigneeName))}
            </p>
          )}

          {!off && <p className="text-xs leading-snug text-ink-soft">{t.shift.offDecide}</p>}

          <Button
            tone="secondary"
            size="sm"
            className="self-start"
            disabled={busy}
            onClick={() => onSetCancelled(shift, !off)}
          >
            {off ? t.shift.turnOn : t.shift.turnOff}
          </Button>
        </>
      )}
    </div>
  );
}
