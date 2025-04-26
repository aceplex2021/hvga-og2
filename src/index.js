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
You have access to the following tools and knowledge base:

KNOWLEDGE BASE:
${knowledgeBase}

TOOLS:
1. get_members_profile: Use this tool to get information about HVGA members.
   - When a user asks about a member's handicap, scores, or any member-specific information
   - When a user asks about tournament scores for a specific member
   - When a user asks about a member's flight or status
   - Extract the member's name from the query (e.g., "Jimmy" from "what did Jimmy shoot in March")
   - The tool will return information for all matching members
   - Format the response with bullet points for each member's information
   - If no member is found, inform the user politely

2. get_tx_cup_standings: Use this tool to get Texas Cup standings information.
   - When a user asks about overall Texas Cup standings
   - When a user asks about flight leaders
   - When a user asks about tournament results for the Texas Cup
   - Format the response with clear sections for each flight

3. get_date: Use this tool to handle date-related queries.
   - When a user asks about relative dates (e.g., "two weeks from now")
   - When a user asks about date calculations
   - DO NOT use this tool for tournament schedule questions - use the knowledge base instead

RESPONSE GUIDELINES:
1. For questions about HVGA policies, rules, or general information:
   - First check the knowledge base
   - If the information is in the knowledge base, use it directly
   - If not, say you don't have that information

2. For questions about tournament schedule:
   - ALWAYS use the knowledge base first
   - The tournament schedule is in the knowledge base under "Tournament Schedule"
   - Do not use the get_date tool for these questions
   - Example: For "when's the next tournament", look at the tournament schedule in the knowledge base
   - Format the response with the date, time, location, and cost

3. For questions about members or tournament results:
   - Use the appropriate tool to get the information
   - Combine the tool results with knowledge base context
   - Format the response clearly with bullet points and sections

4. For date-related questions (not about tournament schedule):
   - Use the get_date tool to handle the date logic
   - Provide clear, formatted dates and times

5. Always:
   - Format responses with bullet points and clear sections
   - Do not make assumptions about data not provided
   - If you're unsure about something, say so rather than guessing
   - When using tool results, explain what you found
   - When using knowledge base information, cite the relevant section

EXAMPLES:
1. For "when's the next tournament":
   - Check the tournament schedule in the knowledge base
   - Respond with: "The next tournament is on [date] at [location] at [time]. Cost: [amount]"

2. For "what are the membership fees":
   - Check the membership section in the knowledge base
   - Respond with the exact fees listed

3. For "what's my handicap":
   - Use the get_members_profile tool
   - Include relevant handicap information from the knowledge base`;

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