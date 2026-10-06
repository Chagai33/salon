// test/functions/board-image.test.mjs
//
// ⚠️ מה שעומד בין תשובת המודל ובין המסד הוא הסינון, ולכן הוא מה שנבדק.
// סכימה אינה הבטחה: המודל יכול להחזיר תאריך מחודש אחר או שעה בפורמט אחר,
// למרות שההנחיה אמרה אחרת.
//
// הרצה: node --test test/functions/*.test.mjs

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL,
  promptFor,
  requestBodyFor,
  sanitiseDays,
} from '../../functions/board-image.mjs';

const MONTH = '2026-10';

describe('הסינון', () => {
  it('⚠️ תאריך מחודש אחר נזרק', () => {
    const days = sanitiseDays(
      { days: [
        { date: '2026-10-07', access: 'unknown', confidence: 1, events: [{ title: 'פילוסופיה' }] },
        { date: '2026-11-07', access: 'unknown', confidence: 1, events: [{ title: 'לא בחודש' }] },
      ] },
      MONTH,
    );
    assert.deepEqual(days.map((d) => d.date), ['2026-10-07']);
  });

  it('⚠️⚠️ מצב גישה שאינו מוכר הופך ל-unknown ולא ל-open', () => {
    // זה הממצא שהלוח האמיתי חשף: ברירת מחדל open הייתה חותמת "פתוח לכולם"
    // על שישי ושבת ומוחקת את כלל סוף השבוע.
    for (const access of [undefined, '', 'maybe', 'OPEN', null]) {
      const [day] = sanitiseDays(
        { days: [{ date: '2026-10-09', access, confidence: 1, note: 'שישי' }] },
        MONTH,
      );
      assert.equal(day.access, 'unknown', `access=${String(access)}`);
    }
  });

  it('מצב גישה מוכר נשמר', () => {
    for (const access of ['open', 'membersOnly', 'closed']) {
      const [day] = sanitiseDays(
        { days: [{ date: '2026-10-09', access, confidence: 1 }] },
        MONTH,
      );
      assert.equal(day.access, access);
    }
  });

  it('⚠️ שעה בפורמט שאינו HH:MM נזרקת, והאירוע נשאר', () => {
    const [day] = sanitiseDays(
      { days: [{ date: '2026-10-14', access: 'unknown', confidence: 1,
        events: [{ title: 'סינמה בסלון', startTime: '19.30', endTime: '21:00' }] }] },
      MONTH,
    );
    assert.equal(day.events[0].title, 'סינמה בסלון');
    assert.equal(day.events[0].startTime, undefined);
    assert.equal(day.events[0].endTime, '21:00');
  });

  it('אירוע בלי כותרת נזרק', () => {
    const days = sanitiseDays(
      { days: [{ date: '2026-10-14', access: 'unknown', confidence: 1,
        events: [{ title: '   ' }, { title: 'מקהלה' }] }] },
      MONTH,
    );
    assert.deepEqual(days[0].events.map((e) => e.title), ['מקהלה']);
  });

  it('⚠️ שני אירועים ליום אחד נשמרים, כמו בלוח שנמדד', () => {
    const [day] = sanitiseDays(
      { days: [{ date: '2026-10-18', access: 'unknown', confidence: 0.93, events: [
        { title: 'הפנינג פתיחת שנת הלימודים', startTime: '17:00' },
        { title: 'קבוצת ריצה', startTime: '18:15' },
      ] }] },
      MONTH,
    );
    assert.equal(day.events.length, 2);
  });

  it('כותרת עם מרכאות נשמרת כמו שהיא', () => {
    const [day] = sanitiseDays(
      { days: [{ date: '2026-10-19', access: 'unknown', confidence: 1,
        events: [{ title: 'השקת ספר "איך היא אוחזת"' }] }] },
      MONTH,
    );
    assert.equal(day.events[0].title, 'השקת ספר "איך היא אוחזת"');
  });

  it('⚠️ יום בלי אירוע, בלי הערה ובלי מצב אינו מוחזר בכלל', () => {
    const days = sanitiseDays(
      { days: [{ date: '2026-10-21', access: 'unknown', confidence: 0.9, events: [] }] },
      MONTH,
    );
    assert.equal(days.length, 0);
  });

  it('חג בלי אריח מוחזר דרך note', () => {
    const days = sanitiseDays(
      { days: [{ date: '2026-10-03', access: 'unknown', confidence: 0.9, note: 'שמחת תורה', events: [] }] },
      MONTH,
    );
    assert.equal(days[0].note, 'שמחת תורה');
  });

  it('תשובה שאינה מה שציפינו לה אינה מפילה כלום', () => {
    for (const parsed of [null, undefined, {}, { days: null }, { days: 'לא מערך' }]) {
      assert.deepEqual(sanitiseDays(parsed, MONTH), []);
    }
  });

  it('⚠️ הערה ארוכה נחתכת ל-100 תווים', () => {
    const [day] = sanitiseDays(
      { days: [{ date: '2026-10-03', access: 'unknown', confidence: 1, note: 'א'.repeat(300) }] },
      MONTH,
    );
    assert.equal(day.note.length, 100);
  });

  it('⚠️ ולא יותר מ-31 ימים ומ-6 אירועים ליום', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
      access: 'unknown', confidence: 1,
      events: Array.from({ length: 20 }, (_, j) => ({ title: `אירוע ${j}` })),
    }));
    const days = sanitiseDays({ days: many }, MONTH);
    assert.ok(days.length <= 31);
    assert.ok(days.every((d) => d.events.length <= 6));
  });
});

describe('ההנחיה והבקשה', () => {
  it('ההנחיה נושאת את החודש, ואוסרת שמות של אנשים', () => {
    const prompt = promptFor(MONTH);
    assert.ok(prompt.includes(MONTH));
    assert.ok(prompt.includes('אל תחזיר שמות של אנשים'));
    assert.ok(prompt.includes('unknown'));
  });

  it('גוף הבקשה נושא את התמונה ואת הסכימה, ו-temperature אפס', () => {
    const body = requestBodyFor(MONTH, 'image/png', 'AAAA');
    assert.equal(body.contents[0].parts[1].inline_data.mime_type, 'image/png');
    assert.equal(body.contents[0].parts[1].inline_data.data, 'AAAA');
    assert.equal(body.generationConfig.response_mime_type, 'application/json');
    assert.equal(body.generationConfig.temperature, 0);
  });

  it('⚠️ והמודל אינו 2.5, שנסגר ב-16/10/2026', () => {
    assert.ok(!MODEL.startsWith('gemini-2'));
  });
});
