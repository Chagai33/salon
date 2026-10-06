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
import { DayStatus } from './DayStatus';
import { DayEvents, eventsWorthShowing } from './DayEvents';
import { DayEditor } from './DayEditor';
import { dayAccessOf, isWeekend } from '../../utils/hebrew';

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
