import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isDateWithinBackdateLimit(selectedDate: Date | string, backdateLimit: number): boolean {
  if (backdateLimit === -1) return true; // Unlimited
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dateToCheck = new Date(selectedDate);
  dateToCheck.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - dateToCheck.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays <= backdateLimit;
}
