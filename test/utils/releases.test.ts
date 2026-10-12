// test/utils/releases.test.ts
//
// ⚠️⚠️ שלוש ההכרעות של הדוח, ולא התצוגה שלו.
// DOCS/PLANING/29-nothing-records-that-someone-cancelled.md
//
// הרצה: node --test --experimental-strip-types test/utils/releases.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { releaseRows } from '../../src/utils/releases.ts';
import type { SalonEvent, Shift } from '../../src/types/index.ts';

/** `2026-10-14` בשעה 09:00 מקומית, כרגע בזמן. */
function at(dateKey: string, hour: number, minute = 0): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function shift(partial: Partial<Shift> = {}): Shift {
  return {
    id: '2026-10-14_morning',
    branchId: 'tel-aviv',
    date: '2026-10-14',
    templateId: 'morning',
    startTime: '10:00',
    endTime: '14:00',
    attendance: 'assumed',
    handoverState: 'none',
    ...partial,
  };
}

function released(partial: Partial<SalonEvent> = {}): SalonEvent {
  return {
    id: 'e1',
    at: at('2026-10-01', 12),
    actorMemberId: 'dana',
    action: 'shiftReleased',
    shiftId: '2026-10-14_morning',
    shiftDate: '2026-10-14',
    subjectMemberId: 'dana',
    ...partial,
  };
}

describe('על מי הדוח מצביע', () => {
  it('שחרור של עצמי מצביע עליי, ואינו מסומן כשחרור של מנהלת', () => {
    const [row] = releaseRows([released()], [shift()], at('2026-11-05', 9));
    assert.equal(row.memberId, 'dana');
    assert.equal(row.byManager, false);
  });

  it('⚠️⚠️ שחרור בידי מנהלת מצביע על מי שאיבד את המשמרת, ולא על המנהלת', () => {
    // בהכרעת בעל המוצר 12/10. שורה שמטילה את זה על החבר שולחת את המנהלת
    // לדבר עם האדם הלא נכון.
    const [row] = releaseRows(
      [released({ actorMemberId: 'yael', subjectMemberId: 'dana' })],
      [shift()],
      at('2026-11-05', 9),
    );
    assert.equal(row.memberId, 'dana');
    assert.equal(row.byManager, true);
  });

  it('שורה שאין לה נושא אינה ממציאה אדם', () => {
    const [row] = releaseRows(
      [released({ subjectMemberId: undefined })],
      [shift()],
      at('2026-11-05', 9),
    );
    assert.equal(row.memberId, null);
    assert.equal(row.byManager, false);
  });

  it('⚠️ ושורות שאינן שחרור אינן נכנסות לדוח', () => {
    const rows = releaseRows(
      [released({ id: 'e2', action: 'handoverRequested' })],
      [shift()],
      at('2026-11-05', 9),
    );
    assert.equal(rows.length, 0);
  });
});

describe('כמה זמן לפני', () => {
  it('⚠️ נמדד מתחילת המשמרת ולא מחצות', () => {
    // שוחררה ב-14/10 בשעה 08:00, והמשמרת מתחילה ב-10:00.
    const [row] = releaseRows(
      [released({ at: at('2026-10-14', 8) })],
      [shift()],
      at('2026-11-05', 9),
    );
    assert.equal(row.noticeHours, 2);
  });

  it('שחרור שלושה עשר ימים לפני', () => {
    const [row] = releaseRows([released()], [shift()], at('2026-11-05', 9));
    // 01/10 בשעה 12:00 עד 14/10 בשעה 10:00.
    assert.equal(Math.floor((row.noticeHours ?? 0) / 24), 12);
  });

  it('⚠️ ושחרור אחרי שהמשמרת התחילה הוא שלילי, ולא אפס', () => {
    const [row] = releaseRows(
      [released({ at: at('2026-10-14', 11) })],
      [shift()],
      at('2026-11-05', 9),
    );
    assert.ok((row.noticeHours ?? 0) < 0);
  });

  it('בלי תאריך על השורה ובלי משמרת במסד אין מה לחשב', () => {
    const [row] = releaseRows(
      [released({ shiftDate: undefined, shiftId: undefined })],
      [],
      at('2026-11-05', 9),
    );
    assert.equal(row.noticeHours, null);
  });
});

describe('מה קרה אחרי', () => {
  it('מישהו לקח', () => {
    const [row] = releaseRows(
      [released()],
      [shift({ assigneeMemberId: 'noa', assigneeName: 'נועה בובר' })],
      at('2026-11-05', 9),
    );
    assert.equal(row.after, 'taken');
    assert.equal(row.afterName, 'נועה בובר');
  });

  it('נשארה בלי אחראי', () => {
    const [row] = releaseRows([released()], [shift()], at('2026-11-05', 9));
    assert.equal(row.after, 'open');
  });

  it('⚠️ ומשמרת שאינה במסד אינה "נשארה בלי אחראי"', () => {
    // משמרת שנמחקה או שינתה מזהה. "לא ידוע" ו"פתוחה" אינם אותו דבר.
    const [row] = releaseRows([released()], [], at('2026-11-05', 9));
    assert.equal(row.after, 'unknown');
  });
});

describe('⚠️⚠️ משמרת אחרת באותו חודש, בשלושה ערכים', () => {
  it('עשה משמרת אחרת באותו חודש', () => {
    const rows = releaseRows(
      [released()],
      [
        shift(),
        shift({ id: '2026-10-20_morning', date: '2026-10-20', assigneeMemberId: 'dana' }),
      ],
      at('2026-11-05', 9),
    );
    assert.equal(rows[0].month, 'otherShift');
  });

  it('⚠️ ומשמרת שמסר בהחלפה שהושלמה נספרת גם היא', () => {
    // זו אותה נוסחה כמו הזכאות: מי שמצא מחליף שומר אותה. DOCS/PLANING/10
    const rows = releaseRows(
      [released()],
      [
        shift(),
        shift({
          id: '2026-10-20_morning',
          date: '2026-10-20',
          assigneeMemberId: 'noa',
          handoverFromMemberId: 'dana',
          handoverState: 'completed',
        }),
      ],
      at('2026-11-05', 9),
    );
    assert.equal(rows[0].month, 'otherShift');
  });

  it('⚠️ ובקשה שלא נענתה אינה משמרת שנמסרה', () => {
    const rows = releaseRows(
      [released()],
      [
        shift(),
        shift({
          id: '2026-10-20_morning',
          date: '2026-10-20',
          assigneeMemberId: 'noa',
          handoverFromMemberId: 'dana',
          handoverState: 'requested',
        }),
      ],
      at('2026-11-05', 9),
    );
    assert.equal(rows[0].month, 'none');
  });

  it('לא עשה, והחודש נגמר', () => {
    const [row] = releaseRows([released()], [shift()], at('2026-11-05', 9));
    assert.equal(row.month, 'none');
  });

  it('⚠️⚠️ והחודש שעוד פתוח אינו "לא עשה"', () => {
    // דוח שמוצג ב-14 בחודש ומראה "לא עשה" על מי שיירשם ב-28 אומר דבר שלא
    // נמדד, וזו בדיוק הטעות ש-assumed נולד כדי למנוע. DOCS/PLANING/09
    const [row] = releaseRows([released()], [shift()], at('2026-10-14', 9));
    assert.equal(row.month, 'monthOpen');
  });

  it('⚠️ והמשמרת ששוחררה עצמה אינה נספרת כמשמרת אחרת', () => {
    // אחרי השחרור השדות שלה נמחקו, אבל מנהלת יכולה לשבץ אליה את אותו אדם
    // מחדש. ⚠️ ואז זו באמת משמרת שלו, ולכן המקרה שנבדק הוא ההפוך: משמרת
    // שעוד נושאת אותו ואינה אמורה להיספר.
    const rows = releaseRows(
      [released()],
      [shift({ assigneeMemberId: 'dana' })],
      at('2026-11-05', 9),
    );
    assert.equal(rows[0].month, 'none');
  });
});

describe('הנוכחות', () => {
  it('⚠️ `assumed` עובר כמו שהוא, ואינו הופך ל"הגיע"', () => {
    const [row] = releaseRows([released()], [shift()], at('2026-11-05', 9));
    assert.equal(row.attendance, 'assumed');
  });

  it('`noShow` עובר כמו שהוא', () => {
    const [row] = releaseRows(
      [released()],
      [shift({ attendance: 'noShow' })],
      at('2026-11-05', 9),
    );
    assert.equal(row.attendance, 'noShow');
  });
});

describe('הסדר', () => {
  it('האחרון ראשון', () => {
    const rows = releaseRows(
      [
        released({ id: 'old', at: at('2026-10-01', 9) }),
        released({ id: 'new', at: at('2026-10-05', 9) }),
      ],
      [shift()],
      at('2026-11-05', 9),
    );
    assert.deepEqual(
      rows.map((row) => row.eventId),
      ['new', 'old'],
    );
  });
});
