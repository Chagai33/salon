// src/components/admin/EventLogPanel.tsx
//
// מי עשה מה ומתי. למנהלת בלבד.
// DOCS/PLANING/29-nothing-records-that-someone-cancelled.md
//
// ⚠️ ולמסך הזה אין שם במוצר, ובכוונה. אין לדבר שורה ב-DOCS/GLOSSARY.md, ולפי
// CLAUDE.md דבר בלי שורה אינו מקבל שם אלא משפט שמסביר. הכותרת היא המשפט.
//
// ⚠️⚠️ ומה שאין כאן: התחברויות, ואף הרשמה.
// בלשון בעל המוצר, 12/10: "רק אישור משתמש / הענקת הרשאות ולא סתם כניסות."
// 42 חברים שנכנסים לראות את הקוד פעם בחודש מייצרים רשימה שבה הפעילות
// האמיתית נקברת, ו"מי נכנס מתי" הוא מעקב ולא ביקורת.

import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useEventsBinding } from '../../hooks/useSalon';
import { t } from '../../i18n/dictionary';
import { shortDateLabel, stampLabel } from '../../utils/dates';
import { fullName } from '../../utils/names';
import type { Attendance, EventDetail, MemberRole, SalonEvent, SettingsPart } from '../../types';

/** ⚠️ שם מלא ולא מקוצר: זה מסך שבו מזהים אדם, כמו מסך החברים. */
function nameLookup(members: { id: string; displayName: string }[]) {
  const byId = new Map(members.map((member) => [member.id, member.displayName]));
  return (id: string | undefined): string => {
    if (!id) return '';
    const found = byId.get(id);
    // ⚠️ מי שאינו ברשימה אינו נעלם מהשורה. חבר יכול להיות מחוץ לרשימה
    // שהמאזין מחזיק, והשורה עליו נשמרת 12 חודשים בלי קשר.
    return found ? fullName(found) : t.log.unknownMember;
  };
}

function attendanceLabel(detail: EventDetail | undefined): string {
  if (detail && detail in t.log.attendance) return t.log.attendance[detail as Attendance];
  return '';
}

function settingsLabel(detail: EventDetail | undefined): string {
  if (detail && detail in t.log.settingsPart) return t.log.settingsPart[detail as SettingsPart];
  return '';
}

function roleLabel(detail: EventDetail | undefined): string {
  return (detail as MemberRole) === 'manager' ? t.manager.roleManager : t.manager.roleMember;
}

/**
 * השורה במילים.
 *
 * ⚠️⚠️ שם פעולה ולא פועל. פועל בעברית נושא מין, והשורות האלה מתארות אנשים
 * אמיתיים שהמוצר אינו יודע את המין שלהם.
 */
export function lineOf(event: SalonEvent, nameOf: (id: string | undefined) => string): string {
  const date = event.shiftDate ? shortDateLabel(event.shiftDate) : '';
  const subject = nameOf(event.subjectMemberId);
  const lines = t.log.lines;

  switch (event.action) {
    case 'shiftAssigned':
      return lines.shiftAssigned(date);
    case 'shiftReleased':
      // ⚠️ שחרור של מנהלת נקרא כשחרור של מנהלת, ולא כביטול של החבר.
      return event.subjectMemberId && event.subjectMemberId !== event.actorMemberId
        ? lines.shiftReleasedFor(subject, date)
        : lines.shiftReleased(date);
    case 'handoverRequested':
      return lines.handoverRequested(date);
    case 'handoverCancelled':
      return lines.handoverCancelled(date);
    case 'handoverTaken':
      return lines.handoverTaken(subject, date);
    case 'attendanceSet':
      return lines.attendanceSet(subject, attendanceLabel(event.detail), date);
    case 'memberApproved':
      return lines.memberApproved(subject);
    case 'memberRejected':
      return lines.memberRejected(subject);
    case 'memberDeactivated':
      return lines.memberDeactivated(subject);
    case 'memberReactivated':
      return lines.memberReactivated(subject);
    case 'roleChanged':
      return lines.roleChanged(subject, roleLabel(event.detail));
    case 'accessCodeSet':
      return lines.accessCodeSet;
    case 'settingsChanged':
      return lines.settingsChanged(settingsLabel(event.detail));
    case 'monthCreated':
      return lines.monthCreated(event.count ?? 0);
    case 'importRan':
      return lines.importRan(event.count ?? 0);
    default:
      // ⚠️ סוג שנוסף למודל ולא למילון אינו נעלם מהמסך בשקט.
      return lines.unknown(event.action);
  }
}

export function EventLogPanel({ branchId }: { branchId: string }) {
  useEventsBinding(branchId, true);

  const events = useStore((state) => state.events);
  const members = useStore((state) => state.members);
  // ⚠️ ב-useMemo ולא בגוף הרכיב: `nameLookup` בונה `Map` חדש, וזה בדיוק
  // הדפוס שהפיל את המסך פעם אחת. CLAUDE.md, זרימת נתונים.
  const nameOf = useMemo(() => nameLookup(members), [members]);

  return (
    <div className="flex flex-col gap-3">
      {/* ⚠️ והתפוגה נאמרת במסך. 12 חודשים, ואז השורה נמחקת מעצמה. */}
      <p className="text-sm text-ink-soft">{t.log.keeps}</p>

      {events.length === 0 ? (
        <p className="text-sm text-ink-faint">{t.log.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-0.5 py-2">
              <span className="text-sm text-ink">{lineOf(event, nameOf)}</span>
              <span className="text-xs text-ink-faint">
                {/* ⚠️ מי עשה, ואחריו מתי. ⚠️ ושעה בתוך עברית נושאת כיוון
                    משלה, ולכן התאריך והשעה יושבים ב-num. */}
                <bdi>{nameOf(event.actorMemberId)}</bdi>
                {' · '}
                <span className="num">{stampLabel(event.at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
