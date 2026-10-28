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

export function DayStatus({
  access,
  weekend = false,
  short = false,
}: {
  access: DayAccess;
  weekend?: boolean;
  /**
   * ⚠️⚠️ צורה קצרה לתא בלוח החודש, מ-28/10/2026.
   *
   * **נמדד שתא הלוח הוא 96 פיקסלים ברוחב 768**, והמשפט המלא, "הסלון סוגר
   * ב-18:30, לקראת NLP הרצאה", נשבר שם לשמונה שורות וצבע מעל כל מה שמתחת.
   *
   * ⚠️ **והמשפט המלא לא נמחק:** הוא נשאר בגיליון היום, שם יש לו מקום.
   * DOCS/PLANING/58
   */
  short?: boolean;
}) {
  // ⚠️ הקבוע אינו נושא תגית. רק מה שאדם הכריע ליום הזה.
  if (access.from !== 'manager') return null;

  if (access.memberAccess === 'closed') {
    return <StatusPill tone="closed">{short ? t.day.shutShort : t.day.closed}</StatusPill>;
  }
  if (access.publicAccess === 'closed') {
    /*
      ⚠️⚠️ ובשישי ושבת זה אינו נאמר בכלל.
      בלשון בעל המוצר, 06/10: "כשיש חג בשישי שבת זה לא משנה כלום ולא צריך
      לכתוב שזה סגור לציבור, מיותר". סגור לציבור הוא מה שממילא קורה שם, וגם
      כשהייבוא כתב אותו במפורש ליום. DOCS/PLANING/26
    */
    if (weekend) return null;
    return (
      <StatusPill tone="membersOnly">
        {short ? t.day.membersOnlyShort : t.day.membersOnly}
      </StatusPill>
    );
  }
  if (access.publicAccess === 'closesEarly' && access.closesAt) {
    /*
      ⚠️⚠️ ושם האירוע שגרם לסגירה, בלשון בעל המוצר 26/10 "ולציין זאת".
      חבר שרואה "הסלון סוגר ב-18:30" ואינו יודע למה חושב שזו טעות. ⚠️ ושעה
      שהמנהלת כתבה ביד אינה נושאת שם, כי אין לה אירוע. DOCS/PLANING/38
    */
    const full = access.closesFor
      ? t.day.closesEarlyFor(access.closesAt, access.closesFor)
      : t.day.closesEarly(access.closesAt);

    /*
      ⚠️⚠️ ובתא הלוח התגית נושאת את השעה ומוותרת על המילה, בהכרעת בעל המוצר
      28/10/2026 בלשונו *"3א"*.

      בלשונו, על מה שהיה: *"כתוב נסגר ולא ברור אם זה כל היום או משעה
      מסויימת"*. **"נסגר" ו"סגור" נקראו כאותו דבר**, ושתי המילים נבדלו
      באות אחת. ⚠️ **ומילה אינה יכולה לומר "מ-18:30", כי זו שעה.**

      ⚠️ ולכן בתא: **מילה פירושה כל היום, ושעה פירושה מאותה שעה.**
      "סגור" ו"לחברים" נשארו מילים, והסגירה המוקדמת היא המספר.

      ⚠️⚠️ ו-`dir="ltr"` על המספר, כי מספר בתוך עברית בלעדיו מתהפך.
      CLAUDE.md, עיצוב. ⚠️ והמשפט המלא נשאר ב-`sr-only`, בריחוף, ובגיליון
      היום. DOCS/PLANING/59
    */
    if (short) {
      return (
        <StatusPill tone="closed" title={full}>
          <span className="num" dir="ltr">
            {access.closesAt}
          </span>
          <span className="sr-only">{full}</span>
        </StatusPill>
      );
    }

    return <StatusPill tone="closed">{full}</StatusPill>;
  }
  return null;
}

/** שם החג. ⚠️ טקסט שקט ולא תגית: הוא מידע, ואינו מצב שדורש פעולה. */
export function DayName({ name }: { name?: string }) {
  if (!name) return null;
  return <span className="truncate text-xs font-medium text-activity">{name}</span>;
}

/*
  ההערה שהמנהלת כתבה ליום. ⚠️ ואינה תופסת מקום כשאין.

  ⚠️⚠️ ומסגרת ולא שורת טקסט. בעל המוצר, 12/10: "גם במובייל ההערה נבלעת".
  נמדד: בלי מסגרת ובלי רקע, בגודל ובצבע של כל טקסט משני אחר בעמודה, ואין
  בה דבר שאומר שזה מה שהמנהלת כתבה. המסגרת והמילה "הערה" הן מה שהופך אותה
  לאובייקט נפרד.

  ⚠️ והגוון שקט ולא אדום. אדום הוא `danger`, הצבע של מחיקה, ושכנו
  `shift-handover` הוא "מבוקש מחליף". הערה אינה אזהרה.

  ⚠️ ובלי חיתוך: הטקסט נשבר לשורות במלואו. היום בתצוגת השבוע נפתח לגובה
  התוכן, ולכן אין כאן את המגבלה של תא הלוח.
*/
export function DayNote({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <div className="flex items-start gap-1.5 rounded-lg bg-surface px-2 py-1.5 ring-1 ring-inset ring-line">
      <span className="shrink-0 text-xs font-medium text-ink-soft">{t.day.noteMark}</span>
      <p className="min-w-0 text-xs leading-snug text-ink">{note}</p>
    </div>
  );
}
