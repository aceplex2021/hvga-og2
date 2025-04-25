import { createClient } from '@supabase/supabase-js';

export const getMembersProfileTool = {
  name: 'get_members_profile',
  description: 'Get member profile information including handicap, flight, and status',
  parameters: {
    type: 'object',
    properties: {
      memberName: {
        type: 'string',
        description: 'The name of the member to look up (can be partial name)'
      }
    },
    required: ['memberName']
  },
  handler: async (parameters) => {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );

      if (!parameters.memberName) {
        return "Please specify a member's name to look up their profile.";
      }

      // Clean up the name and try to find matches
      const searchName = parameters.memberName.trim().toLowerCase();
      
      // Get all matching members
      const { data: matches, error } = await supabase
        .from('members')
        .select('name, handicap_index, flight, current_status, is_senior, tournament_scores')
        .ilike('name', `%${searchName}%`)
        .order('name');

      if (error) throw error;

      if (!matches || matches.length === 0) {
        return `I couldn't find any members matching "${searchName}".`;
      }

      // If we have multiple matches, return information for all of them
      return matches.map(member => {
        const recentScores = member.tournament_scores 
          ? member.tournament_scores
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, 3)
              .map(score => `  - ${score.date}: ${score.score} (${score.tournament_name || 'Unknown Tournament'})`)
              .join('\n')
          : '  No recent tournament scores';

        return `• Name: ${member.name}
• Status: ${member.current_status || 'Not specified'}
• Handicap: ${member.handicap_index || 'Not specified'}
• Flight: ${member.flight || 'Not specified'}
• Senior: ${member.is_senior ? 'Yes' : 'No'}
• Recent Tournament Scores:
${recentScores}`;
      }).join('\n\n');
    } catch (error) {
      console.error('Error fetching members:', error);
      return "I'm sorry, I couldn't retrieve the member information at this time.";
    }
  }
}; 