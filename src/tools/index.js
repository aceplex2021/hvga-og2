import { getTxCupStandingsTool } from './getTxCupStandings.js';
import { handler as dateQueryHandler } from './dateQuery.js';

export const tools = [
  getTxCupStandingsTool,
  {
    name: 'get_date',
    description: 'Get the current date or handle date-related queries',
    handler: dateQueryHandler
  }
]; 