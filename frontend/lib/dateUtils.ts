/**
 * Date Utilities for Timezone-Agnostic Date Handling
 *
 * This utility library ensures that dates are handled consistently across
 * different timezones without unwanted conversions.
 *
 * IMPORTANT: SQL Server stores dates as DATE type (without time/timezone).
 * When these dates are sent to the frontend, they should be treated as
 * "calendar dates" and not converted based on timezone.
 */

/**
 * Format a date string (YYYY-MM-DD) to a human-readable format
 * WITHOUT timezone conversion
 *
 * @param dateString - Date string in YYYY-MM-DD format (e.g., "2026-01-01")
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 *
 * @example
 * formatDateString("2026-01-01") // "January 1, 2026" (regardless of timezone)
 * formatDateString("2026-01-01", { weekday: 'long' }) // "Wednesday, January 1, 2026"
 */
export function formatDateString(
  dateString: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
): string {
  if (!dateString) return '';

  // If it's already a Date object, extract the date string first
  if (dateString instanceof Date) {
    dateString = dateString.toISOString().split('T')[0];
  }

  // Parse the date components manually to avoid timezone issues
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);

  // Create date using UTC to avoid timezone conversion
  // Then format using the local timezone's formatter but with the correct date
  const date = new Date(Date.UTC(year, month - 1, day));

  // Use UTC methods to format to avoid timezone shifts
  const formatter = new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: 'UTC' // Force UTC to prevent timezone conversion
  });

  return formatter.format(date);
}

/**
 * Format a date string to a short format (MM/DD/YYYY)
 * WITHOUT timezone conversion
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string in MM/DD/YYYY format
 *
 * @example
 * formatDateShort("2026-01-01") // "01/01/2026"
 */
export function formatDateShort(dateString: string | Date): string {
  if (!dateString) return '';

  // If it's already a Date object, extract the date string first
  if (dateString instanceof Date) {
    dateString = dateString.toISOString().split('T')[0];
  }

  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);

  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
}

/**
 * Parse a date string safely without timezone conversion
 * Returns individual date components
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Object with year, month, day properties
 */
export function parseDateString(dateString: string | Date): {
  year: number;
  month: number;
  day: number;
} {
  if (!dateString) {
    return { year: 0, month: 0, day: 0 };
  }

  // If it's already a Date object, extract the date string first
  if (dateString instanceof Date) {
    dateString = dateString.toISOString().split('T')[0];
  }

  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);

  return { year, month, day };
}

/**
 * Format time string to 12-hour format with AM/PM
 *
 * @param timeString - Time string in HH:MM:SS or HH:MM format
 * @returns Formatted time string
 *
 * @example
 * formatTime("09:30:00") // "9:30 AM"
 * formatTime("14:30:00") // "2:30 PM"
 */
export function formatTime(timeString: string): string {
  if (!timeString) return '';

  // Remove microseconds if present (e.g., "09:30:00.0000000")
  const cleanTime = timeString.split('.')[0];

  const [hours, minutes] = cleanTime.split(':').map(Number);

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Format date and time together
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @param timeString - Time string in HH:MM:SS or HH:MM format
 * @returns Formatted date and time string
 *
 * @example
 * formatDateTime("2026-01-01", "09:30:00") // "January 1, 2026 at 9:30 AM"
 */
export function formatDateTime(dateString: string | Date, timeString: string): string {
  const formattedDate = formatDateString(dateString);
  const formattedTime = formatTime(timeString);

  return `${formattedDate} at ${formattedTime}`;
}

/**
 * Get day of week from date string WITHOUT timezone conversion
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(dateString: string): number {
  if (!dateString) return 0;

  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);

  // Create date using UTC to avoid timezone conversion
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCDay();
}

/**
 * Check if a date is today (in local timezone)
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns true if the date is today
 */
export function isToday(dateString: string): boolean {
  if (!dateString) return false;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return dateString.split('T')[0] === todayStr;
}

/**
 * Compare two date strings
 *
 * @param date1 - First date string in YYYY-MM-DD format
 * @param date2 - Second date string in YYYY-MM-DD format
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDates(date1: string, date2: string): number {
  const d1 = date1.split('T')[0];
  const d2 = date2.split('T')[0];

  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
}

/**
 * Convert a Date object to YYYY-MM-DD format in LOCAL timezone
 * (Use this when converting from a date picker to send to backend)
 *
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format
 */
export function dateToString(date: Date): string {
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
