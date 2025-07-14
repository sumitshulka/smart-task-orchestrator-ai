import { format } from "date-fns";

// Get organization date format from settings
export function getOrgDateFormat(): string {
  try {
    const settings = localStorage.getItem('organization_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.date_format || "MM/dd/yyyy";
    }
  } catch (error) {
    console.warn("Error reading organization settings:", error);
  }
  return "MM/dd/yyyy"; // default format
}

// Format date according to organization settings
export function formatOrgDate(date: string | Date | null | undefined): string {
  if (!date) return "No date";
  
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "Invalid date";
    
    const orgFormat = getOrgDateFormat();
    
    // Convert our format strings to date-fns format
    switch (orgFormat) {
      case "MM/dd/yyyy":
        return format(dateObj, "MM/dd/yyyy");
      case "dd/MM/yyyy":
        return format(dateObj, "dd/MM/yyyy");
      case "yyyy-MM-dd":
        return format(dateObj, "yyyy-MM-dd");
      case "MMM dd, yyyy":
        return format(dateObj, "MMM dd, yyyy");
      case "dd MMM yyyy":
        return format(dateObj, "dd MMM yyyy");
      default:
        return format(dateObj, "MM/dd/yyyy");
    }
  } catch (error) {
    console.warn("Error formatting date:", error);
    return "Invalid date";
  }
}

// Format date with time
export function formatOrgDateTime(date: string | Date | null | undefined): string {
  if (!date) return "No date";
  
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "Invalid date";
    
    const dateStr = formatOrgDate(dateObj);
    const timeStr = format(dateObj, "h:mm a");
    return `${dateStr} ${timeStr}`;
  } catch (error) {
    console.warn("Error formatting date time:", error);
    return "Invalid date";
  }
}