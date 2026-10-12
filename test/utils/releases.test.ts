// test/utils/releases.test.ts
//
// ⚠️⚠️ ההכרעות של הדוח, ולא התצוגה שלו.
// DOCS/PLANING/29, 32, 33
//
// הרצה: node --test --experimental-strip-types test/utils/releases.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LATE_HOURS, monthReport, releaseRows } from '../../src/utils/releases.ts';
import type { SalonEvent, Shift } from '../../src/types/index.ts';

/** תאריך ושעה מקומיים, כרגע בזמן. */
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

let seq = 0;
function event(partial: Partial<SalonEvent> = {}): SalonEvent {
  seq += 1;
  return {
    id: `e${seq}`,
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
    const [row] = releaseRows([event()], [shift()]);
    assert.equal(row.memberId, 'dana');
    assert.equal(row.byManager, false);
  });

  it('⚠️⚠️ שחרור בידי מנהלת מצביע על מי שאיבד את המשמרת, ומסומן', () => {
    const [row] = releaseRows([event({ actorMemberId: 'yael' })], [shift()]);
    assert.equal(row.memberId, 'dana');
    assert.equal(row.byManager, true);
  });

  it('שורות שאינן שחרור אינן נכנסות לדוח', () => {
    const rows = releaseRows([event({ action: 'handoverRequested' })], [shift()]);
    assert.equal(rows.length, 0);
  });
});

describe('⚠️⚠️ שחרור שבוטל אינו נספר, רשומה 32', () => {
  it('שחרר ותפס שוב את אותה משמרת: אין שורה', () => {
    // זה המקרה מהצילום של בעל המוצר, 12/10.
    const rows = releaseRows(
      [
        event({ at: at('2026-10-12', 13, 20) }),
        event({ action: 'shiftAssigned', at: at('2026-10-12', 13, 21), subjectMemberId: undefined }),
      ],
      [shift({ assigneeMemberId: 'dana' })],
    );
    assert.equal(rows.length, 0);
  });

  it('⚠️ ובלי שורת הלקיחה, המשמרת עצמה מכריעה: הוא מחזיק אותה, ולכן חזר', () => {
    const rows = releaseRows([event()], [shift({ assigneeMemberId: 'dana' })]);
    assert.equal(rows.length, 0);
  });

  it('⚠️ ומי שחזר ומסר אותה בהחלפה גם הוא חזר', () => {
    const rows = releaseRows(
      [
        event({ at: at('2026-10-02', 9) }),
        event({ action: 'shiftAssigned', at: at('2026-10-03', 9), subjectMemberId: undefined }),
      ],
      [shift({ assigneeMemberId: 'noa', handoverFromMemberId: 'dana', handoverState: 'completed' })],
    );
    assert.equal(rows.length, 0);
  });

  it('⚠️ אבל אם מישהו אחר לקח, השחרור נשאר', () => {
    const rows = releaseRows(
      [
        event({ at: at('2026-10-02', 9) }),
        event({ action: 'shiftAssigned', actorMemberId: 'noa', at: at('2026-10-03', 9) }),
      ],
      [shift({ assigneeMemberId: 'noa', assigneeName: 'נועה בובר' })],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].after, 'taken');
  });

  it('⚠️⚠️ שחרר, חזר, ושחרר שוב: שחרור אחד ולא שניים ולא אפס', () => {
    const rows = releaseRows(
      [
        event({ at: at('2026-10-02', 9) }),
        event({ action: 'shiftAssigned', at: at('2026-10-02', 9, 5), subjectMemberId: undefined }),
        event({ at: at('2026-10-05', 9) }),
      ],
      [shift()],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].at, at('2026-10-05', 9));
  });
});

describe('כמה זמן לפני, וסף 24 השעות', () => {
  it(`⚠️ הסף הוא ${LATE_HOURS} שעות, בהכרעת בעל המוצר 12/10`, () => {
    assert.equal(LATE_HOURS, 24);
  });

  it('נמדד מתחילת המשמרת ולא מחצות', () => {
    const [row] = releaseRows([event({ at: at('2026-10-14', 8) })], [shift()]);
    assert.equal(row.noticeHours, 2);
    assert.equal(row.late, true);
  });

  it('25 שעות לפני אינו ברגע האחרון', () => {
    const [row] = releaseRows([event({ at: at('2026-10-13', 9) })], [shift()]);
    assert.equal(row.late, false);
  });

  it('⚠️ ושחרור אחרי שהמשמרת התחילה הוא ברגע האחרון, ולא "לא ידוע"', () => {
    const [row] = releaseRows([event({ at: at('2026-10-14', 11) })], [shift()]);
    assert.ok((row.noticeHours ?? 0) < 0);
    assert.equal(row.late, true);
  });

  it('בלי תאריך ובלי משמרת אין מה לחשב, וזה אינו "ברגע האחרון"', () => {
    const [row] = releaseRows([event({ shiftDate: undefined, shiftId: undefined })], []);
    assert.equal(row.noticeHours, null);
    assert.equal(row.late, false);
  });
});

describe('מה קרה אחרי', () => {
  it('נשארה בלי אחראי', () => {
    const [row] = releaseRows([event()], [shift()]);
    assert.equal(row.after, 'open');
  });

  it('⚠️ משמרת שאינה במסד אינה "נשארה בלי אחראי"', () => {
    const [row] = releaseRows([event()], []);
    assert.equal(row.after, 'unknown');
  });
});

describe('⚠️⚠️ החודש: שורה לכל אדם, רשומה 33', () => {
  const OCT = '2026-10';

  it('ארבעת המספרים', () => {
    const report = monthReport(
      [
        event({ at: at('2026-10-13', 20) }),
        event({ shiftId: '2026-10-20_morning', shiftDate: '2026-10-20', subjectMemberId: 'yoav', actorMemberId: 'yoav', at: at('2026-10-01', 9) }),
      ],
      [
        shift(),
        shift({ id: '2026-10-20_morning', date: '2026-10-20', assigneeMemberId: 'noa' }),
        shift({ id: '2026-10-21_morning', date: '2026-10-21', assigneeMemberId: 'maya' }),
      ],
      OCT,
      new Set(),
      at('2026-10-12', 9),
    );
    assert.equal(report.shifts, 3);
    assert.equal(report.assigned, 2);
    assert.equal(report.releases, 2);
    assert.equal(report.people, 2);
    assert.equal(report.late, 1);
    assert.equal(report.uncovered, 1);
  });

  it('⚠️ יום שהמנהלת סגרה לחברים אינו נספר במשמרות החודש', () => {
    const report = monthReport([], [shift(), shift({ id: 'x', date: '2026-10-15' })], OCT, new Set(['2026-10-15']));
    assert.equal(report.shifts, 1);
  });

  it('שני שחרורים של אותו אדם הם שורה אחת, עם שני פרטים', () => {
    const report = monthReport(
      [
        event({ at: at('2026-10-01', 9) }),
        event({ shiftId: '2026-10-20_morning', shiftDate: '2026-10-20', at: at('2026-10-02', 9) }),
      ],
      [shift(), shift({ id: '2026-10-20_morning', date: '2026-10-20' })],
      OCT,
      new Set(),
      at('2026-10-12', 9),
    );
    assert.equal(report.rows.length, 1);
    assert.equal(report.rows[0].releases, 2);
    assert.equal(report.rows[0].rows.length, 2);
  });

  it('⚠️ שחרור בידי מנהלת נספר לאדם שאיבד, ונספר בנפרד', () => {
    const report = monthReport([event({ actorMemberId: 'yael' })], [shift()], OCT, new Set(), at('2026-10-12', 9));
    assert.equal(report.rows[0].memberId, 'dana');
    assert.equal(report.rows[0].byManager, 1);
  });

  it('⚠️ השחרור שייך לחודש של המשמרת, ולא לחודש שבו לחצו', () => {
    const report = monthReport([event({ at: at('2026-09-28', 9) })], [shift()], OCT, new Set(), at('2026-10-12', 9));
    assert.equal(report.releases, 1);
    const september = monthReport([event({ at: at('2026-09-28', 9) })], [shift()], '2026-09', new Set(), at('2026-10-12', 9));
    assert.equal(september.releases, 0);
  });

  it('⚠️ מה שדורש תשומת לב ראשון: ברגע האחרון לפני מספר השחרורים', () => {
    const report = monthReport(
      [
        event({ subjectMemberId: 'maya', actorMemberId: 'maya', at: at('2026-10-01', 9) }),
        event({ subjectMemberId: 'maya', actorMemberId: 'maya', shiftId: 's2', shiftDate: '2026-10-20', at: at('2026-10-01', 9) }),
        event({ subjectMemberId: 'yoav', actorMemberId: 'yoav', shiftId: 's3', shiftDate: '2026-10-22', at: at('2026-10-22', 8) }),
      ],
      [shift(), shift({ id: 's2', date: '2026-10-20' }), shift({ id: 's3', date: '2026-10-22' })],
      OCT,
      new Set(),
      at('2026-10-12', 9),
    );
    assert.deepEqual(report.rows.map((row) => row.memberId), ['yoav', 'maya']);
  });
});

describe('⚠️⚠️ משמרת אחרת באותו חודש, בשלושה ערכים', () => {
  const OCT = '2026-10';

  it('עשה משמרת אחרת', () => {
    const report = monthReport(
      [event()],
      [shift(), shift({ id: 's2', date: '2026-10-20', assigneeMemberId: 'dana' })],
      OCT,
      new Set(),
      at('2026-11-05', 9),
    );
    assert.equal(report.rows[0].month, 'otherShift');
  });

  it('⚠️ ומשמרת שמסר בהחלפה שהושלמה נספרת גם היא', () => {
    const report = monthReport(
      [event()],
      [shift(), shift({ id: 's2', date: '2026-10-20', assigneeMemberId: 'noa', handoverFromMemberId: 'dana', handoverState: 'completed' })],
      OCT,
      new Set(),
      at('2026-11-05', 9),
    );
    assert.equal(report.rows[0].month, 'otherShift');
  });

  it('⚠️ ובקשה שלא נענתה אינה משמרת שנמסרה', () => {
    const report = monthReport(
      [event()],
      [shift(), shift({ id: 's2', date: '2026-10-20', assigneeMemberId: 'noa', handoverFromMemberId: 'dana', handoverState: 'requested' })],
      OCT,
      new Set(),
      at('2026-11-05', 9),
    );
    assert.equal(report.rows[0].month, 'none');
  });

  it('לא עשה, והחודש נגמר', () => {
    const report = monthReport([event()], [shift()], OCT, new Set(), at('2026-11-05', 9));
    assert.equal(report.rows[0].month, 'none');
  });

  it('⚠️⚠️ והחודש שעוד פתוח אינו "לא עשה"', () => {
    const report = monthReport([event()], [shift()], OCT, new Set(), at('2026-10-14', 9));
    assert.equal(report.rows[0].month, 'monthOpen');
  });
});
