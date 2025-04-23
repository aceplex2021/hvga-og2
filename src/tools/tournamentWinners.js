import { getRelativeTimeExpression, getDateFromExpression, formatDate, parseDate } from './dateUtils.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const name = 'get_tournament_winners';
export const description = 'Get tournament winners for a specific date or relative time expression';

function validateTournamentDetails(tournamentInfo) {
  const requiredFields = ['date', 'venue', 'time', 'cost', 'format'];
  const missingFields = requiredFields.filter(field => !tournamentInfo[field]);
  
  if (missingFields.length > 0) {
    console.warn(`Missing tournament details: ${missingFields.join(', ')}`);
    return false;
  }
  
  // Validate time format (should be in the format "XAM" or "XPM")
  if (!/^\d{1,2}(AM|PM)/.test(tournamentInfo.time)) {
    console.warn(`Invalid time format: ${tournamentInfo.time}`);
    return false;
  }
  
  // Validate cost format (should be a number)
  if (isNaN(parseInt(tournamentInfo.cost))) {
    console.warn(`Invalid cost format: ${tournamentInfo.cost}`);
    return false;
  }
  
  return true;
}

function extractTournamentDetails(tournamentText) {
  const details = {
    date: null,
    venue: null,
    time: null,
    cost: null,
    format: null
  };
  
  // Extract date
  const dateMatch = tournamentText.match(/(\w+ \d{1,2}(?:st|nd|rd|th)?, \d{4})/);
  if (dateMatch) {
    details.date = dateMatch[1];
  }
  
  // Extract venue
  const venueMatch = tournamentText.match(/- ([^-]+) (\d{1,2}(?:AM|PM))/);
  if (venueMatch) {
    details.venue = venueMatch[1].trim();
    details.time = venueMatch[2];
  }
  
  // Extract cost
  const costMatch = tournamentText.match(/Cost: \$(\d+)/);
  if (costMatch) {
    details.cost = costMatch[1];
  }
  
  // Extract format
  if (tournamentText.includes('Shotgun')) {
    details.format = 'Shotgun start';
  } else if (tournamentText.includes('tee time')) {
    details.format = 'Tee time start';
  }
  
  return details;
}

export async function handler(parameters) {
  try {
    const { date, relativeTime } = parameters;
    
    // Load knowledge base
    const knowledgeBase = await fs.readFile(
      path.join(__dirname, '../../Houston Vietnamese Golf Association.txt'),
      'utf-8'
    );

    // Parse tournament schedule
    const scheduleMatch = knowledgeBase.match(/Tournament Schedule:([^>]+)>>>/s);
    const tournamentSchedule = scheduleMatch ? scheduleMatch[1].split('\n')
      .filter(line => line.trim().startsWith('•'))
      .map(line => {
        // Extract date and details
        const match = line.match(/•\s+([^-]+)-\s*(.+)/);
        if (match) {
          const dateStr = match[1].trim();
          const details = match[2].trim();
          
          // Parse the date
          const parsedDate = parseDate(dateStr);
          
          // Extract time and cost from details
          const timeMatch = details.match(/(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?|\d{1,2}(?:\s*[AaPp][Mm])?)\s*(?:Shotgun|tee time|starting)/);
          const costMatch = details.match(/Cost:\s*\$(\d+)/);
          
          return {
            date: dateStr,
            parsedDate,
            details,
            time: timeMatch ? timeMatch[1].trim() : null,
            cost: costMatch ? parseInt(costMatch[1]) : null,
            venue: details.split(/\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?|\d{1,2}(?:\s*[AaPp][Mm])?/)[0].trim()
          };
        }
        return null;
      })
      .filter(Boolean) : [];

    // Parse tournament winners
    const winnersSection = knowledgeBase.match(/Tournament Winners:([^>]+)>>>/s);
    const tournaments = winnersSection ? winnersSection[1].split('\n\n')
      .filter(block => block.includes('Flight') || block.includes('Champ'))
      .map(block => {
        const [header, ...results] = block.split('\n').filter(Boolean);
        const dateMatch = header.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i);
        const venueMatch = header.match(/[–-]\s*([^]+)$/);
        
        return {
          date: dateMatch ? dateMatch[0] : '',
          parsedDate: dateMatch ? parseDate(dateMatch[0]) : null,
          venue: venueMatch ? venueMatch[1].trim() : '',
          winners: results.map(line => {
            const parts = line.split(/\t|\s{2,}/).filter(Boolean);
            return {
              flight: parts[0].includes('Flight') ? parts[0] : '',
              type: parts[1]?.includes('Champ') ? parts[1] : parts[0],
              name: parts[parts.length - 2],
              score: parts[parts.length - 1].replace(/[()]/g, '')
            };
          })
        };
      }) : [];

    // Get today's date
    const today = new Date();

    // Handle relative time expressions
    if (relativeTime) {
      const expression = getRelativeTimeExpression(relativeTime);
      if (expression) {
        if (expression === 'next tournament') {
          // Find the next tournament after today
          const nextTournament = tournamentSchedule
            .filter(t => t.parsedDate && t.parsedDate > today)
            .sort((a, b) => a.parsedDate - b.parsedDate)[0];
            
          if (nextTournament) {
            return {
              type: 'schedule',
              tournament: nextTournament
            };
          }
        } else if (expression === 'last tournament') {
          // Find the most recent tournament before today
          const lastTournament = tournaments
            .filter(t => t.parsedDate && t.parsedDate <= today)
            .sort((a, b) => b.parsedDate - a.parsedDate)[0];
            
          if (lastTournament) {
            return {
              type: 'results',
              tournament: lastTournament
            };
          }
        }
      }
    }
    // Handle specific date
    else if (date) {
      const targetDate = parseDate(date);
      if (targetDate) {
        const tournament = tournaments.find(t => t.parsedDate && t.parsedDate.getTime() === targetDate.getTime());
        if (tournament) {
          return {
            type: 'results',
            tournament
          };
        }
      }
    }

    return {
      error: 'No tournament information found for the specified date/time'
    };
  } catch (error) {
    console.error('Error in tournament winners tool:', error);
    return {
      error: 'Failed to get tournament information'
    };
  }
} 