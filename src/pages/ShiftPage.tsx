// src/pages/ShiftPage.tsx
//
// המסך שהלינק של בקשת המחליף מגיע אליו.
// DOCS/PLANING/28-a-link-to-the-whatsapp-group-and-no-email.md
//
// ⚠️⚠️ ארבעה מצבים ואין חמישי, בהכרעת בעל המוצר 12/10:
//   הבקשה פתוחה, מישהו כבר לקח, הבקשה בוטלה, והתאריך עבר.
// שלושת הראשונים נגזרים מ-`handoverState` ומ-`assigneeMemberId` שכבר קיימים
// על המשמרת, והרביעי מהתאריך. אין שדה חדש ואין טוקן.
//
// ⚠️ ולינק מיושן אינו מפנה לדף הבית. מי שלוחץ על בקשה שנסגרה מקבל משפט,
// ולא מגלה את עצמו בדף הבית בלי להבין למה.
//
// ⚠️ והמסך יושב מאחורי אותו שער כמו הלוח: BranchScope כבר עצר זר שאינו חבר
// ומי שממתין לאישור, לפני שהקוד הזה נטען בכלל.

import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../components/common/Button';
import { HandoverShare } from '../components/board/HandoverShare';
import { useShiftBinding } from '../hooks/useSalon';
import { useStore } from '../store/useStore';
import { claimShift } from '../services/salonService';
import { t } from '../i18n/dictionary';
import { WEEKDAY_NAMES, isPast, shortDateLabel, weekdayOf } from '../utils/dates';
import { displayName } from '../utils/names';
import { toReadableError } from '../utils/errors';
import type { Shift } from '../types';

type LinkState = 'past' | 'mine' | 'open' | 'taken' | 'cancelled';

/**
 * ⚠️ העבר קודם, וזה לא סדר שרירותי: משמרת שעברה אינה ניתנת ללקיחה גם כשהבקשה
 * עליה נשארה פתוחה, ולכן "עברה" גובר על "מבוקש מחליף".
 */
export function linkStateOf(shift: Shift, memberId: string | null): LinkState {
  if (isPast(shift.date)) return 'past';
  if (shift.handoverState === 'requested') {
    // ⚠️ הלינק מגיע גם למי ששיתף אותו, והוא אינו מחליף של עצמו.
    return shift.assigneeMemberId === memberId ? 'mine' : 'open';
  }
  if (shift.handoverState === 'completed') return 'taken';
  // ⚠️ `none` הוא בקשה שבוטלה, בין שהמשמרת נשארה אצל מי שביקש ובין ששוחררה.
  // מצב חמישי אין, בהכרעת 12/10.
  return 'cancelled';
}

function Card({
  title,
  body,
  back,
  children,
}: {
  title: string;
  body: string;
  /** ⚠️ הכתובת המלאה של הלוח ולא נתיב יחסי: `..` מכתובת המשמרת מוביל
   *  ל-`/s/<סלון>/shift`, שאינו מסך. */
  back: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-soft">
        <div>
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
        </div>
        {children}
        <Link to={back} className="text-sm text-brand underline-offset-4 hover:underline">
          {t.shiftLink.back}
        </Link>
      </article>
    </div>
  );
}

export function ShiftPage() {
  const { branchId = '', shiftId = '' } = useParams();
  useShiftBinding(branchId, shiftId);

  const shift = useStore((state) => state.linkedShift);
  const loading = useStore((state) => state.isLinkedShiftLoading);
  const member = useStore((state) => state.member);
  const setError = useStore((state) => state.setError);
  const [busy, setBusy] = useState(false);

  if (loading && !shift) {
    return <main className="p-6 text-ink-soft">{t.board.loading}</main>;
  }

  const back = `/s/${branchId}`;

  if (!shift) {
    return <Card title={t.shiftLink.notFoundTitle} body={t.shiftLink.notFoundBody} back={back} />;
  }

  const state = linkStateOf(shift, member?.id ?? null);
  const canAct = member?.status === 'active';

  /* ⚠️ שורה אחת של עובדות, ולא פסקה. יום בשבוע, תאריך, ושעות. */
  const when = (
    <p className="text-sm text-ink">
      {WEEKDAY_NAMES[weekdayOf(shift.date)]}, {shortDateLabel(shift.date)},{' '}
      {/* ⚠️ מקף טווח ולא מקף מפריד, וב-num כמו בכל הלוח. */}
      <span className="num" dir="ltr">
        {shift.startTime}-{shift.endTime}
      </span>
    </p>
  );

  if (state === 'past') {
    return (
      <Card title={t.shiftLink.pastTitle} body={t.shiftLink.pastBody} back={back}>
        {when}
      </Card>
    );
  }

  if (state === 'cancelled') {
    return (
      <Card title={t.shiftLink.cancelledTitle} body={t.shiftLink.cancelledBody} back={back}>
        {when}
      </Card>
    );
  }

  if (state === 'taken') {
    // ⚠️ ומי שלקח אותה בעצמו רואה שהוא לקח, ולא ש"מישהו אחר הקדים".
    const byMe = Boolean(member) && shift.assigneeMemberId === member!.id;
    return (
      <Card
        title={byMe ? t.shiftLink.tookItTitle : t.shiftLink.takenTitle}
        body={byMe ? t.shiftLink.tookItBody : t.shiftLink.takenBody}
        back={back}
      >
        {when}
        {/* ⚠️ מי מחזיק אותה עכשיו נאמר, כי זו קהילה ולא לוח אנונימי.
            DOCS/PLANING/10 */}
        {!byMe && shift.assigneeName && (
          <p className="text-sm text-ink-soft">
            {t.shiftLink.heldBy(displayName(shift.assigneeName))}
          </p>
        )}
      </Card>
    );
  }

  if (state === 'mine') {
    return (
      <Card title={t.shiftLink.mineTitle} body={t.shiftLink.mineBody} back={back}>
        {when}
        {/* ⚠️ ומי שמגיע ללינק של עצמו מקבל את הלינק להעתקה שוב, ולא כפתור
            שהיה כותב אותו גם כמוסר וגם כלוקח. */}
        <HandoverShare branchId={branchId} shift={shift} />
      </Card>
    );
  }

  return (
    <Card title={t.shiftLink.openTitle} body={t.shiftLink.openBody} back={back}>
      {when}
      {shift.assigneeName && (
        <p className="text-sm text-ink-soft">
          {t.shiftLink.heldBy(displayName(shift.assigneeName))}
        </p>
      )}

      {canAct ? (
        <div>
          <Button
            tone="primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void claimShift(branchId, shift.id, member!.id, member!.displayName)
                .catch((error: unknown) => setError(toReadableError(error, t.shift.claimFailed)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? t.shift.claiming : t.shift.takeOver}
          </Button>
        </div>
      ) : (
        /* ⚠️ חבר שהושבת מגיע לכאן, כי מסך ההמתנה חוסם רק `pending`. */
        <p className="text-sm text-ink-faint">{t.shift.notAllowed}</p>
      )}
    </Card>
  );
}
