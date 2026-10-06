// src/i18n/dictionary.ts
//
// כל מחרוזת שהמשתמש רואה יושבת כאן, ואף אחת אינה נכתבת בתוך רכיב.
// השמות נלקחים מ-DOCS/GLOSSARY.md. אמת שם לפני שאתה מוסיף אותו.
//
// ⚠️ בלי מקפים מפרידים. פסיק, נקודתיים, או משפט חדש.
//    DOCS/PLANING/WRITING-STYLE.md
//
// ⚠️ ובלי להבטיח מה שלא נמדד. "אין פעילות מתוכננת" ולא "פנוי", כי המוצר אינו
//    משריין מקומות ואינו סופר כיסאות.
//
// ⚠️⚠️ ומה שבעל המוצר אומר בצ'אט הוא אפיון, ולא טקסט למסך.
//
//    "חבר אופן ספייס יכול להישאר בסלון גם מחוץ לשעות הפעילות, בתנאי שהוא
//    משובץ לפחות למשמרת אחת בחודש" הוא משפט שנכתב כדי להסביר לי את ההסדר,
//    והוא ישב כאן כטקסט של מסך הכניסה. זה נקרא כמו תקנון.
//
//    הכלל: המסך מדבר אל מי שכבר יודע למה הוא בא. הוא אומר מה לעשות עכשיו,
//    ולא מסביר את ההסדר מחדש.

export const he = {
  appName: 'הסלון',

  auth: {
    signInTitle: 'הסלון',
    signInBody: 'לוח המשמרות, והקוד לחלל.',
    signInWithGoogle: 'כניסה עם Google',
    signOut: 'יציאה',
    signingIn: 'רגע',
    failed: 'ההתחברות לא עברה. נסו שוב.',
  },

  pending: {
    title: 'כמעט',
    body: 'מנהלת הסלון צריכה לאשר אותך. ברגע שהיא מאשרת, אפשר להשתבץ.',
    whoToAsk: 'לוקח יותר מדי זמן? דברו עם צוות הסלון.',
  },

  // ⚠️ "סלון" ולא "סניף". סניף הוא המונח במודל הנתונים, ואינו מה שאדם אומר.
  // DOCS/GLOSSARY.md
  salons: {
    title: 'הסלונים',
    mine: 'הסלונים שלי',
    others: 'סלונים נוספים',
    none: 'עוד לא נפתח סלון.',
    loading: 'טוען',
    enter: 'כניסה',
    join: 'בקשת הצטרפות',
    joining: 'רגע',
    waiting: 'ממתין לאישור',
    managerHere: 'מנהלת כאן',
    switch: 'החלפת סלון',
    notFound: 'הסלון הזה לא נמצא.',
    backToList: 'לרשימת הסלונים',
    joinTitle: 'בקשת הצטרפות',
    joinBody: (name: string) => `הבקשה נשלחת למנהלת של ${name}.`,

    // ⚠️ המסך הזה מוצג פעם אחת בחיי המערכת, ואז נעלם לעולם.
    claimTitle: 'אף אחד לא הגדיר עוד מי מפעיל את המערכת',
    claimBody: 'מי שלוקח את זה עכשיו יוכל לפתוח סלונים ולהגדיר מנהלות. זה נקבע פעם אחת, ואחר כך אי אפשר לשנות מכאן.',
    claimAction: 'אני מפעיל המערכת',
    claiming: 'רגע',


    openTitle: 'פתיחת סלון',
    // ⚠️ וזו אינה הבטחה שיווקית. זה מה שחוקי המסד עושים בפועל: מי שפותח
    // נכתב כמנהל באותה אצווה, ואין דרך אחרת להגדיר את הראשון.
    openBody: 'מי שפותח סלון הוא המנהלת שלו, ומאשר חברים מיד.',
    openAction: 'פתיחת סלון',
    nameLabel: 'שם הסלון',
    namePlaceholder: 'הסלון בחיפה',
    cityLabel: 'עיר',
    cityPlaceholder: 'חיפה',
    idLabel: 'מזהה לכתובת',
    idPlaceholder: 'haifa',
    idHint: 'אותיות לטיניות קטנות, ספרות ומקפים. זה מה שיופיע בכתובת.',
    create: 'פתיחה',
    creating: 'רגע',
    cancel: 'ביטול',
  },

  home: {
    greeting: (name: string) => `שלום, ${name}`,
    // ⚠️ הסניף והחודש מגיעים מהמצב ואינם טקסט. `·` ולא מקף.
    place: (branch: string, month: string) => `${branch} · ${month}`,
  },

  board: {
    title: 'לוח המשמרות',
    previousMonth: 'חודש קודם',
    nextMonth: 'חודש הבא',
    today: 'היום',

    // ⚠️ חודש בלי משמרות אינו הצלחה ואינו תקלה. הוא מצב שצריך הכוונה,
    // ולכן יש לו כותרת, שורת הסבר, ופעולה אחת.
    emptyTitle: (month: string) => `עדיין אין משמרות ב${month}`,
    // ⚠️ מצב אחר לגמרי: לסניף אין תבנית משמרת פעילה, ולכן אין לחודש ימים
    // שאפשר לשבץ בהם בכלל.
    noTemplates: 'לסלון אין עדיין תבניות משמרת, ולכן אין ימים לשיבוץ.',
    emptyBodyManager: 'המשמרות נוצרות לפי תבניות הסלון, והחברים משבצים את עצמם.',
    emptyBodyMember: 'מנהלת הסלון עוד לא יצרה את המשמרות של החודש הזה.',
    generateFor: (month: string) => `יצירת משמרות ל${month}`,
    generating: 'רגע',
    generated: (count: number) => `נוצרו ${count} משמרות`,

    loading: 'טוען',
    openShifts: (count: number) =>
      count === 1 ? 'משמרת אחת פתוחה' : `${count} משמרות פתוחות`,
    noOpenShifts: 'כל המשמרות משובצות',
    handoverWaiting: (count: number) =>
      count === 1 ? 'בקשת מחליף אחת' : `${count} בקשות מחליף`,
    membersCount: (count: number) => (count === 1 ? 'חבר אחד' : `${count} חברים`),
    joinRequests: (count: number) =>
      count === 1 ? 'בקשת הצטרפות אחת' : `${count} בקשות הצטרפות`,
  },

  shift: {
    open: 'פתוחה',
    mine: 'שלי',
    taken: 'משובצת',
    handoverRequested: 'מבוקש מחליף',
    past: 'עברה',
    claim: 'תופס',
    claiming: 'רגע',
    release: 'משחרר',
    requestHandover: 'צריך מחליף',
    cancelHandover: 'ביטול',
    takeOver: 'מחליף',
    claimFailed: 'לא נתפס. כנראה מישהו הקדים אותך בשנייה.',
    notAllowed: 'עוד לא אושרת, אז אי אפשר להשתבץ.',
    handoverFrom: (name: string) => `במקום ${name}`,
  },

  code: {
    copy: 'העתקה',
    copied: 'הועתק',
    // ⚠️ והעתקה נכשלת. דפדפן בלי הרשאה ללוח אינו מקרה קצה, וההודעה אומרת
    // מה לעשות במקומה.
    copyFailed: 'ההעתקה לא עברה. סמנו את הקוד והעתיקו ידנית.',
    title: 'קוד הכניסה',
    eligible: 'הקוד שלך החודש',
    eligibleByHandover: 'מצאת מחליף, והקוד נשאר שלך',
    notEligible: 'עוד לא השתבצת החודש',
    notEligibleHint: 'תפסו משמרת בלוח, והקוד יופיע כאן.',
    noCode: 'עוד אין קוד. מנהלת הסלון מגדירה אותו.',
    staleWarning: 'הקוד הזה מהחודש שעבר ועוד לא הוחלף. לא עובד? דברו עם צוות הסלון.',
    // ⚠️ אומר מה האפליקציה יודעת, ולא מה שהיא אינה יודעת.
    // אם המנעול אינו מכיר את הקוד, האפליקציה אינה יודעת את זה.
    disclaimer: 'זה הקוד שמנהלת הסלון הגדירה.',
    basedOn: (dates: string[]) =>
      dates.length === 1 ? `המשמרת שלך: ${dates[0]}` : `${dates.length} משמרות החודש`,
  },

  day: {
    activity: 'יש פעילות',
    noActivity: 'אין פעילות מתוכננת',
    closed: 'הסלון סגור',
    closesEarly: (time: string) => `הסלון סוגר ב-${time}`,
    membersOnly: 'סגור לציבור, פתוח לחברי אופן ספייס',
    memberClosed: 'הסלון אינו זמין לחברים ביום הזה',
  },

  spaces: {
    title: 'איפה אפשר לשבת לעבוד',
    free: 'אין פעילות מתוכננת',
    busy: (from: string, to: string) => `תפוס ${from} עד ${to}`,
    busyAllDay: 'תפוס כל היום',
    // ⚠️ זו ההסתייגות שהמוצר חייב לומר: אין שריון מקומות.
    disclaimer: 'זה מה שמתוכנן. יכול להיות שיושבים שם גם ככה.',
  },

  manager: {
    title: 'ניהול',
    members: 'חברים',
    pendingApproval: 'ממתינים לאישור',
    approve: 'אישור',
    approving: 'מאשר',
    noPending: 'אין מי שממתין לאישור',

    // ⚠️ השם מ-Google אינו מזהה. "Chagai yechiel (Aum.Music)" הוא מה שאדם
    // כתב לעצמו בפרופיל, והמייל הוא מה שאומר למנהלת במי מדובר.
    emailColumn: 'מייל',
    nameColumn: 'שם',
    joinedColumn: 'נרשם',
    actionColumn: 'פעולה',
    approvedMembers: 'חברים מאושרים',
    noMembers: 'אין עוד חברים',
    roleManager: 'מנהלת',
    roleMember: 'חבר',
    summary: (approved: number, pending: number) =>
      pending > 0
        ? `${approved} מאושרים · ${pending} ממתינים`
        : `${approved} מאושרים`,
    showAll: 'כל החברים',
    makeManager: 'הגדרה כמנהלת',
    promoteMe: 'הגדרה של עצמי כמנהלת',
    unmakeManager: 'הסרה מניהול',
    working: 'רגע',
    me: 'אני',
    waitingToApprove: (count: number) =>
      count === 1 ? 'אדם אחד ממתין לאישור' : `${count} אנשים ממתינים לאישור`,
    setCode: 'הגדרת קוד כניסה',
    codePlaceholder: 'הקוד החדש',
    save: 'שמירה',
    saving: 'שומר',
    saved: 'נשמר',
  },

  errors: {
    // ⚠️ "אירעה שגיאה" אסור. הודעה אומרת מה נעשה, מה נכשל, ומה אפשר לעשות.
    loadMonth: 'החודש לא נטען. בדקו חיבור ורעננו.',
    // ⚠️ זו ההודעה שהחליפה את "Missing or insufficient permissions" באנגלית.
    // היא אומרת למשתמש שהוא לא עשה כלום רע, ומה הצעד הבא.
    permissions: 'המסד עוד לא פתוח לאפליקציה. צריך לפרוס את חוקי ההרשאות ב-Firebase.',
    offline: 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.',
    signedOut: 'ההתחברות פגה. היכנסו שוב.',
    popupClosed: 'חלון ההתחברות נסגר. נסו שוב.',
    popupBlocked: 'הדפדפן חסם את חלון ההתחברות. אפשרו חלונות קופצים לאתר הזה.',
    saveFailed: 'לא נשמר. שום דבר לא אבד, נסו שוב.',
    noBranch: 'הסלון הזה לא נמצא.',
    badBranchId: 'המזהה לכתובת יכול להכיל אותיות לטיניות קטנות, ספרות ומקפים.',
    branchExists: 'כבר יש סלון עם המזהה הזה. בחרו מזהה אחר.',
  },

  a11y: {
    monthTable: 'לוח המשמרות לפי שבוע ויום',
    shiftCell: (day: string, date: string, shift: string, state: string) =>
      `${day}, ${date}, ${shift}, ${state}`,
    activityDay: 'יום שיש בו פעילות',
  },
} as const;

export type Dictionary = typeof he;
export const t = he;
