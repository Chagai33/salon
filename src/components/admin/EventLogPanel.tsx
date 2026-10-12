// src/components/admin/EventLogPanel.tsx
//
// מי עשה מה ומתי. למנהלת בלבד.
// DOCS/PLANING/29-nothing-records-that-someone-cancelled.md
//
// ⚠️ ולמסך הזה אין שם במוצר, ובכוונה. אין לדבר שורה ב-DOCS/GLOSSARY.md, ולפי
// CLAUDE.md דבר בלי שורה אינו מקבל שם אלא משפט שמסביר. הכותרת היא המשפט.
//
// ⚠️⚠️ הכל, עם שני מסננים, בהכרעת בעל המוצר 12/10, סעיף 4: "מי עשה מה ומתי
// זה סוג של לוג". DOCS/PLANING/33
//
// ⚠️ ומה שאין כאן: התחברויות, ואף הרשמה. בלשון בעל המוצר: "רק אישור משתמש /
// הענקת הרשאות ולא סתם כניסות."

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { loadEvents } from '../../services/salonService';
import { t } from '../../i18n/dictionary';
import { shortDateLabel } from '../../utils/dates';
import { labelText, managerLabels } from '../../utils/names';
import { toReadableError } from '../../utils/errors';
import { Button } from '../common/Button';
import { Stamp } from '../common/Stamp';
import type {
  Attendance,
  EventAction,
  EventDetail,
  MemberRole,
  SalonEvent,
  SettingsPart,
} from '../../types';

/** שלוש המשפחות של רשומה 29. */
type Family = 'all' | 'shifts' | 'members' | 'settings';

const FAMILY: Record<EventAction, Exclude<Family, 'all'>> = {
  shiftAssigned: 'shifts',
  shiftReleased: 'shifts',
  handoverRequested: 'shifts',
  handoverCancelled: 'shifts',
  handoverTaken: 'shifts',
  attendanceSet: 'shifts',
  memberApproved: 'members',
  memberRejected: 'members',
  memberDeactivated: 'members',
  memberReactivated: 'members',
  roleChanged: 'members',
  accessCodeSet: 'settings',
  settingsChanged: 'settings',
  monthCreated: 'settings',
  importRan: 'settings',
};

/** ⚠️ כמה שורות בכל פעם. עשרות אנשים בשנה הם מאות שורות, ולא כולן במסך. */
const PAGE = 100;

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

const field =
  'min-h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink';

export function EventLogPanel({ branchId }: { branchId: string }) {
  const members = useStore((state) => state.members);
  const setError = useStore((state) => state.setError);

  /** ⚠️ null פירושו שעוד לא נקרא, ולא שאין שורות. */
  const [events, setEvents] = useState<SalonEvent[] | null>(null);
  const [family, setFamily] = useState<Family>('all');
  const [person, setPerson] = useState('');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    // ⚠️ קריאה אחת כשהמסך נפתח, ולא מאזין. שורה שתיכתב בזמן שהוא פתוח אינה
    // שווה מאזין על כל האוסף.
    void loadEvents(branchId)
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(toReadableError(error, t.errors.loadMonth));
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, setError]);

  // ⚠️ ב-useMemo ולא בבורר: כל אחת מהגזירות האלה בונה מבנה חדש. CLAUDE.md
  const labels = useMemo(() => managerLabels(members), [members]);
  const nameOf = useMemo(
    () => (id: string | undefined) =>
      id ? (labels.has(id) ? labelText(labels.get(id)) : t.log.unknownMember) : '',
    [labels],
  );
  const people = useMemo(
    () =>
      [...labels.entries()]
        .map(([id, label]) => [id, labelText(label)] as const)
        .sort((a, b) => a[1].localeCompare(b[1], 'he')),
    [labels],
  );

  const filtered = useMemo(
    () =>
      (events ?? []).filter(
        (event) =>
          (family === 'all' || FAMILY[event.action] === family) &&
          // ⚠️ "אדם" הוא גם מי שעשה וגם מי שזה נעשה עליו. מנהלת שמחפשת
          // חבר צריכה לראות גם את השחרור שמנהלת עשתה לו.
          (!person || event.actorMemberId === person || event.subjectMemberId === person),
      ),
    [events, family, person],
  );

  if (!events) return <p className="text-sm text-ink-soft">{t.log.loading}</p>;

  const visible = filtered.slice(0, shown);

  return (
    <div className="flex flex-col gap-3">
      {/* ⚠️ והתפוגה נאמרת במסך. 12 חודשים, ואז השורה נמחקת מעצמה. */}
      <p className="text-sm text-ink-soft">{t.log.keeps}</p>

      {events.length === 0 ? (
        <p className="text-sm text-ink-faint">{t.log.empty}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-ink-soft">
              {t.log.filterType}
              <select
                className={field}
                value={family}
                onChange={(event) => {
                  setFamily(event.target.value as Family);
                  setShown(PAGE);
                }}
              >
                <option value="all">{t.log.typeAll}</option>
                <option value="shifts">{t.log.typeShifts}</option>
                <option value="members">{t.log.typeMembers}</option>
                <option value="settings">{t.log.typeSettings}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-soft">
              {t.log.filterPerson}
              <select
                className={field}
                value={person}
                onChange={(event) => {
                  setPerson(event.target.value);
                  setShown(PAGE);
                }}
              >
                <option value="">{t.log.personAll}</option>
                {people.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-xs text-ink-faint">{t.log.count(visible.length, filtered.length)}</p>

          {filtered.length === 0 ? (
            <p className="text-sm text-ink-faint">{t.log.noMatch}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {visible.map((event) => (
                <li key={event.id} className="flex flex-col gap-0.5 py-2">
                  <span className="text-sm text-ink">{lineOf(event, nameOf)}</span>
                  <span className="text-xs text-ink-faint">
                    <bdi>{nameOf(event.actorMemberId)}</bdi>
                    {' · '}
                    <Stamp at={event.at} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          {filtered.length > shown && (
            <div>
              <Button tone="secondary" size="sm" onClick={() => setShown((count) => count + PAGE)}>
                {t.log.more}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
