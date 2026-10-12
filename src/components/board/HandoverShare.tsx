// src/components/board/HandoverShare.tsx
//
// הלינק שחבר משתף בקבוצת הוואטסאפ של הסלון.
// DOCS/PLANING/28-a-link-to-the-whatsapp-group-and-no-email.md
//
// ⚠️⚠️ והמוצר אינו השולח, וזו כל ההכרעה.
//
// בלשון בעל המוצר: "אם כבר בוא נייצר לינק כשמישהו מבקש מחליף ואת הלינק הוא
// משתף בקבוצת הווצאפ של הסלון, ורק מי שלחץ על הלינק מחליט אם ללחוץ או לא."
// כלומר אין רשימת נמענים, אין דואר יוצא, ומי שמפרסם הוא החבר ברשות שלו.
//
// ⚠️ ואין בלינק טוקן, ואסור שיהיה לו.
// השער שלפני הלוח כבר קיים: מי שאינו חבר רואה מסך הצטרפות, ומי שממתין
// לאישור רואה מסך המתנה. לינק חתום שמדלג על אישור המנהלת הוא דלת צד לסלון.
//
// ⚠️ והטקסט שמועתק אינו נושא שם ואינו נושא סיבה. מי שמדביק מופיע בקבוצה
// בשמו ממילא, והסיבה נכתבה למנהלת.

import { useState } from 'react';
import { Button } from '../common/Button';
import type { Shift } from '../../types';
import { t } from '../../i18n/dictionary';
import { shortDateLabel } from '../../utils/dates';

/** ⚠️ `origin` מהדפדפן ולא מחרוזת קשיחה, כדי שבפיתוח ובאתר החי ייכתב מה
 *  שבאמת יהיה. אותו תקדים כמו בכתובת הסלון ב-SalonsPage. */
export function shiftLinkFor(branchId: string, shiftId: string): string {
  return `${window.location.origin}/s/${branchId}/shift/${shiftId}`;
}

export function HandoverShare({ branchId, shift }: { branchId: string; shift: Shift }) {
  /** ⚠️ `failed` אינו תקלה שמסתירים: הוא מציג את הטקסט להעתקה ביד. */
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const link = shiftLinkFor(branchId, shift.id);
  const message = t.handoverLink.message(
    shortDateLabel(shift.date),
    shift.startTime,
    shift.endTime,
    link,
  );

  async function copy() {
    try {
      // ⚠️ לוח ההעתקה אינו קיים בכל הקשר: בלי חיבור מאובטח, ובלי הרשאה, הוא
      // זורק. לכן יש מצב שני ולא רק הודעת כשל.
      await navigator.clipboard.writeText(message);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface-sunken p-3">
      <p className="text-sm text-ink-soft">{t.handoverLink.hint}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button tone="secondary" size="sm" onClick={() => void copy()}>
          {t.handoverLink.copy}
        </Button>
        {/* ⚠️ מילה ולא צבע לבד. CLAUDE.md, עיצוב. */}
        {state === 'copied' && <span className="text-sm text-ink-soft">{t.handoverLink.copied}</span>}
        {state === 'failed' && <span className="text-sm text-danger">{t.handoverLink.failed}</span>}
      </div>

      {/*
        ⚠️ הלינק מוצג תמיד, ולא רק כשההעתקה נכשלה.
        מי שמשתף רוצה לראות מה הוא עומד לשלוח, ⚠️ והוא נושא dir="ltr" כי
        כתובת נקראת משמאל גם בתוך עברית.
      */}
      <code dir="ltr" className="num block break-all text-xs text-ink-faint">
        {link}
      </code>

      {state === 'failed' && (
        <textarea
          readOnly
          rows={3}
          value={message}
          /* ⚠️ לקריאה ולהעתקה ביד, ואינו טופס. */
          className="w-full rounded-md border border-line bg-surface p-2 text-xs text-ink"
        />
      )}
    </section>
  );
}
