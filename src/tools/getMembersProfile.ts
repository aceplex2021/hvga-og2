import fetch from 'node-fetch';
import { ToolDefinition } from '../types/tool';

interface MemberProfile {
  id: string;
  name: string;
  currentStatus: 'M' | 'NVM' | 'inactive';
  isSenior: boolean;
  handicap: number;
  flight: string;
  tournamentScores: Array<{
    date: string;
    score: number;
    tournamentName: string;
  }>;
  totalRounds: number;
}

interface MembersResponse {
  members: MemberProfile[];
}

export const getMembersProfile: ToolDefinition = {
  name: 'get_members_profile',
  description: 'Get member profiles including their tournament scores and statistics',
  parameters: {
    type: 'object',
    properties: {
      memberName: {
        type: 'string',
        description: 'Name of the member to look up (optional)'
      }
    },
    required: []
  },
  handler: async (params: { memberName?: string }): Promise<{ message: string }> => {
    try {
      const response = await fetch('https://kddbyrxuvtqgumvndphi.supabase.co/functions/v1/members-profile', {
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: MembersResponse = await response.json();

      if (params.memberName) {
        // Search for specific member
        const member = data.members.find(m => 
          m.name.toLowerCase().includes(params.memberName!.toLowerCase())
        );

        if (!member) {
          return { message: `No member found with name containing "${params.memberName}"` };
        }

        return {
          message: formatMemberProfile(member)
        };
      }

      // Return all members if no specific name provided
      return {
        message: data.members.map(formatMemberProfile).join('\n\n')
      };
    } catch (error) {
      console.error('Error fetching members:', error);
      return { message: 'Failed to fetch members data' };
    }
  }
};

function formatMemberProfile(member: MemberProfile): string {
  const status = member.currentStatus === 'M' ? 'Member' :
                 member.currentStatus === 'NVM' ? 'Non-Voting Member' :
                 'Inactive';

  const scores = member.tournamentScores
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5) // Show last 5 scores
    .map(score => `• ${score.tournamentName} (${score.date}): ${score.score}`)
    .join('\n');

  return `• Name: ${member.name}
• Status: ${status}
• Division: ${member.isSenior ? 'Senior' : 'Regular'}
• Handicap: ${member.handicap || 'N/A'}
• Flight: ${member.flight || 'N/A'}
• Total Rounds: ${member.totalRounds}
Recent Scores:
${scores}`;
} 