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

export const he = {
  appName: 'הסלון',

  auth: {
    signInTitle: 'לוח המשמרות של הסלון',
    signInBody:
      'חבר אופן ספייס יכול להישאר בסלון גם מחוץ לשעות הפעילות, בתנאי שהוא משובץ לפחות למשמרת אחת בחודש.',
    signInWithGoogle: 'כניסה עם Google',
    signOut: 'יציאה',
    signingIn: 'מתחבר',
    failed: 'ההתחברות לא הושלמה. נסה שוב, ואם זה חוזר ספר לנו מה הופיע במסך.',
  },

  pending: {
    title: 'נרשמת, וממתינים לאישור',
    body: 'מנהלת הסלון צריכה לאשר אותך לפני שתוכל להשתבץ. עד אז אתה רואה את הלוח ואינך יכול ללחוץ עליו.',
    whoToAsk: 'אם זה לוקח זמן, אפשר לפנות לצוות הסלון.',
  },

  board: {
    title: 'לוח המשמרות',
    previousMonth: 'חודש קודם',
    nextMonth: 'חודש הבא',
    today: 'היום',
    empty: 'אין משמרות בחודש הזה.',
    generate: 'צור את משמרות החודש',
    generating: 'יוצר',
    generated: (count: number) => `נוצרו ${count} משמרות`,
    loading: 'טוען את החודש',
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
    claim: 'אני לוקח',
    claiming: 'משבץ',
    release: 'ביטול השיבוץ',
    requestHandover: 'אני צריך מחליף',
    cancelHandover: 'ביטול הבקשה',
    takeOver: 'אני מחליף',
    claimFailed: 'השיבוץ לא נשמר. ייתכן שמישהו לקח את המשמרת באותו רגע.',
    notAllowed: 'אתה עוד ממתין לאישור מנהלת, ולכן אינך יכול להשתבץ.',
    handoverFrom: (name: string) => `במקום ${name}`,
  },

  code: {
    title: 'קוד הכניסה',
    eligible: 'אתה משובץ החודש, ולכן הקוד שלך',
    eligibleByHandover: 'מסרת את המשמרת שלך ונמצא לה מחליף, ולכן הקוד נשאר שלך',
    notEligible: 'אינך משובץ לשום משמרת בחודש הזה',
    notEligibleHint: 'השתבץ למשמרת אחת בלוח, והקוד יופיע כאן.',
    noCode: 'מנהלת הסלון עוד לא הגדירה קוד',
    staleWarning:
      'הקוד שמוצג הוגדר בחודש קודם ועוד לא הוחלף. אם הוא אינו עובד, פנה לצוות הסלון.',
    // ⚠️ אומר מה האפליקציה יודעת, ולא מה שהיא אינה יודעת.
    // אם המנעול אינו מכיר את הקוד, האפליקציה אינה יודעת את זה.
    disclaimer: 'זה הקוד שמנהלת הסלון הגדירה כאן.',
    basedOn: (dates: string[]) =>
      dates.length === 1 ? `על סמך המשמרת ב-${dates[0]}` : `על סמך ${dates.length} משמרות`,
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
    disclaimer: 'זה מה שמתוכנן בלוח. ייתכן שיושבים שם אנשים גם בלי פעילות מתוכננת.',
  },

  manager: {
    title: 'ניהול',
    members: 'חברים',
    pendingApproval: 'ממתינים לאישור',
    approve: 'אישור',
    approving: 'מאשר',
    noPending: 'אין מי שממתין לאישור',
    setCode: 'הגדרת קוד כניסה',
    codePlaceholder: 'הקוד החדש',
    save: 'שמירה',
    saving: 'שומר',
    saved: 'נשמר',
  },

  errors: {
    // ⚠️ "אירעה שגיאה" אסור. הודעה אומרת מה נעשה, מה נכשל, ומה אפשר לעשות.
    loadMonth: 'לא הצלחנו לטעון את החודש. בדוק את החיבור ורענן את הדף.',
    saveFailed: 'השמירה לא עברה. הנתונים שלך לא נאבדו, נסה שוב.',
    noBranch: 'הסניף אינו מוגדר עוד. מנהלת הסלון צריכה להקים אותו.',
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
