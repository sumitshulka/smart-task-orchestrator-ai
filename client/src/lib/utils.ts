import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatOrgDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "—";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return "—";
  }
}
