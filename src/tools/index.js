import { getTxCupStandingsTool } from './getTxCupStandings.js';
import { handler as dateQueryHandler } from './dateQuery.js';
import { getMembersProfileTool } from './getMembersProfile.js';

export const tools = [
  getTxCupStandingsTool,
  getMembersProfileTool,
  {
    name: 'get_date',
    description: 'Get the current date or handle date-related queries',
    handler: dateQueryHandler
  }
]; 