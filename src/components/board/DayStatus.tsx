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
//
// ⚠️⚠️ ותגית נושאת רק מה שהמנהלת כתבה.
// שישי ושבת הם קבוע ולא חריג, ונמדד שהתגית "סוף שבוע" חזרה בחמישה תאים באותו
// מסך, אותה מילה בכולם. הקבוע נאמר פעם אחת במקרא, והעמודה עצמה שקועה.
// מה שנשאר בתגית הוא מה שהמנהלת הגדירה, כלומר החריג. DOCS/PLANING/26

import { StatusPill } from '../common/StatusPill';
import { t } from '../../i18n/dictionary';
import type { DayAccess } from '../../utils/hebrew';

export function DayStatus({ access, weekend = false }: { access: DayAccess; weekend?: boolean }) {
  // ⚠️ הקבוע אינו נושא תגית. רק מה שאדם הכריע ליום הזה.
  if (access.from !== 'manager') return null;

  if (access.memberAccess === 'closed') {
    return <StatusPill tone="closed">{t.day.closed}</StatusPill>;
  }
  if (access.publicAccess === 'closed') {
    /*
      ⚠️⚠️ ובשישי ושבת זה אינו נאמר בכלל.
      בלשון בעל המוצר, 06/10: "כשיש חג בשישי שבת זה לא משנה כלום ולא צריך
      לכתוב שזה סגור לציבור, מיותר". סגור לציבור הוא מה שממילא קורה שם, וגם
      כשהייבוא כתב אותו במפורש ליום. DOCS/PLANING/26
    */
    if (weekend) return null;
    return <StatusPill tone="membersOnly">{t.day.membersOnly}</StatusPill>;
  }
  if (access.publicAccess === 'closesEarly' && access.closesAt) {
    return <StatusPill tone="closed">{t.day.closesEarly(access.closesAt)}</StatusPill>;
  }
  return null;
}

/** שם החג. ⚠️ טקסט שקט ולא תגית: הוא מידע, ואינו מצב שדורש פעולה. */
export function DayName({ name }: { name?: string }) {
  if (!name) return null;
  return <span className="truncate text-xs font-medium text-activity">{name}</span>;
}

/** ההערה שהמנהלת כתבה ליום. ⚠️ ואינה תופסת מקום כשאין. */
export function DayNote({ note }: { note?: string }) {
  if (!note) return null;
  return <p className="px-1 text-xs leading-snug text-ink-soft">{note}</p>;
}
