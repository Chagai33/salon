// src/components/board/DayEvents.tsx
//
// האירועים של יום אחד.
//
// ⚠️ השעה לפני השם וברצועה ברוחב קבוע, ולא אחריו בטקסט זורם.
// זה מה שהופך עמודה בלוח לסריקה אנכית: כל השעות מיושרות זו מתחת לזו.
//
// ⚠️⚠️ והרווח הוא `gap` ולא `ms-1`. בצילום של בעל המוצר, 06/10, השעה והשם
// נדבקו למילה אחת: "19:00פילוסופיה". DOCS/PLANING/26
//
// ⚠️ ואין תגית "יש פעילות" מעל הרשימה. הרשימה עצמה אומרת את זה, ותגית מעליה
// היא אותה עובדה פעמיים.

import type { ActivityEvent } from '../../types';
import { t } from '../../i18n/dictionary';

/**
 * ⚠️ אירוע ששמו הוא שם החג של אותו יום אינו מצויר שוב.
 * ב-3 באוקטובר "שמחת תורה" הופיע ליד מספר היום וגם ברשימה, כי הייבוא כתב
 * אותו גם כאירוע. DOCS/PLANING/26
 */
export function eventsWorthShowing(events: ActivityEvent[] | undefined, name: string | undefined): ActivityEvent[] {
  if (!events?.length) return [];
  if (!name) return events;
  return events.filter((event) => event.title.trim() !== name.trim());
}

function timeOf(event: ActivityEvent): string {
  if (!event.startTime) return '';
  return event.endTime ? `${event.startTime}-${event.endTime}` : event.startTime;
}

interface Props {
  events: ActivityEvent[];
  /** כמה שורות מותר לצייר. ⚠️ בלוח החודש אחת, והיתר נספרות. */
  limit?: number;
  size?: 'sm' | 'xs';
  /**
   * ⚠️⚠️ השם בלבד, בשורה אחת, בלי רצועת השעות. לתא בלוח החודש.
   *
   * **נמדד שרצועת השעות היא 44 פיקסלים בתא שרוחבו 96**, כלומר כמעט חצי
   * מהתא, ⚠️ **ושם האירוע נדחק למה שנשאר ונשבר לשתי שורות.**
   *
   * ⚠️ **והשעות לא נמחקו:** הן בגיליון היום, שנפתח בלחיצה על היום.
   * DOCS/PLANING/58
   */
  compact?: boolean;
}

export function DayEvents({ events, limit, size = 'xs', compact = false }: Props) {
  if (events.length === 0) return null;

  const shown = limit ? events.slice(0, limit) : events;
  const hidden = events.length - shown.length;
  const text = size === 'sm' ? 'text-sm' : 'text-xs';

  /* ⚠️ השם בלבד, שורה אחת, ובלי שבירה. בתא הלוח אין מקום ליותר. */
  if (compact) {
    return (
      <ul className={`flex flex-col ${text} leading-tight`}>
        {shown.map((event, index) => (
          <li key={index} className="truncate text-activity">
            {event.title}
          </li>
        ))}
        {hidden > 0 && <li className="num text-ink-faint">+{hidden}</li>}
      </ul>
    );
  }

  return (
    <ul className={`flex flex-col gap-0.5 ${text} leading-tight`}>
      {shown.map((event, index) => (
        <li key={index} className="flex items-baseline gap-2">
          {/* ⚠️ רוחב קבוע, כדי שהשמות יתחילו באותו קו בכל שורות העמודה. */}
          <span className="num w-11 shrink-0 text-ink-faint">{timeOf(event)}</span>
          {/*
            ⚠️⚠️ ואירוע שחוצה חצות אומר זאת במילה.
            "23:00-01:00" בלי המילה נקרא כמו שעות שהתהפכו, וזו בדיוק הטעות
            שהבדיקה בשמירה חוסמת. DOCS/PLANING/42
          */}
          {event.endsNextDay && (
            <span className="shrink-0 text-ink-faint">{t.day.nextDay}</span>
          )}
          {/*
            ⚠️⚠️ ואינו נחתך.
            בלשון בעל המוצר, 06/10: "אם יש אירוע כמו ארוחת שישי שזה לא
            ייחתך". `truncate` חתך שם באמצע מילה. DOCS/PLANING/26
          */}
          <span className="line-clamp-2 min-w-0 break-words text-activity">{event.title}</span>
        </li>
      ))}
      {hidden > 0 && <li className="num text-ink-faint">+{hidden}</li>}
    </ul>
  );
}
