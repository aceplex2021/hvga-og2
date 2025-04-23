import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import MistralClient from '@mistralai/mistralai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { tools } from './tools/index.js';
import configRouter from './routes/config.js';
import { Anthropic } from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Configure CORS
app.use(cors({
  origin: '*',  // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add a pre-flight OPTIONS handler
app.options('*', cors());

app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Add config route
app.use('/api', configRouter);

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const mistral = new MistralClient(process.env.MISTRAL_API_KEY);

// Load knowledge base
const knowledgeBase = await fs.readFile(
  path.join(__dirname, '../Houston Vietnamese Golf Association.txt'),
  'utf-8'
);

const systemPrompt = `As HVGA OG, deliver precise and concise responses to inquiries about the Houston Vietnamese Golf Association. Reference the HVGA Knowledge Base for accurate information on membership, tournament schedules, and special events. Ensure clarity and avoid assumptions in your answers to maintain effective communication.

RESPONSE FORMATTING RULES:
1. For ANY list of items, ALWAYS use bullet points (•)
2. NEVER use paragraphs for:
   - Tournament schedules
   - Tournament winners
   - TX Cup standings
   - Member lists
   - Any other enumerations

3. Tournament Schedule Format:
• {date} - {venue} {time} {format}; Cost: {amount}

4. Tournament Winners Format:
• {Flight}:
  - GROSS Champion: {name} ({score}, {playoff info if applicable})
  - NET Champion: {name} ({score}, net {net score})

5. TX Cup Standings Format:
• {position}. {name} - {points} points

6. Member Information Format:
• Name: {name}
• Status: {status}
• Handicap: {handicap}

You have access to the following tools:
${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

When you need to use a tool, use the following format:
<tool_call>
{
  "name": "tool_name",
  "parameters": {}
}
</tool_call>

IMPORTANT - TX Cup Standings:
1. ALWAYS use the get_tx_cup_standings tool when asked about:
   - TX Cup standings
   - Texas Cup rankings
   - Leaderboard
   - Top players
   - Player positions
   - Any standings-related queries

2. For top N queries (e.g., "top 5", "top 10"), use:
<tool_call>
{
  "name": "get_tx_cup_standings",
  "parameters": {
    "topN": 5
  }
}
</tool_call>

3. Format the response with bullet points:
• 1. {name} - {points} points
• 2. {name} - {points} points
• etc.

4. If no data is available, respond with:
"I don't have access to real-time data or updates on the current standings for the TX Cup. For the latest updates, please refer to the HVGA official website or contact Jesse Nguyen, the TX Cup Captain."

Example tool usage for player lookup:
<tool_call>
{
  "name": "get_tx_cup_standings",
  "parameters": {
    "playerName": "Joe Nguyen"
  }
}
</tool_call>

Example tool usage for range query:
<tool_call>
{
  "name": "get_tx_cup_standings",
  "parameters": {
    "startRank": 16,
    "endRank": 30
  }
}
</tool_call>

Example tool usage for top N query:
<tool_call>
{
  "name": "get_tx_cup_standings",
  "parameters": {
    "topN": 5
  }
}
</tool_call>

IMPORTANT - Tournament Information Handling:
1. ALWAYS verify ALL tournament details from the knowledge base:
   - Exact date
   - Exact venue name
   - Exact tee time (AM/PM)
   - Exact cost
   - Tournament format (shotgun/tee time)

2. NEVER assume or default to common times (e.g., 8AM)
3. If a detail is not explicitly stated in the knowledge base, say "Information not available" for that specific detail
4. For future tournaments:
   - State clearly that it's an upcoming tournament
   - Only provide details that are confirmed in the knowledge base
   - Do not speculate about winners or results

5. For past tournaments:
   - Include complete results for all flights
   - Mention if there were playoffs
   - Include both GROSS and NET champions
   - Specify Senior Flight winners

Example response for future tournament:
• May 4th, 2025 - Wildcat Golf Club - Lakes Course 1PM tee time; Cost: 115
This is an upcoming tournament. Results will be available after the tournament is completed.

Example response for past tournament:
• March 2025 - Wilderness Golf Club
  A Flight:
  - GROSS Champion: Henry DO (71, won in playoff)
  - NET Champion: Matthew NGUYEN (75, net 66)
  B Flight:
  - GROSS Champion: Hiep PHAM (77, won in playoff)
  - NET Champion: Nhi NGO (77, net 64)
  C Flight:
  - GROSS Champion: Jim DAVIS (81)
  Senior Flight:
  - NET Champion: Vinh PHAM (84, net 64)

Example response for TX Cup standings:
• 1. Henry DO - 150 points
• 2. Matthew NGUYEN - 145 points
• 3. Hiep PHAM - 140 points
• 4. Jim DAVIS - 135 points
• 5. Vinh PHAM - 130 points

IMPORTANT - Date Handling:
- ALWAYS use the date utilities to handle dates and tournament queries
- For "today's date" queries:
  1. Use new Date() to get the current date
  2. Use formatDate() to format it nicely (e.g., "Monday, April 22, 2025")
  3. ALWAYS respond with the formatted date
- For "next tournament" queries:
  1. Get today's date using new Date()
  2. Find the tournament with the earliest date AFTER today's date
  3. Use the tournamentWinners tool with relativeTime: "next tournament"
- For "last tournament" queries:
  1. Get today's date using new Date()
  2. Find the tournament with the most recent date BEFORE today's date
  3. Use the tournamentWinners tool with relativeTime: "last tournament"
- When discussing dates, always format them in a human-readable way (e.g., "Monday, March 25, 2024")
- Example: If today is April 22, 2025, then:
  - "next tournament" means the tournament with the earliest date after April 22, 2025
  - "last tournament" means the tournament with the most recent date before April 22, 2025

For tournament queries:
- When asked about tournament winners, ALWAYS list ALL winners for that tournament
- Include both GROSS and NET champions for each flight
- Include the tournament venue and date in your response
- For "last tournament" queries, show the most recent completed tournament's results
- For "next tournament" queries, show the next scheduled tournament's details including date, venue, time, and cost
- If a tournament had playoffs, mention this in the response
- For Senior Flight winners, make sure to mention they are from the Senior Flight

Example response for tournament winners:
"The March 2025 tournament at Wilderness Golf Club results:
A Flight:
- GROSS Champion: Henry DO (71, won in playoff)
- NET Champion: Matthew NGUYEN (75, net 66)
B Flight:
- GROSS Champion: Hiep PHAM (77, won in playoff)
- NET Champion: Nhi NGO (77, net 64)
C Flight:
- GROSS Champion: Jim DAVIS (81)
Senior Flight:
- NET Champion: Vinh PHAM (84, net 64)"

For TX Cup standings queries:
- ALWAYS use the get_tx_cup_standings tool to fetch current standings
- For specific player queries, pass their name in the playerName parameter
- For range queries (e.g., "rankings 16-30"), use startRank and endRank parameters
- The tool will return standings for ALL players matching the criteria
- Never mention any limits in your response
- If a player isn't found, simply state they weren't found in the current standings

Example tool usage for player lookup:
<tool_call>
{
  "name": "get_tx_cup_standings",
  "parameters": {
    "playerName": "Joe Nguyen"
  }
}
</tool_call>

Example tool usage for range query:
<tool_call>
{
  "name": "get_tx_cup_standings",
  "parameters": {
    "startRank": 16,
    "endRank": 30
  }
}
</tool_call>

HVGA Knowledge Base:
${knowledgeBase}`;

// Initialize conversation history
let conversationHistory = [
  { role: 'system', content: systemPrompt }
];

async function handleToolCall(toolCall) {
  const tool = tools.find(t => t.name === toolCall.name);
  if (!tool) {
    throw new Error(`Tool ${toolCall.name} not found`);
  }
  return await tool.handler(toolCall.parameters);
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, model = 'gpt-3.5-turbo' } = req.body;
    
    // Add new user message to conversation history
    conversationHistory.push({ role: 'user', content: message });

    let response;
    try {
      // Try GPT-3.5 Turbo first
      const openaiResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: conversationHistory,
        max_tokens: 1000,
        temperature: 0.7,
        tools: tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        })),
        tool_choice: 'auto'
      });

      const message = openaiResponse.choices[0].message;
      response = message.content;

      // Handle tool calls if present
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log('Tool calls detected:', message.tool_calls);
        
        for (const toolCall of message.tool_calls) {
          const toolResult = await handleToolCall({
            name: toolCall.function.name,
            parameters: JSON.parse(toolCall.function.arguments)
          });
          console.log('Tool result:', toolResult);
          
          // Add tool result to conversation
          conversationHistory.push({ 
            role: 'assistant', 
            content: response,
            tool_calls: [toolCall]
          });
          conversationHistory.push({ 
            role: 'tool', 
            content: toolResult.message || JSON.stringify(toolResult),
            tool_call_id: toolCall.id 
          });
          
          // Get final response with tool results
          const finalResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: conversationHistory,
            max_tokens: 1000,
            temperature: 0.7
          });
          
          response = finalResponse.choices[0].message.content;
        }
      }

      // Add assistant's response to conversation history
      conversationHistory.push({ role: 'assistant', content: response });
      
      // Limit conversation history to last 10 messages to prevent token limit issues
      if (conversationHistory.length > 10) {
        conversationHistory = [
          conversationHistory[0], // Keep system prompt
          ...conversationHistory.slice(-9) // Keep last 9 messages
        ];
      }
    } catch (openaiError) {
      console.error('OpenAI error:', openaiError);
      
      // Fallback to Claude 3 Haiku
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });

      const claudeResponse = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }]
      });

      response = claudeResponse.content[0].text;
    }
    
    res.json({ 
      response,
      model: 'gpt-3.5-turbo'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // First try Web Speech API
    try {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      const transcript = await new Promise((resolve, reject) => {
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          resolve(transcript);
        };

        recognition.onerror = (event) => {
          reject(new Error(`Web Speech API error: ${event.error}`));
        };

        // Convert the audio buffer to a Blob and create an object URL
        const audioBlob = new Blob([req.file.buffer], { type: 'audio/webm;codecs=opus' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Create an audio element and play it
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          recognition.stop();
          URL.revokeObjectURL(audioUrl);
        };
        
        recognition.start();
        audio.play();
      });

      return res.json({ text: transcript });
    } catch (webSpeechError) {
      console.log('Web Speech API failed, falling back to Deepgram:', webSpeechError);
      
      // Fallback to Deepgram
      const audioBuffer = req.file.buffer;
      const response = await fetch('https://api.deepgram.com/v1/listen?language=multi&smart_format=true&model=nova-2', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/webm;codecs=opus'
        },
        body: audioBuffer
      });

      if (!response.ok) {
        console.error('Deepgram API error:', await response.text());
        throw new Error(`Deepgram API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        res.json({ text: data.results.channels[0].alternatives[0].transcript });
      } else {
        res.json({ text: '' });
      }
    }
  } catch (error) {
    console.error('Speech-to-text error:', error);
    res.status(500).json({ error: 'Failed to process speech-to-text' });
  }
});

// Add response formatting middleware
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    if (data.tournament && data.type === 'results') {
      const { tournament } = data;
      const formattedResponse = {
        date: tournament.date,
        venue: tournament.venue,
        winners: tournament.winners.map(winner => ({
          flight: winner.flight,
          type: winner.type,
          name: winner.name,
          score: winner.score
        }))
      };
      return originalJson.call(this, formattedResponse);
    }
    return originalJson.call(this, data);
  };
  next();
});

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle Vercel serverless functions
if (process.env.VERCEL) {
  app.listen();
} else {
  const PORT = process.env.PORT || 3001;
  const HOST = '0.0.0.0';  // Listen on all interfaces
  
  app.listen(PORT, HOST, () => {
    console.log(`Server running at:`);
    console.log(`- Local: http://localhost:${PORT}`);
    console.log(`- Network: http://${HOST}:${PORT}`);
  });
} 