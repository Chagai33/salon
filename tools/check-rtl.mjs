// tools/check-rtl.mjs
//
// ⚠️ שומר שלא ייכנס לקוד הזה שוב כלל פיזי.
//
// RTL נשבר שורה אחת בכל פעם: מישהו כותב ml-4 כי זה מה שהוא מכיר, וזה נראה
// נכון אצלו ונשבר אצל מי שקורא עברית. הבדיקה הזו אינה סטייל, היא מונעת רגרסיה
// שאי אפשר לראות בלי להסתכל על המסך בכיוון הנכון.
//
// DOCS/PLANING/03-the-design-standard.md

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = 'src';

/** כל אחד מאלה הוא כלל פיזי שאינו מתהפך ב-RTL. */
const BANNED = [
  { re: /\bclassName="[^"]*\b-?(ml|mr|pl|pr)-[0-9.]+/g, what: 'מרווח פיזי, צריך ms/me/ps/pe' },
  { re: /\bclassName="[^"]*\btext-(left|right)\b/g, what: 'יישור פיזי, צריך text-start/text-end' },
  { re: /\bclassName="[^"]*\bborder-(l|r)(-|\b)/g, what: 'גבול פיזי, צריך border-s/border-e' },
  { re: /\bclassName="[^"]*\brounded-(l|r|tl|tr|bl|br)-/g, what: 'פינה פיזית, צריך rounded-s/rounded-e' },
  { re: /\bclassName="[^"]*\b(left|right)-[0-9.]+/g, what: 'מיקום פיזי, צריך start/end' },
  { re: /margin-(left|right)\s*:/g, what: 'margin פיזי, צריך margin-inline' },
  { re: /padding-(left|right)\s*:/g, what: 'padding פיזי, צריך padding-inline' },
  { re: /\btext-align\s*:\s*(left|right)\b/g, what: 'text-align פיזי, צריך start/end' },
  { re: /\b(?<!inset-)(?<!-)(left|right)\s*:\s*(?!auto)/g, what: 'מיקום פיזי ב-CSS, צריך inset-inline' },
];

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full));
    else if (['.tsx', '.ts', '.css'].includes(extname(name))) out.push(full);
  }
  return out;
}

let problems = 0;
for (const file of files(ROOT)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (const { re, what } of BANNED) {
    for (const match of text.matchAll(re)) {
      const line = text.slice(0, match.index).split('\n').length;
      // ⚠️ הערה אינה קוד. שורה שמסבירה למה לא להשתמש בכלל פיזי אינה הפרה.
      const source = lines[line - 1] ?? '';
      if (/^\s*(\/\/|\*|\/\*)/.test(source)) continue;
      console.error(`${file}:${line}  ${what}\n    ${source.trim()}`);
      problems++;
    }
  }
}

console.log(problems === 0 ? '✓ אין כלל פיזי בקוד' : `\n✗ ${problems} הפרות`);
process.exit(problems > 0 ? 1 : 0);
