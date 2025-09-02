"""FastAPI server for the Math Teacher Agent."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from copilotkit.integrations.fastapi import add_fastapi_endpoint
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAgent
from agent import math_teacher_graph
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Math Teacher AI",
    description="An AI-powered math teacher for basic arithmetic operations",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the CopilotKit Remote Endpoint
sdk = CopilotKitRemoteEndpoint(
    agents=[
        LangGraphAgent(
            name="math_teacher",
            description="A patient and encouraging math teacher that helps students learn addition, subtraction, multiplication, and division through interactive conversations and visual aids.",
            graph=math_teacher_graph,
        )
    ]
)

# Add the CopilotKit endpoint to FastAPI
add_fastapi_endpoint(app, sdk, "/copilotkit")

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "message": "Math Teacher AI Server is running!",
        "agent": "math_teacher",
        "operations": ["addition", "subtraction", "multiplication", "division"]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "service": "math_teacher_ai"}


def main():
    """Run the FastAPI server."""
    import uvicorn
    
    # Check for required environment variables
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️  Warning: OPENAI_API_KEY not found in environment variables")
        print("Please create a .env file with your OpenAI API key")
        print("Example: OPENAI_API_KEY=your_api_key_here")
    else:
        print("✅ OPENAI_API_KEY found in environment")
    
    print("🚀 Starting Math Teacher AI Server...")
    print("📚 Available at: http://localhost:8001")
    print("🔗 CopilotKit endpoint: http://localhost:8001/copilotkit")
    print("💡 Health check: http://localhost:8001/health")
    print("🐛 Debug mode: Enabled (detailed logging active)")
    
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )


if __name__ == "__main__":
    main()