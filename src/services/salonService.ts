// src/services/salonService.ts
//
// שכבת השירות. כל כתיבה למסד עוברת כאן, ואף רכיב אינו קורא ל-Firestore ישירות.
// זרימת הנתונים: פעולת משתמש, שירות, כתיבה, מאזין, עדכון Store, ממשק.
// ה-Store הוא השתקפות קריאה בלבד של המסד ואינו מתוקן ביד.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  AccessCode,
  ActivityDay,
  Branch,
  Member,
  MemberRole,
  Shift,
  ShiftTemplate,
  User,
} from '../types';
import { datesInMonth, toMonthKey } from '../utils/dates';
import { periodMonthOf } from '../utils/eligibility';

/**
 * ⚠️ הסלון שנפתח ראשון, ולא "הסלון". כל סלון הוא טננט בפני עצמו, וכל מה ששייך
 * לו יושב תחתיו. המזהה הזה נשאר כברירת מחדל לקישורים ישנים בלבד.
 * DOCS/PLANING/18-each-salon-is-a-tenant.md
 */
export const DEFAULT_BRANCH_ID = 'tel-aviv';

/** ⚠️ מזהה לכתובת. לטיני, קטן, ומקפים. הוא יושב ב-URL ובנתיב במסד. */
export const BRANCH_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$/;

export function isValidBranchId(id: string): boolean {
  return BRANCH_ID_PATTERN.test(id);
}

const branchRef = (branchId: string) => doc(db, 'branches', branchId);
const membersRef = (branchId: string) => collection(db, 'branches', branchId, 'members');
const shiftsRef = (branchId: string) => collection(db, 'branches', branchId, 'shifts');
const activityRef = (branchId: string) => collection(db, 'branches', branchId, 'activityDays');
const codesRef = (branchId: string) => collection(db, 'branches', branchId, 'accessCodes');

// ---------- זהות וחברות ----------

/**
 * יוצר את רשומת החבר בכניסה הראשונה, ומחזיר אותה.
 *
 * ⚠️ `pending` ולא `active`. בהכרעת בעל המוצר: "נרשם וממתין לאישור מנהלת."
 * ⚠️ ואין קישור לחבר שיובא מהגיליון: "אין לו קשר לחבר מהגיליון, מתחילים מחדש."
 */
export async function ensureMember(user: User, branchId = DEFAULT_BRANCH_ID): Promise<Member> {
  const ref = doc(membersRef(branchId), user.uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as Member;
  }

  const member: Omit<Member, 'id'> = {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    role: 'member',
    status: 'pending',
    joinedAt: Date.now(),
  };
  await setDoc(ref, member);
  return { id: user.uid, ...member };
}

export function watchMember(
  branchId: string,
  uid: string,
  onChange: (member: Member | null) => void,
): Unsubscribe {
  return onSnapshot(doc(membersRef(branchId), uid), (snapshot) => {
    onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Member) : null);
  });
}

export function watchMembers(
  branchId: string,
  onChange: (members: Member[]) => void,
): Unsubscribe {
  return onSnapshot(query(membersRef(branchId), orderBy('displayName')), (snapshot) => {
    onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Member));
  });
}

export async function approveMember(
  branchId: string,
  memberId: string,
  approvedBy: string,
): Promise<void> {
  await updateDoc(doc(membersRef(branchId), memberId), {
    status: 'active',
    approvedBy,
    approvedAt: Date.now(),
  });
}

/**
 * מגדירה חבר כמנהל, או מחזירה אותו לחבר.
 *
 * ⚠️ והמנהל הראשון אינו נוצר כאן ואינו יכול להיווצר כאן. חוקי המסד אוסרים על
 * חבר לכתוב לרשומה של עצמו, ובכוונה: בלי האיסור הזה כל מי שנרשם היה כותב
 * לעצמו `role: manager`. לכן הראשון נקבע ביד בקונסולת Firebase, ומשם והלאה
 * מנהלת מגדירה את הבאה כאן. DOCS/PLANING/18-who-appoints-the-first-manager.md
 */
export async function setMemberRole(
  branchId: string,
  memberId: string,
  role: MemberRole,
): Promise<void> {
  await updateDoc(doc(membersRef(branchId), memberId), { role });
}

// ---------- הסניף ----------

/** רשימת הסלונים. כל מי שמחובר קורא אותה, וזה מה שמאפשר מסך בחירה. */
export function watchBranches(onChange: (branches: Branch[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'branches'), orderBy('name')), (snapshot) => {
    onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch));
  });
}

/**
 * באילו סלונים יש לי רשומת חבר.
 *
 * ⚠️ קריאה אחת לכל סלון, ולא שאילתת collectionGroup. שאילתה כזו הייתה דורשת
 * אינדקס, וחוק שמתיר סריקה רוחבית על members של כל הסלונים. מספר הסלונים
 * קטן, והקריאה הישירה לרשומה של עצמי מותרת בלי לפתוח כלום.
 */
export async function myMemberships(
  uid: string,
  branchIds: string[],
): Promise<Record<string, Member>> {
  const found: Record<string, Member> = {};
  await Promise.all(
    branchIds.map(async (branchId) => {
      const snapshot = await getDoc(doc(membersRef(branchId), uid));
      if (snapshot.exists()) {
        found[branchId] = { id: snapshot.id, ...snapshot.data() } as Member;
      }
    }),
  );
  return found;
}

/**
 * פותח סלון חדש, ומי שפותח הוא המנהל שלו.
 *
 * ⚠️⚠️ אצווה אחת ולא שתי כתיבות. חוקי המסד דורשים שמסמך הסלון ומסמך המנהל
 * ייכתבו יחד: סלון בלי מנהל אינו נוצר, ומנהל אינו נוצר בסלון שכבר היה קיים.
 * שתי הכתיבות בנפרד היו נדחות שתיהן. DOCS/PLANING/18-each-salon-is-a-tenant.md
 */
export async function openBranch(
  user: User,
  input: { id: string; name: string; city: string },
): Promise<void> {
  if (!isValidBranchId(input.id)) {
    throw new Error('badBranchId');
  }
  if ((await getDoc(branchRef(input.id))).exists()) {
    throw new Error('branchExists');
  }

  const batch = writeBatch(db);
  batch.set(branchRef(input.id), newBranch(input, user.uid));
  batch.set(doc(membersRef(input.id), user.uid), {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    role: 'manager',
    status: 'active',
    joinedAt: Date.now(),
  });
  await batch.commit();
}

/**
 * מבקש להצטרף לסלון קיים.
 *
 * ⚠️ והבקשה אינה נוצרת מעצם הכניסה למסך. עד כאן רשומת החבר נוצרה בכניסה
 * ל-Google, וזה היה נכון כשהיה סלון אחד. עם כמה סלונים זה היה יוצר בקשת
 * הצטרפות לכל סלון שמישהו רק הציץ בו.
 */
export async function joinBranch(user: User, branchId: string): Promise<Member> {
  return ensureMember(user, branchId);
}

export function watchBranch(
  branchId: string,
  onChange: (branch: Branch | null) => void,
): Unsubscribe {
  return onSnapshot(branchRef(branchId), (snapshot) => {
    onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Branch) : null);
  });
}

export async function saveBranchSettings(
  branchId: string,
  changes: Partial<Pick<Branch, 'name' | 'openingHours' | 'shiftTemplates' | 'spaces'>>,
): Promise<void> {
  await updateDoc(branchRef(branchId), changes);
}

// ---------- משמרות ----------

export function watchShiftsForMonth(
  branchId: string,
  monthKey: string,
  onChange: (shifts: Shift[]) => void,
): Unsubscribe {
  // טווח מחרוזות. `2026-10-01` עד `2026-10-31`, וזה עובד כי התאריך הוא ISO.
  const q = query(
    shiftsRef(branchId),
    where('date', '>=', `${monthKey}-01`),
    where('date', '<=', `${monthKey}-31`),
    orderBy('date'),
  );
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Shift));
  });
}

/** כל המשמרות של חבר. לדוחות ולזכאות שחוצה חודשים. */
export async function shiftsOfMember(branchId: string, memberId: string): Promise<Shift[]> {
  const [assigned, handed] = await Promise.all([
    getDocs(query(shiftsRef(branchId), where('assigneeMemberId', '==', memberId))),
    getDocs(query(shiftsRef(branchId), where('handoverFromMemberId', '==', memberId))),
  ]);
  const byId = new Map<string, Shift>();
  for (const snapshot of [assigned, handed]) {
    for (const d of snapshot.docs) byId.set(d.id, { id: d.id, ...d.data() } as Shift);
  }
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function shiftId(date: string, templateId: string): string {
  return `${date}_${templateId}`;
}

/**
 * מוליד את משמרות החודש מתבניות הסניף.
 *
 * ⚠️ זה מה שפותר את נובמבר ודצמבר שאינם קיימים בגיליון: החודש נולד מהתבנית
 * ואינו ממתין שמישהו ייצור גיליון.
 *
 * ⚠️ ואינו דורס משמרת שכבר קיימת. `writeBatch` עם `merge` היה דורס שיבוץ,
 * ולכן נכתבות רק המשמרות שחסרות.
 */
export async function generateMonth(branchId: string, monthKey: string): Promise<number> {
  const branch = await getDoc(branchRef(branchId));
  if (!branch.exists()) throw new Error('הסניף אינו קיים');
  const templates = (branch.data() as Branch).shiftTemplates.filter((t) => t.isActive);

  const existing = await getDocs(
    query(
      shiftsRef(branchId),
      where('date', '>=', `${monthKey}-01`),
      where('date', '<=', `${monthKey}-31`),
    ),
  );
  const have = new Set(existing.docs.map((d) => d.id));

  const batch = writeBatch(db);
  let created = 0;

  for (const template of templates) {
    for (const date of datesInMonth(monthKey, template.weekdays)) {
      const id = shiftId(date, template.id);
      if (have.has(id)) continue;
      const shift: Omit<Shift, 'id'> = {
        branchId,
        date,
        templateId: template.id,
        // ⚠️ השעות מועתקות אל המשמרת בשעת היצירה. אחרת שינוי תבנית היום היה
        // משנה למפרע מה שמישהו התחייב אליו בינואר.
        startTime: template.startTime,
        endTime: template.endTime,
        attendance: 'assumed',
        handoverState: 'none',
      };
      batch.set(doc(shiftsRef(branchId), id), shift);
      created += 1;
    }
  }

  if (created > 0) await batch.commit();
  return created;
}

/**
 * חבר לוקח משמרת.
 *
 * ⚠️ בתוך טרנזקציה, ולא בכתיבה ישירה. שני חברים שלוחצים על אותה משמרת באותו
 * רגע הם המקרה שבו כתיבה ישירה מוחקת את השיבוץ של הראשון בשקט.
 */
export async function claimShift(
  branchId: string,
  id: string,
  memberId: string,
  memberName: string,
): Promise<void> {
  const ref = doc(shiftsRef(branchId), id);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('המשמרת אינה קיימת');
    const shift = snapshot.data() as Shift;

    // משמרת שמבוקש לה מחליף: הלוקח נכנס, והמוסר נשמר לזכאותו.
    if (shift.handoverState === 'requested' && shift.assigneeMemberId) {
      transaction.update(ref, {
        assigneeMemberId: memberId,
        assigneeName: memberName,
        assignedAt: Date.now(),
        assignedBy: memberId,
        handoverState: 'completed',
        handoverFromMemberId: shift.assigneeMemberId,
        handoverFromName: shift.assigneeName ?? null,
      });
      return;
    }

    if (shift.assigneeMemberId) {
      throw new Error('המשמרת נלקחה בינתיים');
    }

    transaction.update(ref, {
      assigneeMemberId: memberId,
      assigneeName: memberName,
      assignedAt: Date.now(),
      assignedBy: memberId,
    });
  });
}

/** חבר משחרר משמרת שלו, לפני שהוא ביקש מחליף. */
export async function releaseShift(branchId: string, id: string): Promise<void> {
  await updateDoc(doc(shiftsRef(branchId), id), {
    assigneeMemberId: null,
    assigneeName: null,
    assignedAt: null,
    assignedBy: null,
    handoverState: 'none',
    handoverRequestedAt: null,
    handoverReason: null,
  });
}

/**
 * חבר מבקש מחליף.
 *
 * ⚠️ המשמרת נשארת שלו. האחריות עוברת רק כשמישהו לוקח, וזה ההפרש בין "לא אוכל
 * להגיע" לבין "זה כבר לא הבעיה שלי".
 */
export async function requestHandover(
  branchId: string,
  id: string,
  reason?: string,
): Promise<void> {
  await updateDoc(doc(shiftsRef(branchId), id), {
    handoverState: 'requested',
    handoverRequestedAt: Date.now(),
    handoverReason: reason ?? null,
  });
}

export async function cancelHandoverRequest(branchId: string, id: string): Promise<void> {
  await updateDoc(doc(shiftsRef(branchId), id), {
    handoverState: 'none',
    handoverRequestedAt: null,
    handoverReason: null,
  });
}

/** המנהלת מסמנת חריג. ברירת המחדל היא שהמשמרת התקיימה. */
export async function setAttendance(
  branchId: string,
  id: string,
  attendance: Shift['attendance'],
  setBy: string,
): Promise<void> {
  await updateDoc(doc(shiftsRef(branchId), id), {
    attendance,
    attendanceSetBy: setBy,
    attendanceSetAt: Date.now(),
  });
}

// ---------- ימי פעילות ----------

export function watchActivityDaysForMonth(
  branchId: string,
  monthKey: string,
  onChange: (days: ActivityDay[]) => void,
): Unsubscribe {
  const q = query(
    activityRef(branchId),
    where('date', '>=', `${monthKey}-01`),
    where('date', '<=', `${monthKey}-31`),
    orderBy('date'),
  );
  return onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ActivityDay));
  });
}

export async function saveActivityDay(
  branchId: string,
  day: Omit<ActivityDay, 'id' | 'branchId'>,
): Promise<void> {
  await setDoc(
    doc(activityRef(branchId), day.date),
    { ...day, branchId },
    { merge: true },
  );
}

// ---------- קוד הכניסה ----------

export function watchAccessCodes(
  branchId: string,
  onChange: (codes: AccessCode[]) => void,
): Unsubscribe {
  return onSnapshot(query(codesRef(branchId), orderBy('validFrom', 'desc')), (snapshot) => {
    onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as AccessCode));
  });
}

/**
 * המנהלת מגדירה קוד חדש.
 *
 * ⚠️ מסמך חדש ולא עדכון של הקיים. הקודמים נשמרים, וזו ההיסטוריה שמאפשרת לדעת
 * איזה קוד היה תקף כשחבר ראה אותו.
 */
export async function setAccessCode(
  branchId: string,
  code: string,
  setBy: string,
  validFrom: number = Date.now(),
): Promise<void> {
  const id = `${validFrom}`;
  const record: Omit<AccessCode, 'id'> = {
    branchId,
    code,
    validFrom,
    periodMonth: periodMonthOf(validFrom),
    setBy,
    setAt: Date.now(),
  };
  await setDoc(doc(codesRef(branchId), id), record);
}

// ---------- הזרעה ----------

/** תבניות המשמרת של תל אביב, כפי שנמדדו בגיליון 2026. */
/** ⚠️ נמדדו בתל אביב, ומשמשות נקודת פתיחה לכל סלון. המנהל עורך. */
const DEFAULT_TEMPLATES: ShiftTemplate[] = [
  {
    id: 'morning',
    label: 'משמרת בוקר',
    startTime: '10:00',
    endTime: '14:00',
    weekdays: [0, 1, 2, 3, 4],
    isActive: true,
  },
  {
    id: 'evening',
    label: 'משמרת ערב',
    startTime: '18:00',
    endTime: '22:00',
    weekdays: [0, 1, 2, 3, 4],
    isActive: true,
  },
];

/**
 * סלון חדש, עם מה שצריך כדי שיעבוד מהרגע הראשון.
 *
 * ⚠️ השעות והתבניות כאן הן נקודת פתיחה ולא קביעה. בחיפה השעות שונות מיום
 * ליום, והמנהל עורך אותן. DOCS/PLANING/12-the-branch-settings-screen.md
 */
function newBranch(
  input: { name: string; city: string },
  createdBy: string,
): Omit<Branch, 'id'> {
  const openingHours: Branch['openingHours'] = {
    0: { open: '10:00', close: '22:00' },
    1: { open: '10:00', close: '22:00' },
    2: { open: '10:00', close: '22:00' },
    3: { open: '10:00', close: '22:00' },
    4: { open: '10:00', close: '22:00' },
    5: null,
    6: null,
  };

  return {
    name: input.name,
    city: input.city,
    timezone: 'Asia/Jerusalem',
    openingHours,
    shiftTemplates: DEFAULT_TEMPLATES,
    // ⚠️ בלי חללים. לכל סלון החללים שלו, והמנהל כותב אותם.
    spaces: [],
    isActive: true,
    icsToken: crypto.randomUUID().replace(/-/g, ''),
    createdBy,
    createdAt: Date.now(),
  };
}

/** חותמת שרת, למקום שבו נדרש זמן שאינו מהמכשיר של המשתמש. */
export const now = serverTimestamp;

export const currentMonthKey = () => toMonthKey(new Date());
