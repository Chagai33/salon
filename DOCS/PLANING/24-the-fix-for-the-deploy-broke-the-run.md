# 24 — התיקון לפריסה שבר את הריצה

> ✅ **סטטוס: תוקן, 06/10/2026. ארבע בדיקות, ושתיהן הטעויות נתפסות בהן.**
>
> ⚠️ **ודורש פריסה מחדש של הפונקציה.** הקוד במאגר, והענן מריץ את הקודם.

## מה בעל המוצר ראה

```
us-central1-hasalon-dev.cloudfunctions.net/readBoardImage:1
  Failed to load resource: the server responded with a status of 500
המודל לא הצליח לקרוא את התמונה. נסו שוב בעוד רגע.
```

⚠️ **והמודל לא נקרא בכלל.** ביומן:

```
Callable request verification passed
Unhandled error FirebaseAppError: The default Firebase app does not exist.
  at getFirestore (…/firestore/index.js:51:90)
  at firestore (file:///workspace/index.mjs:43:10)
  at assertManager (file:///workspace/index.mjs:61:26)
  code: 'app/no-app'
```

**השורה הראשונה חשובה:** הזהות אומתה, כלומר הקריאה, ההרשאה והמפתח בסדר.
**הכשל הוא בשורה הראשונה שהקוד שלי מריץ.**

## ⚠️⚠️ וזו רגרסיה שלי, מתיקון שאמרתי עליו שאין לו ראיה

**הפריסה נפלה קודם ב:**

```
Error: User code failed to load. Cannot determine backend specification.
Timeout after 10000.
```

**ה-CLI טוען את הקובץ כדי לגלות אילו פונקציות יש בו**, ובמכונה בלי הרשאות ענן
`initializeApp()` בראש המודול מחפש אותן ונתקע. **התיקון הנכון הוא שבטעינה לא
רץ כלום.** וכך כתבתי אותו:

```js
function firestore() {
  if (getApps().length === 0) initializeApp();
  return getFirestore();
}
```

**ואמרתי אז שאין לי ראיה שזה מה שתיקן את הפריסה.** ⚠️ **ולא אמרתי את מה שהיה
צריך: שאין לי ראיה שזה עובד בריצה.** זה לא עבד, ובכל קריאה.

## למה זה נפל

⚠️ **`firebase-functions` רושם אפליקציית `admin` בשם משלו**, כדי לאמת את
האסימון של הקורא. `functions/node_modules/firebase-functions/lib/common/app.js`:

```js
const APP_NAME = "__FIREBASE_FUNCTIONS_SDK__";
function getApp() {
  if (typeof cache === "undefined") {
    try { cache = getApp(); }
    catch { cache = initializeApp({ …, credential: applicationDefault() }, APP_NAME); }
  }
  return cache;
}
```

**וזה רץ לפני הקוד שלי**, כי האימות קודם להרצה. ולכן, בסדר הזה:

1. ה-SDK רושם `__FIREBASE_FUNCTIONS_SDK__`.
2. `getApps()` אינו ריק, **ולכן הבדיקה שלי דילגה על האתחול.**
3. `getFirestore()` בלי ארגומנט מחפש את אפליקציית **ברירת המחדל**.
4. אף אחד לא רשם אותה. `app/no-app`.

⚠️ **הטעות אינה ההיגיון אלא השאלה.** שאלתי "יש אפליקציה", והשאלה הנכונה היא
"יש אפליקציית ברירת מחדל". **ועל זו רק `getApp()` עונה.**

## התיקון

`functions/admin-app.mjs`:

```js
export function firestore() {
  if (!db) db = getFirestore(defaultApp());
  return db;
}

function defaultApp() {
  try { return getApp(); }
  catch { return initializeApp(); }
}
```

⚠️ **והקובץ נפרד ולא בתוך `index.mjs`.** `index.mjs` מצהיר טריגרים, ואי אפשר
לייבא אותו בבדיקה בלי לטעון אותם. **וקוד שאי אפשר לבדוק הוא איך הבאג הזה
נפרס.**

## ⚠️ ומה שנמדד, ולא "הקוד נראה נכון"

**שחזור מקומי לפני התיקון**, באותו סדר של הענן:

```
apps after SDK init: [ '__FIREBASE_FUNCTIONS_SDK__' ]
OLD throws: app/no-app | The default Firebase app does not exist
NEW ok: Firestore | apps: [ '__FIREBASE_FUNCTIONS_SDK__', '[DEFAULT]' ]
```

**והבדיקה פותחת ברישום אפליקציה בשם, בדיוק כמו ה-SDK.** `test/functions/admin-app.test.mjs`.
⚠️ **בלי השורה הזו הבדיקה עוברת גם על הקוד השבור**, ואינה שווה כלום.

| מה הורץ | התוצאה |
|---|---|
| הבדיקה על הקוד שנפרס | ❌ **3 מתוך 3 נכשלות**, ב-`app/no-app` ובאותה הודעה מהענן |
| הבדיקה על התיקון | ✅ **4 עוברות** |
| ⚠️ **אתחול בראש המודול**, הטעות השנייה | ❌ **2 נכשלות**, והראשונה היא "טעינה אינה מאתחלת" |
| כל בדיקות הפונקציה | ✅ **19 עוברות** |
| טעינת `index.mjs` כמו ה-CLI | ✅ 602ms, מניפסט תקין, **ואפס אפליקציות נרשמו** |

⚠️⚠️ **והשורה השלישית היא הלקח.** שני התיקונים סותרים זה את זה: מה שמציל את
הפריסה שובר את הריצה, ולהפך. **עכשיו שתי הטעויות נתפסות באותו קובץ בדיקה**,
ולכן אי אפשר לתקן אחת ולשבור את השנייה בשקט.

## ⚠️⚠️ ואותו באג חזר לבוש בהודעה שלי

**אחרי שנפרסה הגרסה עם האבחון, אותה קריאה החזירה:**

```
האפליקציה לא הצליחה לבדוק את ההרשאה שלך. דווחו לי ואבדוק את הלוג.
Error: member lookup failed   at assertManager (file:///workspace/index.mjs:70:12)
```

**וזו אינה שגיאה חדשה.** שורה 70 בגרסה שנפרסה היא `logger.error` שבתוך
ה-`catch` שעוטף את הקריאה למסד, **והחריגה שהוא תפס היא `app/no-app`.**
כלומר אותו באג בדיוק, שעכשיו יש לו הודעה אנושית במקום 500 ריק.

⚠️ **וההודעה שכתבתי מטעה.** "לא הצליחה לבדוק את ההרשאה שלך" נשמע כמו בעיה
ברשומת החבר, **והכשל אינו נוגע בחבר בכלל.**

**ומה שמוכיח את זה, ונמדד מול האמולטור:**

```
הקריאה הצליחה. exists: false | data: null
⇒ המסלול הוא notManager, ולא memberLookupFailed
```

⚠️ **רשומת חבר חסרה אינה זורקת.** `get` על מסמך שאינו קיים מצליח ומחזיר
`exists: false`, **ולכן היא לעולם אינה יכולה להדליק `memberLookupFailed`.**
שתי ההודעות אינן מתחלפות.

**ולכן התיקון כאן:** היומן רושם גם את `code` ולא רק את ההודעה, ו-`notManager`
רושם מה נמצא בפועל. **שורת יומן אחת צריכה לענות "למה", ולא לשלוח לחפש.**

## מה שעוד לא אומת

⚠️ **הקריאה האמיתית למודל.** מה שהוכח הוא שהשורה שנפלה אינה נופלת, **ושאר
הפונקציה לא נבדק מול הענן אפילו פעם אחת**, כי כל קריאה נפלה לפני שהגיעה
לשם. **הייבוא ייבדק בלוח של אוקטובר, ובמה שמוחזר ממנו.**
