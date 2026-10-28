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

---

## ⚠️⚠️ ממצא אגב, 26/10/2026: `JAVA_HOME` לבדו אינו מספיק

**נמדד בסבב של ארבע הבקשות במסך הייבוא.** הפקודה שלמעלה, כפי שהיא כתובה כאן
וב-`CLAUDE.md`, **נכשלה**:

```
Firestore Emulator has exited with code: 1
Caused by: java.net.SocketException: Invalid argument: connect
  at java.base/sun.nio.ch.UnixDomainSockets.connect0(Native Method)
```

**הסיבה, נמדדה בשתי פקודות:**

| מה | מה נמדד |
|---|---|
| `java` שב-`PATH` | `C:/Program Files/Microsoft/jdk-21.0.12.101-hotspot`, **גרסה 21.0.12.1** |
| `JAVA_HOME` שהוגדר בפקודה | `C:/Program Files/Java/jdk-11`, **גרסה 11.0.19** |

⚠️ **כלומר האמולטור לקח את ה-JVM מ-`PATH` ולא מ-`JAVA_HOME`**, והריץ בדיוק את
JDK 21 שהרשומה הזאת מדדה כשבור. **וההגדרה של `JAVA_HOME` לא מנעה את זה.**

**מה שעבד, ונמדד: 110 בדיקות, כולן עוברות.** ⚠️ **ו-`PATH` ולא רק `JAVA_HOME`:**

```bash
export JAVA_HOME="C:/Program Files/Java/jdk-11"
export PATH="/c/Program Files/Java/jdk-11/bin:$PATH"
npx -y firebase-tools@14 emulators:exec --only firestore --project demo-salon \
  "node --test --test-concurrency=1 test/rules/*.test.mjs"
```

⚠️ **ולכן השורה ב-`CLAUDE.md` אינה נכונה כפי שהיא כתובה.** `CLAUDE.md` הוא
קובץ יסוד, **והתיקון שלו הוא עצירה שממתינה לבעל המוצר.**

---

## ⚠️⚠️ ממצא שני מאותה משפחה, 27/10/2026: פריסת הפונקציות נכשלת בעץ נקי

**נמדד בפריסה אמיתית**, בהוראת בעל המוצר. הפקודה שכתובה ב-`CLAUDE.md`:

```bash
npx -y firebase-tools@14 deploy --only functions --project hasalon-dev
```

**נכשלה:**

```
!  functions: Couldn't find firebase-functions package in your source code.
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'firebase-functions'
  imported from <העץ>/functions/index.mjs
```

⚠️ **הסיבה:** `firebase-tools` **טוען את קוד הפונקציות במכונה המקומית** כדי
לנתח מהם הטריגרים, **ולכן הוא דורש את התלויות מותקנות.** ⚠️ **ו-
`functions/node_modules` אינו במאגר**, בכוונה, **ולכן כל עץ עבודה חדש מתחיל
בלעדיו.**

**מה שעבד:**

```bash
cd functions && npm install
```

**ואז הפקודה שב-`CLAUDE.md`**, ✅ **וארבע הפונקציות עודכנו**, נמדד בפלט
ובהרצת `functions:list` אחריה.

⚠️⚠️ **ומלכודת שנייה שנמדדה באותה הרצה, והיא המסוכנת:** הפקודה הופעלה בצינור,
`| tail`, **ולכן קוד היציאה שדווח היה 0 אף שהפריסה נכשלה.** `tail` מצליח גם
כשמה שלפניו נכשל. **פריסה נמדדת בקוד היציאה של הפקודה עצמה ובגוף הפלט, ולא
בקוד היציאה של הצינור.**

⚠️ **והשורה ב-`CLAUDE.md` חסרה את `npm install`.** קובץ יסוד, **והתיקון
ממתין לבעל המוצר.**

---

## נמדד 28/10/2026: `JAVA_HOME` לבדו אינו מספיק

⚠️⚠️ **והפקודה שכתובה ב-`CLAUDE.md` נכשלה בהרצה שלי**, נמדד:
`JAVA_HOME="C:/Program Files/Java/jdk-11"` **לא נכבד**, והאמולטור עלה
ב-JDK אחר ונפל.

**מה שהוכיח שזה JDK אחר ולא 11:** עקבת השגיאה ב-`firestore-debug.log` עברה
ב-`sun.nio.ch.UnixDomainSockets`, ⚠️ **ומחלקה זו אינה קיימת ב-JDK 11.** היא
נוספה ב-16.

✅ **ומה שעבד, באותה מכונה ובאותו רגע: JDK 11 ראשון ב-`PATH`.**

```bash
export PATH="/c/Program Files/Java/jdk-11/bin:$PATH"
npx -y firebase-tools@14 emulators:exec --only firestore --project demo-salon   "node --test --test-concurrency=1 test/rules/*.test.mjs"
```

**121 בדיקות, כולן עברו.** ⚠️ **ולא נמדד למה `JAVA_HOME` אינו נכבד**: נתיב
עם לוכסנים קדימה, או `java` אחר שקודם לו ב-`PATH`.
