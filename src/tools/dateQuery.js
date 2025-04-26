import { getTodayDate } from './dateUtils.js';
import { formatDate, parseDate, getRelativeTimeExpression, getDateFromExpression } from './dateUtils.js';

export const name = 'get_date';
export const description = 'Get the current date or handle date-related queries. DO NOT use for questions about tournament schedules or event dates.';

export async function handler(parameters = {}) {
  try {
    const { date, relativeTime } = parameters;
    
    // If no parameters provided, return today's date
    if (!date && !relativeTime) {
      return {
        date: new Date(),
        formattedDate: formatDate(new Date())
      };
    }
    
    // Handle relative time expressions
    if (relativeTime) {
      // Skip special handling for tournament-related queries
      if (relativeTime.toLowerCase().includes('tournament')) {
        return {
          message: "For tournament schedule questions, please refer to the HVGA knowledge base."
        };
      }
      
      const expression = getRelativeTimeExpression(relativeTime);
      if (expression) {
        const date = getDateFromExpression(expression);
        return {
          date,
          formattedDate: formatDate(date)
        };
      }
    }
    
    // Handle specific date
    if (date) {
      const parsedDate = parseDate(date);
      if (parsedDate) {
        return {
          date: parsedDate,
          formattedDate: formatDate(parsedDate)
        };
      }
    }
    
    return {
      error: 'Invalid date parameters'
    };
  } catch (error) {
    console.error('Error in date query tool:', error);
    return {
      error: 'Failed to get date information'
    };
  }
} 