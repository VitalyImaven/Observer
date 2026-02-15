# Observer — Meeting AI Assistant

Real-time AI assistant for venture capital meetings. Observer listens to your conversations and provides instant answers to investor questions.

## Features

- **Live AI Mode** — Listens to the meeting, detects investor questions, and generates streaming answers in real-time using GPT
- **Q&A Match Mode** — Matches investor questions against your pre-prepared answers for instant, polished responses
- **Directives** — Create and switch between different AI instruction sets (e.g., "Confident & Concise", "Focus on Market Size")
- **Knowledge Base** — Upload pitch decks, business plans, and documents so the AI can reference your actual data
- **Streaming Responses** — Answers appear word-by-word like ChatGPT, so you can start reading immediately
- **Fully Responsive** — Works split-screen alongside Zoom/Teams/Meet

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Installation

```bash
npm install
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration

1. Go to **Settings** in the sidebar
2. Enter your OpenAI API key
3. Choose your preferred models
4. Save

## How to Use

### Before the Meeting
1. **Upload documents** — Go to Knowledge Base, upload your pitch deck, business plan, financials
2. **Create directives** — Go to Directives, create instruction sets for different meeting contexts
3. **Prepare Q&A** — Go to Q&A Bank, add common investor questions with your best answers

### During the Meeting
1. Open Observer in half your screen, Zoom/Teams in the other half
2. Select your directive and mode (Live AI or Q&A Match)
3. Click **Start Listening**
4. When the investor asks a question, Observer will:
   - In **Live AI mode**: Generate a streaming answer using your knowledge base and directive
   - In **Q&A Match mode**: Find the closest pre-prepared answer from your Q&A bank

## Tech Stack

- **Next.js 15** — React framework with App Router
- **TypeScript** — Type safety
- **Tailwind CSS v4** — Styling
- **OpenAI API** — GPT for answers, transcription for speech-to-text, embeddings for Q&A matching
