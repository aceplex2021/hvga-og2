/**
 * Date utility functions for the HVGA chatbot
 */

/**
 * Parse a date string into a Date object
 * @param {string} dateStr - Date string in various formats
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Try parsing with Date constructor first
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;
  
  // Try parsing common date formats
  const formats = [
    // MM/DD/YYYY
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // YYYY-MM-DD
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    // Month DD, YYYY
    /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/,
    // DD Month YYYY
    /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/,
    // Tournament format: Nov. 11th, 2024
    /([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0] || format === formats[1]) {
        // MM/DD/YYYY or YYYY-MM-DD
        const [_, first, second, year] = match;
        const month = format === formats[0] ? first - 1 : second - 1;
        const day = format === formats[0] ? second : first;
        return new Date(year, month, day);
      } else {
        // Month DD, YYYY or DD Month YYYY or Tournament format
        const [_, first, second, year] = match;
        const month = format === formats[2] || format === formats[4] ? 
          new Date(first + ' 1, 2000').getMonth() : 
          new Date(second + ' 1, 2000').getMonth();
        const day = format === formats[2] || format === formats[4] ? second : first;
        return new Date(year, month, day);
      }
    }
  }
  
  // Special handling for tournament dates in the knowledge base
  // Format: "Nov. 11th, 2024" or "Apr. 12th, 2025"
  const tournamentMatch = dateStr.match(/([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (tournamentMatch) {
    const [_, month, day, year] = tournamentMatch;
    const monthIndex = new Date(`${month} 1, 2000`).getMonth();
    return new Date(year, monthIndex, day);
  }
  
  return null;
}

/**
 * Check if a date string matches a relative time expression
 * @param {string} text - Text to check for relative time expressions
 * @returns {string|null} - Matched relative time expression or null
 */
export function getRelativeTimeExpression(text) {
  if (!text) return null;
  
  const lowerText = text.toLowerCase();
  
  // Check for relative time expressions
  const relativeExpressions = {
    'today': 'today',
    'tomorrow': 'tomorrow',
    'yesterday': 'yesterday',
    'next week': 'next week',
    'last week': 'last week',
    'next month': 'next month',
    'last month': 'last month',
    'next year': 'next year',
    'last year': 'last year'
  };
  
  for (const [key, value] of Object.entries(relativeExpressions)) {
    if (lowerText.includes(key)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Get a date based on a relative time expression
 * @param {string} expression - Relative time expression
 * @returns {Date} - Calculated date
 */
export function getDateFromExpression(expression) {
  const today = new Date();
  
  switch (expression) {
    case 'today':
      return today;
    case 'tomorrow':
      return new Date(today.setDate(today.getDate() + 1));
    case 'yesterday':
      return new Date(today.setDate(today.getDate() - 1));
    case 'next week':
      return new Date(today.setDate(today.getDate() + 7));
    case 'last week':
      return new Date(today.setDate(today.getDate() - 7));
    case 'next month':
      return new Date(today.setMonth(today.getMonth() + 1));
    case 'last month':
      return new Date(today.setMonth(today.getMonth() - 1));
    case 'next year':
      return new Date(today.setFullYear(today.getFullYear() + 1));
    case 'last year':
      return new Date(today.setFullYear(today.getFullYear() - 1));
    default:
      return today;
  }
}

/**
 * Format a date into a human-readable string
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
  if (!date || isNaN(date.getTime())) return 'Invalid date';
  
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Check if a date is within a specific range
 * @param {Date} date - Date to check
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @returns {boolean} - True if date is within range
 */
export function isDateInRange(date, startDate, endDate) {
  if (!date || !startDate || !endDate) return false;
  return date >= startDate && date <= endDate;
}

/**
 * Get today's date in a human-readable format
 * @returns {string} - Formatted date string
 */
export function getTodayDate() {
  const today = new Date();
  return formatDate(today);
} 