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

  board: {
    title: 'לוח המשמרות',
    previousMonth: 'חודש קודם',
    nextMonth: 'חודש הבא',
    today: 'היום',
    empty: 'אין עוד משמרות בחודש הזה.',
    generate: 'יצירת משמרות החודש',
    generating: 'רגע',
    generated: (count: number) => `נוצרו ${count} משמרות`,
    loading: 'טוען',
    openShifts: (count: number) =>
      count === 1 ? 'משמרת אחת פתוחה' : `${count} משמרות פתוחות`,
    noOpenShifts: 'כל המשמרות משובצות',
    handoverWaiting: (count: number) =>
      count === 1 ? 'בקשת מחליף אחת' : `${count} בקשות מחליף`,
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
    makeManager: 'הגדרה כמנהלת',
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
    noBranch: 'הסניף עוד לא הוקם. מנהלת הסלון צריכה להקים אותו.',
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
