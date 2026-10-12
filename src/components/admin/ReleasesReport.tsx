// src/components/admin/ReleasesReport.tsx
//
// מי שחרר משמרת. למנהלת בלבד.
// DOCS/PLANING/29-nothing-records-that-someone-cancelled.md
//
// ⚠️⚠️ שורה לכל שחרור, ולא מספר לכל אדם.
//
// בלשון בעל המוצר: "אני רוצה לדעת בעיקר מי נרשם וביטל ואחרי כמה זמן הביטול",
// ו"צריך לשים לב אם בסיומו של אותו חודש של מי שביטל האם הוא כן עשה משמרת
// אחרת". מספר "שלושה שחרורים" מערבב בין שחרור שבועיים לפני שמישהו לקח לבין
// שחרור בבוקר המשמרת שהשאיר אותה בלי אחראי, ואז המנהלת מדברת עם האדם הלא
// נכון.
//
// ⚠️ וההיגיון יושב ב-src/utils/releases.ts ולא כאן, כדי שיהיה ניתן לבדיקה
// בלי מסך.

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { allShifts, releaseEvents } from '../../services/salonService';
import { releaseRows } from '../../utils/releases';
import type { ReleaseRow } from '../../utils/releases';
import type { SalonEvent, Shift } from '../../types';
import { t } from '../../i18n/dictionary';
import { shortDateLabel, stampLabel } from '../../utils/dates';
import { fullName } from '../../utils/names';
import { toReadableError } from '../../utils/errors';

/** ⚠️ ימים כשיש ימים, שעות כשיש שעות, ושלילי הוא אחרי שהמשמרת התחילה. */
function noticeLabel(hours: number | null): string {
  if (hours === null) return t.releases.noticeUnknown;
  if (hours < 0) return t.releases.noticeLate;
  if (hours < 1) return t.releases.noticeNow;
  if (hours < 24) return t.releases.noticeHours(Math.floor(hours));
  return t.releases.noticeDays(Math.floor(hours / 24));
}

function afterLabel(row: ReleaseRow): string {
  if (row.after === 'taken') {
    return t.releases.afterTaken(row.afterName ? fullName(row.afterName) : '');
  }
  if (row.after === 'open') return t.releases.afterOpen;
  return t.releases.afterUnknown;
}

function monthLabelOf(row: ReleaseRow): string {
  if (row.month === 'otherShift') return t.releases.otherYes;
  if (row.month === 'none') return t.releases.otherNo;
  return t.releases.otherOpen;
}

/** ⚠️ `assumed` אינו "הגיע". הוא ברירת מחדל שאיש לא בדק. */
function attendanceLabel(row: ReleaseRow): string {
  if (!row.attendance) return t.releases.afterUnknown;
  return t.log.attendance[row.attendance];
}

export function ReleasesReport({ branchId }: { branchId: string }) {
  const members = useStore((state) => state.members);
  const setError = useStore((state) => state.setError);

  const [events, setEvents] = useState<SalonEvent[] | null>(null);
  const [shifts, setShifts] = useState<Shift[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    /*
      ⚠️ קריאה חד פעמית ולא מאזין. הדוח נקרא כשהמנהלת פותחת אותו, ומשמרת
      שתשוחרר בזמן שהוא פתוח אינה שווה מאזין על כל האוסף.
    */
    void Promise.all([releaseEvents(branchId), allShifts(branchId)])
      .then(([rows, all]) => {
        if (cancelled) return;
        setEvents(rows);
        setShifts(all);
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(toReadableError(error, t.errors.loadMonth));
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, setError]);

  const nameOf = useMemo(() => {
    const byId = new Map(members.map((member) => [member.id, member.displayName]));
    return (id: string | null): string => {
      if (!id) return '';
      const found = byId.get(id);
      return found ? fullName(found) : t.log.unknownMember;
    };
  }, [members]);

  // ⚠️ ב-useMemo ולא בבורר, כמו כל גזירה שבונה מערך חדש. CLAUDE.md
  const rows = useMemo(
    () => (events && shifts ? releaseRows(events, shifts) : []),
    [events, shifts],
  );

  if (!events || !shifts) {
    return <p className="text-sm text-ink-soft">{t.releases.loading}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-ink-soft">{t.releases.lead}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-faint">{t.releases.empty}</p>
      ) : (
        <>
          <p className="text-sm text-ink-soft">{t.releases.rows(rows.length)}</p>

          {/*
            ⚠️ טבלה ולא רשת כרטיסים. CLAUDE.md, עיצוב: שבע עובדות על אותו
            אירוע הן שורה, ולא כרטיס.
            ⚠️ והגלילה האופקית בתוך המעטפת הזו בלבד, כדי שהעמוד עצמו לא
            יגלול לצדדים ברוחב של טלפון.
          */}
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[46rem] text-start text-sm">
              <thead>
                <tr className="border-b border-line text-start text-xs text-ink-soft">
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t.releases.who}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t.releases.shift}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t.releases.when}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t.releases.notice}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t.releases.after}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">
                    {t.releases.otherShift}
                  </th>
                  <th scope="col" className="py-2 text-start font-medium">
                    {t.releases.attendance}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.eventId} className="align-top">
                    <td className="py-2 pe-3">
                      <bdi className="text-ink">{nameOf(row.memberId)}</bdi>
                      {/* ⚠️ והסימן הזה הוא ההכרעה: החבר לא החליט על זה. */}
                      {row.byManager && (
                        <span className="block text-xs text-ink-faint">
                          {t.releases.byManager}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pe-3 text-ink-soft">
                      {row.shiftDate ? shortDateLabel(row.shiftDate) : ''}
                      {row.startTime && row.endTime && (
                        <span className="num ms-1" dir="ltr">
                          {row.startTime}-{row.endTime}
                        </span>
                      )}
                    </td>
                    <td className="num py-2 pe-3 text-ink-soft">{stampLabel(row.at)}</td>
                    <td className="py-2 pe-3 text-ink-soft">{noticeLabel(row.noticeHours)}</td>
                    <td className="py-2 pe-3 text-ink-soft">{afterLabel(row)}</td>
                    <td className="py-2 pe-3 text-ink-soft">{monthLabelOf(row)}</td>
                    <td className="py-2 text-ink-soft">{attendanceLabel(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
