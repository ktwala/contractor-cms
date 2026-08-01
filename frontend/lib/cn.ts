type ClassValue = string | false | null | undefined;

/** Merge class names (tailwind-friendly). */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
