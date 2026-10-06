// src/components/board/DayStatus.tsx
//
// מה מצב היום, בשורה אחת של תגיות.
//
// ⚠️ שלוש הבחנות ולא אחת, והן אינן אותו דבר:
//   סגור לגמרי        אף אחד אינו בסלון, גם לא עם קוד.
//   לחברים בלבד       הסלון סגור לציבור ופתוח לחברי האופן ספייס. זה שישי ושבת.
//   נסגר מוקדם        פתוח, ועד שעה.
//
// ⚠️⚠️ ושם החג הוא מידע ולא מדיניות. הוא מוצג בכל מקרה, ואינו קובע מי יכול
// להיות בסלון. שלושה חגים שהנחתי שהסלון סוגר בהם היו פתוחים ומשובצים
// בגיליון. DOCS/PLANING/14-the-hebrew-calendar.md

import { StatusPill } from '../common/StatusPill';
import { t } from '../../i18n/dictionary';
import type { DayAccess } from '../../utils/hebrew';

export function DayStatus({ access }: { access: DayAccess }) {
  return (
    <>
      {access.name && (
        <span className="text-xs font-medium text-activity">{access.name}</span>
      )}

      {access.memberAccess === 'closed' ? (
        <StatusPill tone="closed">{t.day.closed}</StatusPill>
      ) : access.publicAccess === 'closed' ? (
        <StatusPill tone="membersOnly">
          {access.from === 'weekend' ? t.day.weekend : t.day.membersOnly}
        </StatusPill>
      ) : access.publicAccess === 'closesEarly' && access.closesAt ? (
        <StatusPill tone="closed">{t.day.closesEarly(access.closesAt)}</StatusPill>
      ) : null}
    </>
  );
}

/** ההערה שהמנהלת כתבה ליום. ⚠️ ואינה תופסת מקום כשאין. */
export function DayNote({ note }: { note?: string }) {
  if (!note) return null;
  return <p className="px-1 text-xs leading-snug text-ink-soft">{note}</p>;
}
