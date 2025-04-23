/** @typedef {import('../types/tool').ToolDefinition} ToolDefinition */

/**
 * @typedef {Object} TXCupStanding
 * @property {number} position
 * @property {string} name
 * @property {number} totalScore
 */

/**
 * @returns {Promise<TXCupStanding[]>}
 */
async function getTxCupStandings() {
  try {
    const url = process.env.TX_CUP_STANDINGS_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    
    console.log('TX Cup URL:', url);
    console.log('Has Anon Key:', !!anonKey);

    if (!url || !anonKey) {
      console.error('Missing required environment variables:');
      console.error('TX_CUP_STANDINGS_URL:', !!url);
      console.error('SUPABASE_ANON_KEY:', !!anonKey);
      return [];
    }

    console.log('Attempting to fetch TX Cup standings...');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`Failed to fetch standings: ${response.status}`);
    }

    const data = await response.json();
    console.log('Response data:', data);
    return data.standings || [];
  } catch (error) {
    console.error('Error fetching TX Cup standings:', error);
    return [];
  }
}

/** @type {ToolDefinition} */
export const getTxCupStandingsTool = {
  name: 'get_tx_cup_standings',
  description: 'Fetches the current TX Cup standings from the HVGA database. Shows all player rankings, specific ranges (e.g., 16-30), or finds specific player rankings.',
  parameters: {
    type: 'object',
    properties: {
      playerName: {
        type: 'string',
        description: 'Optional. Name of specific player to look up their ranking.'
      },
      startRank: {
        type: 'number',
        description: 'Optional. Start position for range query (inclusive).'
      },
      endRank: {
        type: 'number',
        description: 'Optional. End position for range query (inclusive).'
      },
      topN: {
        type: 'number',
        description: 'Optional. Number of top players to return.'
      }
    },
    required: []
  },
  handler: async (params) => {
    console.log('TX Cup standings tool called with params:', params);
    const standings = await getTxCupStandings();
    console.log('Received standings:', standings);
    
    if (!standings || standings.length === 0) {
      return {
        message: "I don't have access to real-time data or updates on the current standings for the TX Cup. For the latest updates, please refer to the HVGA official website or contact Jesse Nguyen, the TX Cup Captain."
      };
    }

    // If looking for a specific player
    if (params.playerName) {
      const searchName = params.playerName.toLowerCase();
      const matchingPlayers = standings.filter(s => 
        s.name.toLowerCase().includes(searchName)
      );

      if (matchingPlayers.length > 0) {
        if (matchingPlayers.length === 1) {
          const player = matchingPlayers[0];
          return {
            message: `• ${player.position}. ${player.name} - ${player.totalScore} points`
          };
        } else {
          return {
            message: matchingPlayers.map(p => `• ${p.position}. ${p.name} - ${p.totalScore} points`).join('\n')
          };
        }
      } else {
        return {
          message: `No players found matching "${params.playerName}" in the current TX Cup standings.`
        };
      }
    }

    // If looking for top N players
    if (params.topN) {
      const topPlayers = standings.slice(0, params.topN);
      return {
        message: topPlayers.map(s => `• ${s.position}. ${s.name} - ${s.totalScore} points`).join('\n')
      };
    }

    // If looking for a specific range
    if (params.startRank || params.endRank) {
      const start = params.startRank || 1;
      const end = params.endRank || standings.length;
      
      const rangeStandings = standings.filter(s => 
        s.position >= start && s.position <= end
      );

      if (rangeStandings.length > 0) {
        return {
          message: rangeStandings.map(s => `• ${s.position}. ${s.name} - ${s.totalScore} points`).join('\n')
        };
      } else {
        return {
          message: `No players found in positions ${start} through ${end}.`
        };
      }
    }

    // Return all standings if no specific query
    return {
      message: standings.map(s => `• ${s.position}. ${s.name} - ${s.totalScore} points`).join('\n')
    };
  }
}; 