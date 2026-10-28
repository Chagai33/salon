// test/utils/closing.test.ts
//
// ⚠️ חצי שעה לפני האירוע, ומי גרם לה. DOCS/PLANING/38

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  closingCauseOf,
  closingFor,
  derivedClosesAt,
  shiftClashWith,
} from '../../src/utils/closing.ts';

const HOURS = { open: '10:00', close: '22:00' };

describe('השעה שנגזרת', () => {
  it('חצי שעה לפני האירוע', () => {
    assert.equal(derivedClosesAt([{ title: 'NLP הרצאה', startTime: '19:00' }]), '18:30');
  });

  it('⚠️ והמוקדם מבין האירועים קובע, בלי קשר לסדר שבו הם נקראו', () => {
    assert.equal(
      derivedClosesAt([
        { title: 'חוג ערבית', startTime: '20:30' },
        { title: 'פילוסופיה', startTime: '19:00' },
      ]),
      '18:30',
    );
  });

  it('אירוע בלי שעה אינו משתתף', () => {
    assert.equal(derivedClosesAt([{ title: 'משהו' }]), undefined);
    assert.equal(
      derivedClosesAt([{ title: 'משהו' }, { title: 'פילוסופיה', startTime: '19:00' }]),
      '18:30',
    );
  });

  it('רשימה ריקה אינה גוזרת שעה', () => {
    assert.equal(derivedClosesAt([]), undefined);
    assert.equal(derivedClosesAt(undefined), undefined);
  });

  it('⚠️ ואירוע ב-00:15 אינו גוזר שעה, כי הגזירה נופלת לפני חצות', () => {
    assert.equal(derivedClosesAt([{ title: 'משהו', startTime: '00:15' }]), undefined);
  });
});

describe('⚠️ שם האירוע שגרם לסגירה', () => {
  const events = [{ title: 'NLP הרצאה', startTime: '19:00' }];

  it('נאמר כששעת הסגירה באמת נגזרה ממנו', () => {
    assert.equal(closingCauseOf(events, '18:30'), 'NLP הרצאה');
  });

  it('⚠️⚠️ ושעה שהמנהלת כתבה ביד אינה מקבלת שם אירוע', () => {
    assert.equal(closingCauseOf(events, '16:00'), undefined);
  });

  it('יום בלי שעת סגירה אינו מקבל שם', () => {
    assert.equal(closingCauseOf(events, undefined), undefined);
  });
});

describe('מה האירועים עושים למצב היום', () => {
  it('יום פתוח נסגר מוקדם', () => {
    assert.deepEqual(closingFor([{ title: 'א', startTime: '19:00' }], 'open', HOURS), {
      publicAccess: 'closesEarly',
      closesAt: '18:30',
    });
  });

  it('⚠️ ושעה שמוקדמת מהפתיחה סוגרת את היום לציבור, בלי שעה', () => {
    assert.deepEqual(closingFor([{ title: 'א', startTime: '10:00' }], 'open', HOURS), {
      publicAccess: 'closed',
    });
  });

  it('⚠️ ויום שסגור לציבור ממילא אינו נסגר מוקדם', () => {
    assert.equal(closingFor([{ title: 'א', startTime: '19:00' }], 'closed', HOURS), undefined);
  });

  it('⚠️ ובלי שעות פתיחה אין גבול תחתון, ולכן נגזרת שעה', () => {
    assert.deepEqual(closingFor([{ title: 'א', startTime: '10:00' }], 'open', null), {
      publicAccess: 'closesEarly',
      closesAt: '09:30',
    });
  });

  it('יום בלי אירוע עם שעה אינו משנה מצב', () => {
    assert.equal(closingFor([{ title: 'א' }], 'open', HOURS), undefined);
  });
});

// ⚠️⚠️ המשמרת מול שעת הסגירה, והיא הדבר שרשומה 59 נפתחה עליו.
// בלשון בעל המוצר, 28/10: "וגם אם יש אירוע שמתחיל ב 19 אז אין משמרת מ 18".
describe('המשמרת מול שעת הסגירה', () => {
  const EVENING = { startTime: '18:00', endTime: '22:00' };
  const MORNING = { startTime: '10:00', endTime: '14:00' };

  it('⚠️ הסגירה חותכת את משמרת הערב באמצע', () => {
    assert.equal(shiftClashWith(EVENING, '18:30'), 'cut');
  });

  it('⚠️⚠️ והסגירה כולה לפני משמרת שמתחילה ב-19:00, ואין בה אף דקה של סלון פתוח', () => {
    assert.equal(shiftClashWith({ startTime: '19:00', endTime: '22:00' }, '18:30'), 'swallowed');
  });

  it('⚠️ וסגירה בדיוק בשעת ההתחלה בולעת אותה, כי לא נשארת בה דקה', () => {
    assert.equal(shiftClashWith(EVENING, '18:00'), 'swallowed');
  });

  it('משמרת שנגמרת לפני שעת הסגירה אינה מתנגשת', () => {
    assert.equal(shiftClashWith(MORNING, '18:30'), undefined);
  });

  it('⚠️ ומשמרת שנגמרת בדיוק בשעת הסגירה אינה מתנגשת', () => {
    assert.equal(shiftClashWith(MORNING, '14:00'), undefined);
  });

  it('⚠️ ודקה לפני סוף המשמרת היא כבר התנגשות', () => {
    assert.equal(shiftClashWith(MORNING, '13:59'), 'cut');
  });

  it('יום בלי שעת סגירה אינו מתנגש בכלום', () => {
    assert.equal(shiftClashWith(EVENING, undefined), undefined);
  });

  it('⚠️⚠️ ומשמרת שממשיכה למחרת אינה נגמרת עד הסגירה, גם כשהמספר קטן', () => {
    // 22:00 עד 02:00 מול סגירה ב-18:30. השוואת מספרים לבדה הייתה אומרת שהיא תקינה.
    assert.equal(shiftClashWith({ startTime: '22:00', endTime: '02:00' }, '18:30'), 'swallowed');
    assert.equal(shiftClashWith({ startTime: '22:00', endTime: '02:00' }, '23:00'), 'cut');
  });

  it('שעה שאינה בפורמט אינה נמדדת', () => {
    assert.equal(shiftClashWith(EVENING, 'מוקדם'), undefined);
    assert.equal(shiftClashWith({ startTime: '', endTime: '22:00' }, '18:30'), undefined);
  });
});
