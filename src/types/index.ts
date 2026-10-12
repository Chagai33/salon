// src/types/index.ts
//
// המודל כפי שהוכרע ב-DOCS/PLANING/02-the-data-model.md.
// כל שדה כאן נושא הכרעה של בעל המוצר, ולא נוחות.

// ⚠️ ייבוא טיפוס בלבד, ואין לו עלות בזמן ריצה. השדה `expiresAt` חייב להיות
// חותמת זמן של Firestore, כי מדיניות התפוגה מוחקת לפי טיפוס. DOCS/PLANING/29
import type { Timestamp } from 'firebase/firestore';

/** זהות. בלי תפקידים: התפקיד שייך לסניף. */
export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

export type MemberRole = 'member' | 'manager';

/**
 * ⚠️ `pending` הוא המצב הראשון, ולא תקלה.
 * חבר שנכנס ב-Google רואה ואינו משתבץ עד שמנהלת מאשרת.
 */
export type MemberStatus = 'pending' | 'active' | 'inactive';

export interface Member {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: number;
  approvedBy?: string;
  approvedAt?: number;
}

/**
 * ⚠️ `weekdays` אינו קישוט. בחיפה הסלון סוגר ב-18:00 בשלושה מתוך חמישה ימים,
 * ובלי השדה הזה היו נולדות שלושים משמרות ערב שאינן קיימות, והן היו נספרות
 * כפתוחות בדוח התפוסה. DOCS/PLANING/11-what-the-website-says.md
 */
export interface ShiftTemplate {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  weekdays: number[];
  isActive: boolean;
}

/** שעות הסלון, ואינן תבניות המשמרת. בתל אביב פתוח 12 שעות והמשמרות מכסות 8. */
export interface OpeningHours {
  open: string;
  close: string;
}

export interface Space {
  id: string;
  name: string;
  isActive: boolean;
  order: number;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  /** ⚠️ מי פתח את הסלון. חוקי המסד דורשים אותו ביצירה, והוא מה שמאפשר
   *  לפותח להיכתב כמנהל באותה אצווה בלי שאיש יוכל למנות את עצמו בסלון קיים.
   *  DOCS/PLANING/18-each-salon-is-a-tenant.md */
  createdBy?: string;
  createdAt?: number;
  timezone: string;
  /** אפס הוא ראשון. שבעה ימים, כדי שסניף שיפתח בשישי לא ידרוש שינוי מודל. */
  openingHours: Record<number, OpeningHours | null>;
  shiftTemplates: ShiftTemplate[];
  spaces: Space[];
  /**
   * ⚠️ שמות של אירועים שהייבוא מדלג עליהם.
   *
   * בלשון בעל המוצר, 06/10: "קבוצת ריצה זו לא פעילות שמתקיימת בסלון ולכן
   * אפשר לדלג עליה. אולי שווה לנהל איזה מאגר למנהלת שתוכל לדלג על ייבוא של
   * אירועים חוזרים שאינם מתקיימים בסלון".
   *
   * ⚠️ והוא על הסניף ולא על החודש: אירוע חוזר חוזר בכל חודש.
   */
  importIgnore?: string[];
  /**
   * ⚠️ `false` הוא סלון סגור: אינו ברשימה, ואי אפשר להיכנס אליו. המידע נשאר.
   * ⚠️ ו-undefined הוא פתוח, כי סלונים ישנים נוצרו בלי השדה.
   * נכתב רק מפונקציית הענן `manageBranch`. DOCS/PLANING/35
   */
  isActive: boolean;
  closedAt?: number;
  closedBy?: string;
  /**
   * ⚠️⚠️ העתק לתצוגה בלבד. המחיקה עצמה קוראת את `deletionRequests`, שדפדפן
   * אינו יכול לכתוב אליו, ולכן שינוי השדה הזה אינו מקדים ואינו מבטל מחיקה.
   */
  deletionScheduledFor?: Timestamp;
  icsToken: string;
}

/**
 * נוכחות בארבעה מצבים ולא בוליאני.
 * בוליאני היה אומר ש-false הוא גם "לא הגיע" וגם "אף אחד לא בדק", ושני אלה
 * אינם אותו דבר בדוח. DOCS/PLANING/09-reports-and-the-dashboard.md
 */
export type Attendance = 'assumed' | 'confirmed' | 'noShow' | 'cancelled';

export type HandoverState = 'none' | 'requested' | 'completed';

export interface Shift {
  /** `2026-10-08_morning`. התאריך והתבנית, כדי ששיבוץ כפול יהיה בלתי אפשרי במסד. */
  id: string;
  branchId: string;
  /** מחרוזת ולא חותמת זמן: משמרת היא יום בלוח ולא רגע בזמן. */
  date: string;
  templateId: string;
  startTime: string;
  endTime: string;
  assigneeMemberId?: string;
  /** כפילות מכוונת, והיחידה. בלעדיה כל פתיחת חודש היא שישים קריאות מסמך. */
  assigneeName?: string;
  assignedAt?: number;
  assignedBy?: string;
  attendance: Attendance;
  attendanceSetBy?: string;
  attendanceSetAt?: number;
  handoverState: HandoverState;
  handoverRequestedAt?: number;
  handoverReason?: string;
  /** ⚠️ מי מסר. זו הזכאות שלו, ומחיקתו היא שלילת זכאות בשקט. */
  handoverFromMemberId?: string;
  handoverFromName?: string;
}

export interface ActivityEvent {
  title: string;
  spaceId?: string;
  startTime?: string;
  endTime?: string;
}

export type PublicAccess = 'open' | 'closed' | 'closesEarly';
export type MemberAccess = 'open' | 'closed';

/**
 * יום אחד בסלון.
 *
 * ⚠️ שני מישורי גישה ולא שדה אחד. בגיליון נמדד "הסלון סגור, פתוח רק לחברי אופן
 * ספייס", ובעל המוצר תיאר את ההפוך: סגור לחברים. שניהם קיימים.
 */
export interface ActivityDay {
  id: string;
  branchId: string;
  date: string;
  events: ActivityEvent[];
  publicAccess: PublicAccess;
  memberAccess: MemberAccess;
  closesAt?: string;
  note?: string;
  source?: 'app' | 'import2026' | 'hebrewCalendar';
}

/**
 * הקוד שהמנהלת מגדירה.
 *
 * ⚠️ אין `validTo`. קוד תקף עד שמוחלף, כמו במנעול האמיתי: תאריך סיום היה יוצר
 * חלון שבו אין קוד בכלל כשמנהלת לא מחליפה בזמן.
 */
export interface AccessCode {
  id: string;
  branchId: string;
  code: string;
  validFrom: number;
  /** `2026-10`, נגזר מ-validFrom בשעת הכתיבה. הזכאות נבדקת מולו. */
  periodMonth: string;
  setBy: string;
  setAt: number;
}

/** מדרגות הפעילות, בהכרעת בעל המוצר: רדום הוא שלושה חודשים בלי משמרת. */
export type ActivityTier = 'active' | 'lukewarm' | 'dormant';

export interface EligibilityResult {
  isEligible: boolean;
  /** על סמך מה. משמרת שמוחזקת, או משמרת שנמסרה בהחלפה שהושלמה. */
  reason: 'assigned' | 'handedOver' | 'none';
  periodMonth: string;
  shiftDates: string[];
}

/**
 * ⚠️ אזור ליבה. הרשומה שנכתבת ואינה נמחקת, שאומרת מי עשה מה ומתי.
 * DOCS/PLANING/29-nothing-records-that-someone-cancelled.md
 *
 * ⚠️ ואין לה שם במוצר, כי אין לה שורה ב-DOCS/GLOSSARY.md. בהכרעת בעל המוצר
 * 12/10 היא נבנית בלי שם, והמסך אומר "מי עשה מה ומתי".
 *
 * ⚠️⚠️ ואין בה שדה טקסט חופשי. זה הכלל היחיד שמונע ממנה להיות מצבור מידע
 * אישי: "ביטל ב-14/10 בשעה 09:00" ולא "לא אמין". הסכמה סגורה גם בחוקי המסד,
 * ולא רק כאן, כי כתיבה ישירה למסד עוקפת את הקוד הזה.
 */
export type EventAction =
  // משמרות. ⚠️ `shiftReleased` הוא האירוע שהמוצר זרק עד כה.
  | 'shiftAssigned'
  | 'shiftReleased'
  | 'handoverRequested'
  | 'handoverCancelled'
  | 'handoverTaken'
  | 'attendanceSet'
  // חברות והרשאות. ⚠️ כולן פעולה של מנהלת על אדם אחר, ואין בהן התחברות.
  | 'memberApproved'
  | 'memberRejected'
  | 'memberDeactivated'
  | 'memberReactivated'
  | 'roleChanged'
  // הגדרות הסלון והקוד.
  | 'accessCodeSet'
  | 'settingsChanged'
  | 'monthCreated'
  | 'importRan';

/** איזה חלק בהגדרות השתנה. ⚠️ שמות השדות על הסניף, ולא תיאור חופשי. */
export type SettingsPart = 'name' | 'openingHours' | 'shiftTemplates' | 'spaces' | 'importIgnore';

/** ⚠️ enum ולא מחרוזת. ארבעה מצבי נוכחות, שני תפקידים, וחמשת חלקי ההגדרות. */
export type EventDetail = Attendance | MemberRole | SettingsPart;

export interface SalonEvent {
  id: string;
  /** מתי נכתב. */
  at: number;
  /**
   * ⚠️⚠️ חותמת זמן ולא מספר, ובכוונה.
   *
   * תפוגת 12 החודשים היא מדיניות `TTL` של Firestore, והיא מוחקת לפי שדה
   * מטיפוס חותמת זמן בלבד. מדיניות על שדה מספרי אינה מוחקת דבר, ולכן `at`
   * לבדו היה משאיר את הרשומה לנצח. `at` נשאר לדוח ולמיון, והמדיניות יושבת
   * על השדה הזה. DOCS/PLANING/29
   */
  expiresAt?: Timestamp;
  /** מי עשה, ונעוץ למי שמחובר. חוקי המסד דורשים שיהיה הכותב עצמו. */
  actorMemberId: string;
  action: EventAction;
  shiftId?: string;
  /** כדי שהדוח לא יצטרך לקרוא את המשמרת כדי לדעת על איזה תאריך מדובר. */
  shiftDate?: string;
  /**
   * על מי, כשזה אדם אחר.
   *
   * ⚠️ ובשחרור הוא מי שאיבד את המשמרת, ולא מי שלחץ. בהכרעת בעל המוצר 12/10:
   * מנהלת שמשחררת משמרת של חבר אינה החבר שביטל, ושורה שמטילה את זה עליו
   * שולחת את המנהלת לדבר עם האדם הלא נכון.
   */
  subjectMemberId?: string;
  detail?: EventDetail;
  /** ⚠️ מספר ולא טקסט: בכמה ימים נגע הייבוא, וכמה משמרות נולדו. */
  count?: number;
}
