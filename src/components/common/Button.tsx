// src/components/common/Button.tsx
//
// ⚠️⚠️ כפתור אחד לכל המוצר.
//
// בלשון בעל המוצר, 06/10, אחרי שעבר על גרסת הנייד: "זה קורה בהמון מסכים, ולכן
// פתרון מערכתי יפתור את זה". וזה נכון: כל מסך כתב לעצמו מחרוזת מחלקות משלו,
// ולכן באותו מסך ישבו זה ליד זה בלוק ירוק מלא ברוחב המסך, כפתור עם מסגרת
// אפורה, וקישור טקסט, בלי שאחד מהם אמר משהו על החשיבות שלו.
// DOCS/PLANING/26
//
// ⚠️ חמישה תפקידים, וכל אחד מהם אומר משהו:
//   primary    הפעולה היחידה שהמשטח הזה קיים בשבילה. ⚠️ אחת למשטח.
//   action     פעולה אמיתית שחוזרת הרבה, כמו תפיסת משמרת. מסגרת ולא מילוי,
//              כי מילוי שחוזר בכל כרטיס אינו מדגיש דבר.
//   secondary  פעולה משנית, ברורה ושקטה.
//   quiet      כמעט קישור. ביטול, סגירה, וויתור.
//   danger     פעולה שמוחקת משהו של מישהו.
//
// ⚠️ וגובה מינימלי 44 במידה md. זה יעד הנגיעה, ורוב השימוש בטלפון.

export type ButtonTone = 'primary' | 'action' | 'secondary' | 'quiet' | 'danger';

const TONES: Record<ButtonTone, string> = {
  primary: 'bg-brand text-brand-ink font-semibold hover:opacity-90',
  action:
    'border border-brand bg-brand-soft text-brand font-semibold hover:bg-brand hover:text-brand-ink',
  secondary: 'border border-line-strong bg-surface text-ink font-medium hover:bg-brand-soft',
  quiet: 'text-ink-soft underline-offset-4 hover:underline',
  danger: 'text-danger font-medium underline-offset-4 hover:underline',
};

const SIZES = {
  md: 'min-h-11 px-4 text-sm',
  sm: 'min-h-9 px-3 text-sm',
  xs: 'min-h-8 px-2 text-xs',
} as const;

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  size?: keyof typeof SIZES;
  /** ⚠️ רוחב מלא רק כשהפעולה היא באמת כל המשטח. */
  block?: boolean;
}

export function Button({
  tone = 'secondary',
  size = 'md',
  block = false,
  className = '',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      // eslint-disable-next-line react/button-has-type
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg transition-colors disabled:opacity-50 ${
        TONES[tone]
      } ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  );
}
