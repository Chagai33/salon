# 19 — פקודת הבדיקה אינה רצה על מכונה נקייה

> **סטטוס: נמצא ב-05/10/2026, ותיקונו ממתין לאישור.**

## מה קרה

`npm run test:rules` נפל:

```
sh: 1: firebase: not found
```

**`package.json` קורא ל-`firebase` ישירות**, והוא אינו תלות של הפרויקט ואינו
ב-`PATH`. **בסשן שבו הבדיקות נכתבו הוא היה מותקן, ולכן זה עבד**, והפקודה נרשמה
ב-`CLAUDE.md` כאילו היא עומדת בפני עצמה.

**מה שהורץ בפועל מאז:**

```bash
npx -y firebase-tools@14 emulators:exec --only firestore --project demo-salon \
  "node --test --test-concurrency=1 test/rules/*.test.mjs"
```

## התיקון, וממה שהוא ממתין

**שורה אחת ב-`package.json`:** `firebase` הופך ל-`npx -y firebase-tools@14`.

⚠️ **ו-`package.json` הוא קובץ יסוד**, ועריכה בו דורשת אישור נקודתי,
`CLAUDE.md`. **לכן השורה לא שונתה.**

## ועוד אחד באותו מקום

**`npm run lint` נופל גם הוא**, ומסיבה אחרת: אין `eslint.config.js` במאגר.
**הפקודה קיימת ב-`package.json` ואינה רצה מעולם.**

⚠️ **ו-`CLAUDE.md` אינו מבטיח אותה**, ולכן זו אינה טענה שנסתרה. **אבל פקודה
שקיימת ואינה רצה היא מלכודת למי שינסה אותה.**
