import { ToolDefinition } from '../types/tool';

interface TXCupStanding {
  position: number;
  name: string;
  totalScore: number;
}

async function getTxCupStandings() {
  try {
    const url = process.env.TX_CUP_STANDINGS_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!url || !anonKey) {
      console.error('Missing required environment variables');
      return [];
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch standings: ${response.status}`);
    }

    const data = await response.json();
    return data.standings || [];
  } catch (error) {
    console.error('Error fetching TX Cup standings:', error);
    return [];
  }
}

export const getTxCupStandingsTool: ToolDefinition = {
  name: 'get_tx_cup_standings',
  description: 'Use this tool ONLY for questions about current TX Cup rankings, points, or qualification status. DO NOT use for questions about TX Cup rules, schedule, or format.',
  parameters: {
    type: 'object',
    properties: {
      topN: {
        type: 'number',
        description: 'Number of top players to return (optional)'
      },
      playerName: {
        type: 'string',
        description: 'Specific player name to look up (optional)'
      }
    },
    required: []
  },
  handler: async (params) => {
    console.log('TX Cup standings tool called with params:', params);
    const standings = await getTxCupStandings();
    
    if (standings.length === 0) {
      return {
        message: "I don't have access to the current TX Cup standings at the moment. For the latest updates, please check the HVGA website or contact the TX Cup Captain."
      };
    }

    // If looking up a specific player
    if (params?.playerName) {
      const player = standings.find(p => 
        p.name.toLowerCase() === params.playerName.toLowerCase()
      );
      
      if (!player) {
        return {
          message: `I couldn't find ${params.playerName} in the current TX Cup standings.`
        };
      }
      
      return {
        message: `${player.name} is currently ranked ${player.position} in the TX Cup with ${player.totalScore} points.`
      };
    }

    // Get top N players (default to all if not specified)
    const topN = params?.topN || standings.length;
    const topPlayers = standings.slice(0, topN);

    const formattedStandings = topPlayers
      .map((player, index) => `${index + 1}. ${player.name} - ${player.totalScore} points`)
      .join('\n');

    return {
      message: `Current TX Cup Standings (Top ${topN}):\n${formattedStandings}`
    };
  }
}; 