import fetch from 'node-fetch';
import { ToolDefinition } from '../types/tool';

interface MemberProfile {
  name: string;
  status: 'active' | 'inactive' | 'pending';
  flight: string;
  handicap: number;
  memberSince: string;
}

async function getMemberProfile(memberName: string): Promise<MemberProfile | null> {
  try {
    const url = process.env.MEMBER_PROFILE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!url || !anonKey) {
      console.error('Missing required environment variables');
      return null;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: memberName })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch member profile: ${response.status}`);
    }

    const data = await response.json();
    return data.profile || null;
  } catch (error) {
    console.error('Error fetching member profile:', error);
    return null;
  }
}

export const getMembersProfileTool: ToolDefinition = {
  name: 'get_members_profile',
  description: 'Use this tool ONLY for questions about a specific member\'s current status, flight, or handicap. DO NOT use for questions about membership rules, fees, or general policies.',
  parameters: {
    type: 'object',
    properties: {
      memberName: {
        type: 'string',
        description: 'Full name of the member to look up'
      }
    },
    required: ['memberName']
  },
  handler: async (params) => {
    console.log('Member profile tool called with params:', params);
    
    if (!params?.memberName) {
      return {
        message: "Please provide a member's name to look up their profile."
      };
    }

    const profile = await getMemberProfile(params.memberName);
    
    if (!profile) {
      return {
        message: `I couldn't find a profile for ${params.memberName}. Please verify the name and try again.`
      };
    }

    const statusMessage = profile.status === 'active' 
      ? 'is an active member'
      : profile.status === 'pending'
      ? 'has a pending membership'
      : 'is not currently an active member';

    return {
      message: `${profile.name} ${statusMessage} of HVGA.\n` +
               `Flight: ${profile.flight}\n` +
               `Current Handicap: ${profile.handicap}\n` +
               `Member Since: ${new Date(profile.memberSince).toLocaleDateString()}`
    };
  }
}; 