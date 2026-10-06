# 27 — `npm run lint` נופל: אין קובץ הגדרות ל-ESLint

> **סטטוס: נמדד ולא תוקן.** נמצא אגב סבב העיצוב של רשומה
> [26](26-the-board-says-everything-as-a-badge.md), ולא תוקן אגב, לפי כלל
> התיעוד ב-`CLAUDE.md`.

## מה שנמדד

```
npm run lint
> eslint .
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```

**ואין קובץ כזה בשורש**, נמדד ב-`ls eslint*`.

⚠️ **והתלויות כן מותקנות:** `eslint`, `typescript-eslint`,
`eslint-plugin-react-hooks` ו-`eslint-plugin-react-refresh` כולם ב-
`devDependencies` ב-`package.json`.

## למה זה נוגע

`eslint-plugin-react-hooks` הוא בדיוק מה שתופס את המלכודת של רשומה
[16](16-the-selector-that-looped.md): בורר ב-zustand שבונה אובייקט חדש, ותלויות
חסרות ב-`useMemo`. **הכלל קיים בעץ ואינו רץ.**

## מה שנדרש

קובץ `eslint.config.js` בשורש. ⚠️ **והוא קובץ יסוד, ולכן יצירתו היא עצירה
שממתינה לבעל המוצר.** `CLAUDE.md`, "קובצי יסוד".
