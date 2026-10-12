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

## ⚠️ ועוד מדידה, 12/10/2026: JDK 21 אינו מריץ את האמולטור במכונה הזו

**`CLAUDE.md` אומר "נמדד על 21". ⚠️ וזה לא נכון כאן.**

**נמדד:** האמולטור נפל בשתי גרסאות שונות שלו, 1.19.8 ו-1.22.0, באותה שגיאה:

```
java.io.IOException: Unable to establish loopback connection
  at sun.nio.ch.PipeImpl$Initializer.run
```

⚠️ **והיא אינה של Firebase.** ששת השורות הבאות מדדו את זה ישירות:

```java
public class P { public static void main(String[] a) throws Exception {
  java.nio.channels.Selector.open(); } }
```

**`Selector.open()` נכשל ב-JDK 21 במכונה הזו**, ועובר ב-JDK 11. ✅ **ו-node
כן פותח שקע loopback על אותו מחשב**, ולכן זו אינה רשת חסומה אלא ה-JVM.

**מה שעבד בפועל:**

```bash
JAVA_HOME="C:/Program Files/Java/jdk-11" npx -y firebase-tools@14 \
  emulators:exec --only firestore --project demo-salon \
  "node --test --test-concurrency=1 test/rules/*.test.mjs"
```

⚠️⚠️ **ושתי מגבלות שנמדדו יחד:** `firebase-tools@latest` **מסרב** ל-JDK מתחת
ל-21, ו-`firebase-tools@14` מזהיר ש-`15` יפסיק לתמוך ב-JDK מתחת ל-21.
**כלומר הצירוף היחיד שעובד כאן הוא `firebase-tools@14` עם JDK 11, והוא
ייסגר.**

⚠️ **והתיקון האמיתי הוא JDK 21 שעובד**, ולא נעילה על גרסאות ישנות.
