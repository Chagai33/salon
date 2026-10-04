/**
 * מחשב את ימי הסגירה של החגים לשנה לועזית, בלי שום ספרייה.
 *
 * `Intl` עם לוח `ca-hebrew` מובנה בכל מנוע מודרני, ולכן ההמרה בין הלוחות אינה
 * דורשת תלות ואינה נושאת שאלת רישוי. רשומה 14.
 *
 * ⚠️ מה שזה אינו: זו אינה ספריית חגים. היא מחזיקה טבלה של תאריכים עבריים
 * קבועים, והיא אינה יודעת דחיות, מנהגי חוץ לארץ, או חג שנופל בשבת. הטבלה היא
 * מה שהסלון סוגר בו, ולא לוח חגים.
 *
 * הרצה:
 *   node tools/hebrew-closures.mjs 2026
 *   node tools/hebrew-closures.mjs 2026 --json
 */

// חודש עברי כפי ש-Intl מדווח אותו באנגלית. בשנה מעוברת אדר נחלק לשניים.
const MONTH = {
  TISHRI: 'Tishri', NISAN: 'Nisan', SIVAN: 'Sivan',
  ADAR: 'Adar', ADAR_II: 'Adar II',
};

/**
 * ימי הסגירה, כתאריכים עבריים.
 *
 * `memberAccess` הוא מה שמשנה לחבר אופן ספייס: יום שבו הוא אינו יכול להיות
 * בסלון גם עם קוד. רשומה 02.
 *
 * ⚠️ `source` הוא עיקר הטבלה הזו ולא קישוט:
 *
 *   measured2026  נמדד בגיליון 2026 של סלון תל אביב. זו ראיה.
 *   proposed      הנחה שלי, שאין לה ראיה כי החג נפל בשישי או בשבת ב-2026
 *                 והגיליון אינו מחזיק סופי שבוע כלל.
 *
 * ⚠️ **וטור שלם הוסר מהטבלה אחרי שהמדידה סתרה אותו.** הנחתי שהסלון סוגר בחול
 * המועד פסח, בשביעי של פסח ובפורים. **בגיליון הוא היה פתוח ומשובץ בכולם:**
 * 05 עד 08/04 נשאו שיבוצים, ו-03/03 לא סומן סגור. **לכן הם אינם כאן.**
 *
 * מסקנה שמחייבת את מסך ההגדרות: **הטבלה היא הצעה שהמנהלת מאשרת, ולא לוח
 * חגים.** רשומה 14.
 */
const CLOSURES = [
  { name: 'ראש השנה', month: MONTH.TISHRI, day: 1, days: 2, publicAccess: 'closed', memberAccess: 'closed', source: 'measured2026' },
  { name: 'ערב יום כיפור', month: MONTH.TISHRI, day: 9, days: 1, publicAccess: 'closed', memberAccess: 'closed', source: 'measured2026' },
  { name: 'יום כיפור', month: MONTH.TISHRI, day: 10, days: 1, publicAccess: 'closed', memberAccess: 'closed', source: 'measured2026' },
  { name: 'סוכות', month: MONTH.TISHRI, day: 15, days: 1, publicAccess: 'closed', memberAccess: 'closed', source: 'proposed' },
  { name: 'חול המועד סוכות', month: MONTH.TISHRI, day: 16, days: 5, publicAccess: 'closed', memberAccess: 'open', source: 'measured2026' },
  { name: 'שמחת תורה', month: MONTH.TISHRI, day: 22, days: 1, publicAccess: 'closed', memberAccess: 'closed', source: 'proposed' },
  { name: 'ליל הסדר', month: MONTH.NISAN, day: 14, days: 1, publicAccess: 'closed', memberAccess: 'closed', source: 'measured2026' },
  { name: 'פסח', month: MONTH.NISAN, day: 15, days: 1, publicAccess: 'closed', memberAccess: 'closed', source: 'measured2026' },
  { name: 'ליל שבועות', month: MONTH.SIVAN, day: 5, days: 1, publicAccess: 'closesEarly', memberAccess: 'open', source: 'measured2026' },
  { name: 'שבועות', month: MONTH.SIVAN, day: 6, days: 1, publicAccess: 'closed', memberAccess: 'closed', source: 'proposed' },
];

const HEBREW_PARTS = new Intl.DateTimeFormat('en-US-u-ca-hebrew', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
});

function hebrewOf(date) {
  const parts = Object.fromEntries(
    HEBREW_PARTS.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return { year: parts.year, month: parts.month, day: Number(parts.day) };
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * סורק את השנה הלועזית יום אחר יום ומחזיר את התאריכים שנפלו על התאריך העברי.
 *
 * ⚠️ סריקה ולא חישוב, בכוונה: היא איטית וקלה לאימות, והיא רצה פעם בשנה.
 * חישוב הפוך היה דורש מימוש אלגוריתם הלוח, וזה בדיוק מה שאנחנו לא רוצים לכתוב.
 */
function gregorianDatesFor(gregorianYear, month, day, span) {
  const found = [];
  const start = Date.UTC(gregorianYear, 0, 1, 12);
  const end = Date.UTC(gregorianYear + 1, 0, 1, 12);

  for (let t = start; t < end; t += 86400000) {
    const date = new Date(t);
    const hebrew = hebrewOf(date);

    // בשנה מעוברת Intl מדווח "Adar I" ו-"Adar II". פורים הוא באדר ב׳.
    const matches = hebrew.month === month
      || (month === MONTH.ADAR && hebrew.month === MONTH.ADAR_II);

    if (matches && hebrew.day === day) {
      for (let i = 0; i < span; i += 1) {
        found.push(new Date(t + i * 86400000));
      }
      break;
    }
  }
  return found;
}

export function closuresFor(gregorianYear) {
  const out = [];
  for (const closure of CLOSURES) {
    const dates = gregorianDatesFor(gregorianYear, closure.month, closure.day, closure.days);
    for (const date of dates) {
      out.push({
        date: iso(date),
        name: closure.name,
        hebrew: `${hebrewOf(date).day} ${hebrewOf(date).month} ${hebrewOf(date).year}`,
        publicAccess: closure.publicAccess,
        memberAccess: closure.memberAccess,
        source: closure.source,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const year = Number(process.argv[2]);
if (!Number.isInteger(year) || year < 1900 || year > 2200) {
  console.error('שימוש: node tools/hebrew-closures.mjs <שנה לועזית> [--json]');
  process.exit(2);
}

const rows = closuresFor(year);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const measured = rows.filter((r) => r.source === 'measured2026').length;
  console.log(`ימי סגירה ${year}, ${rows.length} ימים`);
  console.log(`${measured} מהם נמדדו בגיליון 2026, ו-${rows.length - measured} הם הצעה\n`);
  for (const row of rows) {
    const member = row.memberAccess === 'open' ? 'פתוח לחברים' : 'סגור לחברים';
    const mark = row.source === 'measured2026' ? 'נמדד ' : 'הצעה ';
    console.log(`  ${row.date}  ${mark} ${row.name.padEnd(18)} ${row.publicAccess.padEnd(12)} ${member}`);
  }
}
