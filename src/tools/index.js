import { getTxCupStandingsTool } from './getTxCupStandings.js';
import { handler as tournamentWinnersHandler } from './tournamentWinners.js';
import { handler as dateQueryHandler } from './dateQuery.js';

export const tools = [
  getTxCupStandingsTool,
  {
    name: 'get_tournament_winners',
    description: 'Get tournament winners for a specific date or relative time expression',
    handler: tournamentWinnersHandler
  },
  {
    name: 'get_date',
    description: 'Get the current date or handle date-related queries',
    handler: dateQueryHandler
  }
]; 