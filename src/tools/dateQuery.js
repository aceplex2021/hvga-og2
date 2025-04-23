import { getTodayDate } from './dateUtils.js';

export const name = 'get_date';
export const description = 'Get the current date or handle date-related queries';

export async function handler(parameters) {
  try {
    const { query } = parameters;
    
    if (query.toLowerCase().includes('today') || query.toLowerCase().includes('current date')) {
      return {
        date: getTodayDate()
      };
    }
    
    return {
      error: 'Unsupported date query'
    };
  } catch (error) {
    console.error('Error in date query tool:', error);
    return {
      error: 'Failed to get date information'
    };
  }
} 