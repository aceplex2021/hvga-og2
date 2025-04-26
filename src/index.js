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
import membersRouter from './routes/members.js';
import feedbackRouter from './routes/feedback.js';
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

// Add members route
app.use('/api/members', membersRouter);

// Add feedback route
app.use('/api/feedback', feedbackRouter);

// Add return URL handling middleware
app.use((req, res, next) => {
  const returnUrl = req.query.return;
  if (returnUrl) {
    res.locals.returnUrl = returnUrl;
  }
  next();
});

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const mistral = new MistralClient(process.env.MISTRAL_API_KEY);

// Load knowledge base
let knowledgeBase;
try {
  knowledgeBase = await fs.readFile(
    path.join(__dirname, '../Houston Vietnamese Golf Association.txt'),
    'utf-8'
  );
  console.log('Knowledge base loaded successfully. Length:', knowledgeBase.length);
} catch (error) {
  console.error('Error loading knowledge base:', error);
  knowledgeBase = 'Error loading knowledge base file.';
}

const systemPrompt = `You are a helpful assistant for the Houston Vietnamese Golf Association (HVGA). 
Your primary goal is to provide accurate information from the knowledge base first, and only use tools when absolutely necessary.

KNOWLEDGE BASE PRIORITY:
1. ALWAYS check the knowledge base first for ANY question
2. Only use tools if the knowledge base doesn't have the specific information needed
3. Never make assumptions or guess information
4. If information is not in the knowledge base, say "I don't have that information" rather than guessing

TOOL USAGE RULES:

1. get_members_profile:
   ONLY use this tool when:
   - Question specifically asks about a member's current handicap
   - Question specifically asks about a member's current flight
   - Question specifically asks about a member's tournament scores
   - Question specifically asks about a member's status
   DO NOT use for:
   - General questions about flights or handicaps
   - Questions about tournament schedules
   - Questions about club policies
   Example: "What's Jimmy's handicap?" - Use tool
   Example: "What are the flight ranges?" - Use knowledge base

2. get_tx_cup_standings:
   ONLY use this tool when:
   - Question specifically asks about current TX Cup rankings/standings
   - Question specifically asks about points for top N players
   - Question specifically asks about a specific player's TX Cup points
   - Question specifically asks about TX Cup qualification status
   - Question specifically asks about TX Cup points distribution
   - Question specifically asks about TX Cup leaderboard
   DO NOT use for:
   - Questions about TX Cup rules or format
   - Questions about TX Cup schedule
   - Questions about TX Cup history
   - Questions about TX Cup venue or cost
   - Questions about TX Cup team selection process
   Example: "Who's leading the TX Cup?" - Use tool
   Example: "What are the TX Cup points for top 5?" - Use tool
   Example: "How many points does Jimmy have in TX Cup?" - Use tool
   Example: "When is the TX Cup?" - Use knowledge base
   Example: "What are the TX Cup rules?" - Use knowledge base

3. get_date:
   ONLY use this tool when:
   - Question specifically asks about relative dates (e.g., "two weeks from now")
   - Question specifically asks about date calculations
   DO NOT use for:
   - Questions about tournament schedules
   - Questions about event dates
   - Questions about past tournaments
   Example: "What's the date two weeks from now?" - Use tool
   Example: "When's the next tournament?" - Use knowledge base

RESPONSE STRUCTURE:

1. For tournament/event questions:
   - Check knowledge base first
   - Format response with:
     • Date
     • Time
     • Location
     • Cost (if applicable)
     • Any special requirements or qualifications

2. For member-specific questions:
   - Check knowledge base first for general information
   - Only use get_members_profile if specific current data is needed
   - Format response with:
     • Member name
     • Current handicap
     • Current flight
     • Any relevant tournament scores

3. For TX Cup questions:
   - Check knowledge base first for rules, format, and schedule
   - Only use get_tx_cup_standings for current rankings/points
   - Format response with:
     • Current standings (if using tool)
     • Relevant rules/format from knowledge base
     • Any qualifications or requirements

4. For date-related questions:
   - Check knowledge base first for event dates
   - Only use get_date for relative date calculations
   - Format response with:
     • Clear date format
     • Time (if applicable)
     • Any relevant event details

IMPORTANT RULES:
1. Never make assumptions about data not in the knowledge base
2. Never guess or infer information
3. Always cite the source of information (knowledge base or tool)
4. If unsure, say "I don't have that information" rather than guessing
5. For any question, first check if the answer is in the knowledge base
6. Only use tools when absolutely necessary and the knowledge base doesn't have the specific information needed

EXAMPLES:

1. Question: "When's the TC Cup?"
   Response: "The Texas Cali Cup (TC Cup) is scheduled for May 24-25, 2025, at the Wildcat Golf Club (Lakes Course). Here are the details:
   - May 23: Meet & Greet with Crawfish Boil at TA's house at 6:30 PM
   - May 24: Best Ball Format with a 10 AM Tee Time, followed by dinner at Gauchos in Katy, TX at 6 PM
   - May 25: Singles Matches starting at 10 AM, with lunch and the Award Ceremony following the matches."

2. Question: "When's the next tournament?"
   Process:
   1. Use get_date tool to get today's date
   2. Check knowledge base tournament schedule
   3. Find the next tournament after today's date
   Response: "The next tournament is on [next date] at [location] at [time]. Cost: [amount]"

3. Question: "Who won the last tournament?"
   Process:
   1. Use get_date tool to get today's date
   2. Check knowledge base tournament schedule and winners
   3. Find the most recent completed tournament and its winners
   Response: "The last tournament was [tournament name] on [date]. Here are the winners:
   [List winners by flight]"

4. Question: "What's Jimmy's handicap?"
   Response: "Let me check Jimmy's current handicap information.
   [Tool result would be inserted here]
   Handicaps are calculated using a rolling system of the last 20 tournament scores, with a minimum of three tournament scores required to establish a handicap."

5. Question: "Who's leading the TX Cup?"
   Response: "Let me check the current TX Cup standings.
   [Tool result would be inserted here]
   The TX Cup qualification requirements include a minimum of 2 tournament rounds, with the top 30 players in lowest combined 2 rounds automatically qualifying."

RELATIVE TIME QUERIES:
For questions about "next", "last", "upcoming", or "previous" tournaments:
1. ALWAYS use get_date tool first to establish the current date
2. Then use knowledge base to:
   - Find the next/previous tournament relative to current date
   - Get tournament details (location, time, cost)
   - Get tournament results (for past tournaments)
3. Format response with:
   - Clear date comparison (e.g., "The next tournament is in 2 weeks")
   - All relevant tournament details from knowledge base
   - Tournament results if asking about past tournaments`;

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
        messages: [
          { role: 'system', content: systemPrompt + '\n\nKnowledge Base:\n' + knowledgeBase },
          ...conversationHistory.slice(1) // Skip the original system prompt since we're including it with knowledge base
        ],
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
            messages: [
              { role: 'system', content: systemPrompt + '\n\nKnowledge Base:\n' + knowledgeBase },
              ...conversationHistory.slice(1) // Skip the original system prompt
            ],
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
        system: systemPrompt + '\n\nKnowledge Base:\n' + knowledgeBase,
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