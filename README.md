# 🧮 Math Teacher AI

An interactive AI-powered math teacher that helps students learn addition, subtraction, multiplication, and division through conversational chat and interactive UI components.

## Features

- 💬 **Interactive Chat**: Natural conversation with an AI math teacher
- 📏 **Number Line Visualization**: Visual learning for addition and subtraction
- 🧮 **Visual Calculator**: Student-friendly calculator with large buttons
- 📝 **Practice Problems**: Interactive problem-solving exercises
- 🎯 **Real-time Feedback**: Immediate validation and encouragement
- 🔄 **Adaptive Teaching**: Teacher responds to student needs and questions

## Project Structure

```
mathteacher-ai/
├── agent/                  # Python backend (LangGraph + FastAPI)
│   ├── requirements.txt    # Python dependencies
│   ├── agent.py           # LangGraph math teacher workflow
│   ├── tools.py           # Calculator tool implementation
│   ├── server.py          # FastAPI server with CopilotKit
│   └── .env.example       # Environment variables template
└── ui/                    # Next.js frontend
    ├── package.json       # Node dependencies
    ├── src/
    │   ├── app/           # Next.js app router
    │   └── components/    # Interactive math components
    └── README.md
```

## Setup Instructions

### Prerequisites

- Python 3.12+
- Node.js 18+
- OpenAI API key

### 1. Backend Setup (Agent)

```bash
cd agent

# Create virtual environment
python -m venv venv
source venv/bin/activate  

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 2. Frontend Setup (UI)

```bash
cd ui

# Install dependencies
npm install
```

### 3. Running the Application

#### Start the Backend Server
```bash
cd agent
source venv/bin/activate
python server.py
```

The backend will be available at:
- API: http://localhost:8001
- Health check: http://localhost:8001/health
- CopilotKit endpoint: http://localhost:8001/copilotkit

#### Start the Frontend
```bash
cd ui
npm run dev
```

The frontend will be available at: http://localhost:3000

## Usage

1. Open http://localhost:3000 in your browser
2. The chat sidebar will open automatically on the right


