// src/components/layout/Icons.tsx
//
// אייקונים קטנים לכותרת.
//
// ⚠️ SVG ולא תו טקסט. תו כמו ‹ או › הוא תו שהדפדפן מהפך לבד ב-RTL, ואז חץ
// "חודש קודם" מצביע לכיוון ההפוך. DOCS/PLANING/26
//
// ⚠️ ואף אחד מהם אינו נושא משמעות לבדו: לכל כפתור יש `aria-label` ו-`title`.

interface Props {
  className?: string;
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** ⚠️ הכיוון כתוב במפורש. הממשק עברי בלבד, וקודם הוא ימינה. */
export function ChevronRight({ className = 'size-5' }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

export function ChevronLeft({ className = 'size-5' }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <polyline points="15 6 9 12 15 18" />
    </svg>
  );
}

/** חץ של רשימה נפתחת. ⚠️ אינו כיווני על ציר הקריאה, ולכן אינו מתהפך. */
export function ChevronDown({ className = 'size-4' }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** החברים. ⚠️ אינו אייקון כיווני. */
export function Users({ className = 'size-5' }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
      <circle cx="9" cy="7" r="3.2" />
      <path d="M22 19v-1a4 4 0 0 0-3-3.87" />
      <path d="M16.5 4.2a3.2 3.2 0 0 1 0 5.6" />
    </svg>
  );
}

/** יציאה. ⚠️ כיווני, והוא מצביע החוצה בעברית, כלומר שמאלה. */
export function SignOut({ className = 'size-5' }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <polyline points="15 8 19 12 15 16" />
      <line x1="19" y1="12" x2="10" y2="12" />
    </svg>
  );
}

/** שלושת הקווים. ⚠️ המילה "תפריט" יושבת ב-aria-label ולא על המסך. */
export function Hamburger({ className = 'size-5' }: Props) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}
