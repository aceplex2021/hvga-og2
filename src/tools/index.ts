import { ToolDefinition } from '../types/tool';
import { getTxCupStandingsTool } from './getTxCupStandings';
import { getMembersProfile } from './getMembersProfile';

export const tools: ToolDefinition[] = [
  getTxCupStandingsTool,
  getMembersProfile
]; 