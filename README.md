# HVGA InfoBot (OG2)

A simple chatbot for the Houston Vietnamese Golf Association that provides information about membership, tournaments, and special events.

## Features

- Answers questions about HVGA using OpenAI or Groq
- Concise responses (50 words max)
- Simple web interface
- Support for both OpenAI and Groq models

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
- Copy `.env` file and update with your API keys:
  - `OPENAI_API_KEY`: Your OpenAI API key
  - `GROQ_API_KEY`: Your Groq API key

3. Start the server:
```bash
npm start
```

4. Open the web interface:
- Navigate to `http://localhost:3001` in your browser

## Usage

1. Select your preferred model (OpenAI or Groq) from the dropdown
2. Type your question in the input field
3. Press Enter or click Send
4. View the response in the chat window

## API Endpoints

### POST /api/chat
Request body:
```json
{
  "message": "Your question here",
  "model": "openai" // or "groq"
}
```

Response:
```json
{
  "response": "Bot response here",
  "model": "openai" // or "groq"
}
``` 