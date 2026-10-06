// src/services/importService.ts
//
// קורא תמונה של לוח חודשי דרך פונקציה של Firebase.
//
// ⚠️⚠️ וזה עבר לכאן מ-Netlify אחרי כשל שנמדד, ולא מהעדפה:
//
//   1. ⚠️ הפונקציה ב-Netlify חזרה ב-504. שער Netlify סוגר חיבור סינכרוני
//      אחרי עשר שניות, וקריאת לוח של שישה עשר ימים אורכת יותר.
//      ⚠️ והתיקון הראשון שלי היה להקטין את התמונה, וזה היה תיקון לבעיה הלא
//      נכונה: התמונה שוקלת 300 קילובייט. מה שלוקח זמן הוא המודל.
//   2. שם היה צריך לאמת חתימה של אסימון ביד. `httpsCallable` מעביר זהות.
//   3. ⚠️ ושם לא הייתה דרך לבדוק שהקורא הוא מנהלת. כאן הפונקציה בודקת.
//
// ⚠️ והאפליקציה אינה מחזיקה את מפתח המודל ואינה יכולה להחזיק אותו. כל מה
// שמתחיל ב-`VITE_` נדחף לחבילה שהדפדפן מוריד, והמאגר הזה ציבורי.
//
// DOCS/PLANING/23-the-import-moved-to-firebase.md

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export type ImportedAccess = 'unknown' | 'open' | 'membersOnly' | 'closed';

export interface ImportedEvent {
  title: string;
  startTime?: string;
  endTime?: string;
  /**
   * ⚠️ החלל שבו האירוע מתקיים, והמנהלת משייכת אותו.
   * המודל אינו קורא אותו מהתמונה: הגיליון אינו כותב חללים, ובלשון בעל המוצר
   * 06/10 "לאפשר למנהלת לערוך אירועים מהייבוא ולשייך אותם לחלל בהם הם
   * מתקיימים, וזה עוד בשלב הייבוא". DOCS/PLANING/26
   */
  spaceId?: string;
}

export interface ImportedDay {
  date: string;
  note: string;
  access: ImportedAccess;
  events: ImportedEvent[];
  /** 0 עד 1. ⚠️ מוצג למנהלת, כדי שהיא תדע במה לא לסמוך. */
  confidence: number;
}

/** ⚠️ עשרה מגה, כמו בפונקציה. נבדק כאן כדי לא לשלוח ולהיכשל. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export class ImportError extends Error {}

function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ImportError('readFailed'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      // `data:image/png;base64,XXXX`, והפונקציה רוצה את XXXX בלבד.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

interface CallResult {
  model: string;
  days: ImportedDay[];
}

const callReadBoardImage = httpsCallable<
  { branchId: string; monthKey: string; mimeType: string; imageBase64: string },
  CallResult
>(functions, 'readBoardImage');

export async function readBoardImage(
  file: File,
  branchId: string,
  monthKey: string,
): Promise<ImportedDay[]> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new ImportError('badType');
  if (file.size > MAX_IMAGE_BYTES) throw new ImportError('tooLarge');

  try {
    const result = await callReadBoardImage({
      branchId,
      monthKey,
      mimeType: file.type,
      imageBase64: await base64Of(file),
    });
    return Array.isArray(result.data?.days) ? result.data.days : [];
  } catch (error) {
    /*
      ⚠️ השגיאה של `httpsCallable` נושאת את ההודעה שהפונקציה זרקה, ולכן
      `notManager` או `modelFailed` מגיעים לכאן כמו שהם ומתורגמים במסך.
      שגיאה שאינה מוכרת אינה מוצגת כלשונה.
    */
    const message = error instanceof Error ? error.message : '';
    const known = ['notManager', 'noAuth', 'badImage', 'tooLarge', 'badMonth',
      'modelFailed', 'emptyAnswer', 'notJson', 'memberLookupFailed', 'unexpected',
      // ⚠️ חיוב של המודל, ואינו תקלה חולפת. אין טעם לנסות שוב.
      'quotaExhausted'];
    const code = known.find((candidate) => message.includes(candidate));
    throw new ImportError(code ?? 'modelFailed');
  }
}
