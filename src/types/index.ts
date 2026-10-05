// src/types/index.ts
//
// המודל כפי שהוכרע ב-DOCS/PLANING/02-the-data-model.md.
// כל שדה כאן נושא הכרעה של בעל המוצר, ולא נוחות.

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
  isActive: boolean;
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
