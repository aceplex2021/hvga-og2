import { ToolDefinition } from '../types/tool';

interface TXCupStanding {
  position: number;
  name: string;
  totalScore: number;
}

async function getTxCupStandings(): Promise<TXCupStanding[]> {
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
    
    if (!data.standings) {
      console.warn('No standings found in response data');
      return [];
    }

    // Filter out entries with null totalScore
    const validStandings = data.standings.filter(
      (standing: TXCupStanding) => standing.totalScore !== null
    );

    return validStandings;
  } catch (error) {
    console.error('Error fetching TX Cup standings:', error);
    return [];
  }
}

export const getTxCupStandingsTool: ToolDefinition = {
  name: 'get_tx_cup_standings',
  description: 'Fetches the current TX Cup standings from the HVGA database',
  parameters: {
    type: 'object',
    properties: {
      topN: {
        type: 'number',
        description: 'Number of top players to return'
      }
    },
    required: []
  },
  handler: async (params) => {
    console.log('TX Cup standings tool called with params:', params);
    const standings = await getTxCupStandings();
    console.log('Received standings:', standings);
    
    if (standings.length === 0) {
      return {
        message: "I don't have access to real-time data or updates on the current standings for the TX Cup. For the latest updates, please refer to the HVGA official website or contact Jesse Nguyen, the TX Cup Captain."
      };
    }

    // Get top N players (default to 3 if not specified)
    const topN = params?.topN || 3;
    const topPlayers = standings.slice(0, topN);

    const formattedStandings = topPlayers
      .map((player, index) => `${index + 1}. ${player.name} - ${player.totalScore} points`)
      .join('\n');

    return {
      message: `Current TX Cup Standings (Top ${topN}):\n${formattedStandings}`
    };
  }
}; 