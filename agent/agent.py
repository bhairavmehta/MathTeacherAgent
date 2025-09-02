"""
Simplified Math Teacher Agent using LangGraph.
"""

import json
import re
import os
from datetime import datetime
from typing import Annotated, TypedDict, Dict, List, Any, Optional
from enum import Enum

# LangGraph imports
from langgraph.graph.message import add_messages, AnyMessage
from langgraph.graph import START, END, StateGraph
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import AIMessage, HumanMessage, BaseMessage
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class MathOperation(str, Enum):
    """Math operations the teacher can help with."""
    ADDITION = "addition"
    SUBTRACTION = "subtraction"
    MULTIPLICATION = "multiplication"
    DIVISION = "division"


class InteractionType(str, Enum):
    """Types of learning interactions."""
    EXPLANATION = "explanation"
    VISUAL = "visual"
    PRACTICE = "practice"


class MathTeachingState(TypedDict):
    """Simplified state for the math teaching agent."""
    messages: Annotated[list[AnyMessage], add_messages]
    current_topic: Optional[str]
    current_operation: Optional[str]
    last_problem: Optional[str]
    student_answer: Optional[int]
    correct_answer: Optional[int]
    interaction_type: Optional[str]
    feedback: Optional[str]
    # New fields for tool interaction tracking
    last_tool_call: Optional[str]
    tool_in_progress: Optional[bool]
    completed_interactions: List[Dict[str, Any]]
    pending_feedback: Optional[str]
    # Demo interruption support
    demo_in_progress: Optional[bool]
    demo_paused: Optional[bool]
    demo_context: Optional[Dict[str, Any]]
    interruption_query: Optional[str]

class GraphInput(BaseModel):
    """Input schema for the LangGraph agent."""
    messages: list[BaseMessage] = Field(description="List of messages in the conversation")

class GraphOutput(BaseModel):
    """Output schema for the LangGraph agent."""
    messages: list[BaseMessage] = Field(description="Updated list of messages after processing")


def calculate_expression(expression: str) -> float:
    """Helper function to calculate mathematical expressions with enhanced validation."""
    from validators import InputSanitizer
    
    try:
        # Use centralized sanitization
        sanitizer = InputSanitizer()
        clean_expression = sanitizer.sanitize_math_expression(expression)
        
        print(f"DEBUG: - Original expression: {expression}")
        print(f"DEBUG: - Sanitized expression: {clean_expression}")
        
        # Evaluate safely
        result = eval(clean_expression)
        return float(result)
        
    except Exception as e:
        print(f"DEBUG: - Calculation error: {str(e)}")
        raise ValueError(f"Error calculating {expression}: {str(e)}")


def is_tool_response(message) -> bool:
    """Detect if a message is a response from a frontend tool completion."""
    from validators import validate_tool_response
    
    print(f"DEBUG: is_tool_response() checking message:")
    print(f"DEBUG: - Message type: {type(message)}")
    print(f"DEBUG: - Has content: {hasattr(message, 'content')}")
    print(f"DEBUG: - Has additional_kwargs: {hasattr(message, 'additional_kwargs')}")
    
    # Use centralized validation system
    try:
        validation_result = validate_tool_response(message)
        print(f"DEBUG: - Validation result: {validation_result.is_valid}")
        if validation_result.errors:
            print(f"DEBUG: - Validation errors: {validation_result.errors}")
        if validation_result.warnings:
            print(f"DEBUG: - Validation warnings: {validation_result.warnings}")
        
        return validation_result.is_valid
    except Exception as e:
        print(f"DEBUG: - Validation exception: {str(e)}")
        return False


def is_demo_interruption(message, current_state) -> bool:
    """Detect if a user message is interrupting an active demonstration."""
    if not isinstance(message, HumanMessage) or not message.content:
        return False
    
    # Check if demo is in progress
    demo_active = current_state.get("demo_in_progress", False)
    tool_active = current_state.get("tool_in_progress", False)
    last_tool = current_state.get("last_tool_call", "")
    
    if not (demo_active or (tool_active and "demonstrate" in last_tool)):
        return False
    
    content = message.content.lower().strip()
    
    # Demo continuation keywords (should NOT be treated as interruption)
    continuation_keywords = [
        'continue', 'resume', 'next step', 'keep going',
        'proceed', 'go on', 'demo', 'demonstration'
    ]
    
    if any(keyword in content for keyword in continuation_keywords):
        return False
    
    # Question/interruption indicators
    question_indicators = [
        'what', 'how', 'why', 'when', 'where', 'who',
        'can you', 'could you', 'would you', 'will you',
        'explain', 'tell me', 'help me', '?'
    ]
    
    is_question = any(indicator in content for indicator in question_indicators)
    has_question_mark = '?' in content
    starts_with_question = any(content.startswith(word) for word in ['what', 'how', 'why', 'when', 'where', 'who', 'can', 'could', 'would', 'will', 'is', 'are', 'do', 'does'])
    
    return is_question or has_question_mark or starts_with_question


def build_interruption_context(state, user_message) -> Dict[str, Any]:
    """Build comprehensive context for intelligent interruption response."""
    # Safely get state values with null protection
    last_tool_call = state.get("last_tool_call") or ""
    current_topic = state.get("current_topic") or "Unknown"
    last_problem = state.get("last_problem") or "Unknown problem"
    demo_context = state.get("demo_context") or {}
    completed_interactions = state.get("completed_interactions") or []
    messages = state.get("messages") or []
    
    context = {
        "user_question": user_message.content,
        "current_topic": current_topic,
        "last_problem": last_problem,
        "last_tool_call": last_tool_call,
        "demo_context": demo_context,
        "recent_interactions": completed_interactions[-3:],  # Last 3 interactions
        "interruption_timestamp": datetime.now().isoformat(),
        "demo_paused": state.get("demo_paused", False),
        "is_demonstration": "demonstrate" in last_tool_call,
        "conversation_messages": len(messages),
    }
    
    print(f"🔍 [INTERRUPTION CONTEXT] Built context for question: '{user_message.content}'")
    print(f"🔍 [CONTEXT] Topic: {context['current_topic']}, Problem: {context['last_problem']}")
    print(f"🔍 [CONTEXT] Is demo: {context['is_demonstration']}, Recent interactions: {len(context['recent_interactions'])}")
    
    return context


def build_interruption_system_prompt(context: Dict[str, Any]) -> str:
    """Build context-aware system prompt for interruption handling."""
    user_question = context["user_question"]
    current_topic = context["current_topic"] 
    last_problem = context["last_problem"]
    is_demo = context["is_demonstration"]
    
    base_prompt = f"""You are a patient, encouraging math teacher helping a student learn basic arithmetic.

CURRENT SITUATION:
You are {'demonstrating' if is_demo else 'working on'} the problem "{last_problem}" when the student interrupted with a question.

STUDENT'S QUESTION: "{user_question}"

CONTEXT:
- Current learning topic: {current_topic}
- Problem being worked on: {last_problem}
- Demo is {'paused' if is_demo else 'interrupted'} to answer their question
- You will resume the {'demonstration' if is_demo else 'activity'} after answering

YOUR TASK:
1. Provide a helpful, educational answer to their question
2. Keep it concise but thorough (2-4 sentences)
3. Relate the answer to their current learning when relevant
4. Be encouraging and patient
5. After answering, briefly mention that you'll continue the {'demo' if is_demo else 'lesson'} when they're ready

TEACHING STYLE: 
- Patient and encouraging
- Use simple, clear explanations
- Connect new concepts to what they're currently learning
- Maintain educational flow and context"""

    if context["recent_interactions"]:
        recent_work = ", ".join([f"{interaction.get('method', 'activity')}: {interaction.get('problem', 'Unknown')}" 
                                for interaction in context["recent_interactions"]])
        base_prompt += f"\n\nRECENT WORK: {recent_work}"
    
    return base_prompt


def handle_demo_interruption(state, user_message) -> AIMessage:
    """Handle a user interruption during a demonstration with intelligent LLM processing."""
    print(f"🛑 [DEMO INTERRUPTION] Processing query with LLM: {user_message.content}")
    
    # Build comprehensive context for intelligent response
    context = build_interruption_context(state, user_message)
    
    # Save demo context for resumption
    demo_context = {
        "paused_at": datetime.now().isoformat(),
        "last_tool_call": state.get("last_tool_call"),
        "current_topic": state.get("current_topic"),
        "last_problem": state.get("last_problem"),
        "interruption_query": user_message.content,
        "context_snapshot": context
    }
    
    # Update state
    state["demo_paused"] = True
    state["demo_context"] = demo_context
    state["interruption_query"] = user_message.content
    
    try:
        # Set up LLM for intelligent interruption processing
        model = ChatOpenAI(
            model="gpt-4o-mini", 
            temperature=0.3,  # Consistent educational responses
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Build context-aware system prompt
        system_prompt = build_interruption_system_prompt(context)
        
        print(f"🤖 [LLM PROCESSING] Calling model with context-aware prompt")
        print(f"🤖 [SYSTEM PROMPT] Topic: {context['current_topic']}, Problem: {context['last_problem']}")
        
        # Process the interruption with full context
        from langchain_core.messages import SystemMessage
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message.content)
        ]
        
        response = model.invoke(messages)
        
        print(f"✅ [LLM RESPONSE] Generated intelligent response: {repr(response.content[:100])}...")
        
        # Add resumption guidance to the intelligent response
        final_content = response.content
        if not any(keyword in final_content.lower() for keyword in ['continue', 'resume', 'demo']):
            is_demo = context["is_demonstration"]
            final_content += f"\n\n💡 When you're ready, just say 'continue' and I'll resume the {'demonstration' if is_demo else 'lesson'} right where we left off!"
        
        return AIMessage(content=final_content)
        
    except Exception as e:
        print(f"❌ [LLM ERROR] Failed to process interruption: {str(e)}")
        print(f"🔄 [FALLBACK] Using fallback response")
        
        # Fallback to improved static response if LLM fails
        fallback_content = f"""🛑 I've paused to answer your question: "{user_message.content}"

{get_intelligent_fallback_response(user_message.content, context)}

💡 When you're ready, just say 'continue' and I'll resume the demonstration right where we left off!"""
        
        return AIMessage(content=fallback_content)


def get_intelligent_fallback_response(user_question: str, context: Dict[str, Any]) -> str:
    """Generate intelligent fallback response when LLM fails."""
    question_lower = user_question.lower()
    current_topic = context.get("current_topic", "math")
    last_problem = context.get("last_problem", "this problem")
    
    # Enhanced pattern matching for better fallback responses
    if any(word in question_lower for word in ["what", "what's", "define", "meaning"]):
        return f"Great question about '{user_question}'! This relates to what we're learning in {current_topic}. Let me explain that concept clearly for you."
    
    elif any(word in question_lower for word in ["how", "how do", "how to"]):
        return f"I'd be happy to show you how that works! It connects to our current work with {last_problem}. Let me break it down step by step."
    
    elif any(word in question_lower for word in ["why", "why do", "reason"]):
        return f"That's an excellent 'why' question! Understanding the reasoning behind {current_topic} is really important. Here's the explanation you need."
    
    elif any(word in question_lower for word in ["difference", "different", "versus", "vs"]):
        return f"Good question about the differences! This will help clarify the concepts we're working on with {last_problem}."
    
    elif any(word in question_lower for word in ["example", "examples", "show me"]):
        return f"I can definitely provide examples! This will help reinforce what we're learning with {last_problem}."
    
    else:
        return f"That's a thoughtful question about '{user_question}'! Let me help you understand this concept clearly."


def handle_demo_resume(state) -> AIMessage:
    """Handle resuming a paused demonstration."""
    print("▶️ [DEMO RESUME] Resuming demonstration")
    
    demo_context = state.get("demo_context", {})
    interruption_query = demo_context.get("interruption_query", "your question")
    
    # Clear pause state
    state["demo_paused"] = False
    state["interruption_query"] = None
    
    response_content = f"""▶️ Perfect! I've finished answering your question about "{interruption_query}".

Let's continue with the demonstration where we left off! The visual tool should resume automatically.

🎬 Continuing the demonstration..."""
    
    return AIMessage(content=response_content)


def extract_tool_completion_info(message) -> Dict[str, Any]:
    """Extract information from a tool completion response."""
    from validators import validate_tool_response
    
    try:
        # Use centralized validation and extraction
        validation_result = validate_tool_response(message)
        
        if validation_result.is_valid and validation_result.data:
            print(f"DEBUG: - Successfully extracted validated data: {validation_result.data}")
            return validation_result.data
        
        # If validation failed, provide fallback response
        print(f"DEBUG: - Validation failed, using fallback: {validation_result.errors}")
        content = message.content if hasattr(message, 'content') and message.content else ""
        
        return {
            "tool_used": "unknown",
            "success": False,
            "raw_response": content[:200],  # Truncate for safety
            "structured_format": False,
            "validation_errors": validation_result.errors,
            "validation_warnings": validation_result.warnings
        }
        
    except Exception as e:
        print(f"DEBUG: - Exception in extract_tool_completion_info: {str(e)}")
        return {
            "tool_used": "unknown",
            "success": False,
            "error": str(e),
            "structured_format": False
        }


def handle_tool_completion(state: MathTeachingState, tool_info: Dict[str, Any]) -> AIMessage:
    """Generate appropriate feedback and follow-up after tool completion with enhanced error handling."""
    
    # Check for validation errors first
    if "validation_errors" in tool_info and tool_info["validation_errors"]:
        print(f"DEBUG: - Validation errors detected: {tool_info['validation_errors']}")
        return AIMessage(content=f"I noticed some issues with your response. Let's try again with a simpler approach. Can you tell me what math problem you'd like to work on?")
    
    # Handle failed validation gracefully
    if not tool_info.get("success", True):
        print(f"DEBUG: - Tool completion failed, providing helpful fallback")
        if "error" in tool_info:
            print(f"DEBUG: - Error details: {tool_info['error']}")
        return AIMessage(content="I had trouble understanding your response. That's okay! Let's continue with our math learning. What would you like to work on next?")
    
    # Validate the answer if we have enough information
    if "completed_problem" in tool_info and "student_answer" in tool_info:
        problem = tool_info["completed_problem"]
        student_answer = tool_info["student_answer"]
        
        print(f"DEBUG: - Processing validated response: problem={problem}, answer={student_answer}")
        
        # Calculate correct answer with enhanced error handling
        try:
            correct_answer = calculate_expression(problem)
            # Use more tolerant comparison for floating point
            is_correct = abs(float(student_answer) - correct_answer) < 0.01
            print(f"DEBUG: - Answer validation: student={student_answer}, correct={correct_answer}, is_correct={is_correct}")
        except Exception as e:
            print(f"DEBUG: - Answer validation failed: {str(e)}")
            # Be more conservative - if we can't validate, assume incorrect and provide gentle feedback
            is_correct = False
            correct_answer = "unknown"
        
        if is_correct:
            feedback = f"🎉 Excellent work! You correctly solved {problem} = {student_answer}! "
            
            # Generate follow-up based on the operation
            if "+" in problem:
                feedback += "You're getting great at addition! What would you like to do next?\n\n"
                feedback += "📊 **For visual learning, say**: 'Show me addition on the number line'\n"
                feedback += "🎯 **For practice problems, say**: 'Give me practice problems'\n"
                feedback += "➕ **To try subtraction, say**: 'Let's learn subtraction'\n"
                feedback += "🔢 **For bigger numbers, say**: 'Show me harder addition'"
            elif "-" in problem:
                feedback += "You're mastering subtraction! What would you like to do next?\n\n"
                feedback += "📊 **For visual learning, say**: 'Show me subtraction on the number line'\n"
                feedback += "🎯 **For practice problems, say**: 'Give me practice problems'\n"
                feedback += "➕ **To try addition, say**: 'Let's practice addition'\n"
                feedback += "✖️ **For multiplication, say**: 'Teach me multiplication'"
            elif "*" in problem:
                feedback += "Great multiplication skills! What would you like to do next?\n\n"
                feedback += "🎯 **For practice problems, say**: 'Give me practice problems'\n"
                feedback += "➗ **To try division, say**: 'Let's learn division'\n"
                feedback += "🔢 **For bigger numbers, say**: 'Show me harder multiplication'\n"
                feedback += "📊 **For visual learning, say**: 'Show me this on the number line'"
            elif "/" in problem:
                feedback += "Fantastic division work! What would you like to do next?\n\n"
                feedback += "🎯 **For practice problems, say**: 'Give me practice problems'\n"
                feedback += "✖️ **To try multiplication, say**: 'Let's practice multiplication'\n"
                feedback += "🔢 **For harder problems, say**: 'Show me more division'\n"
                feedback += "📊 **For visual learning, say**: 'Show me this on the number line'"
            else:
                feedback += "What would you like to learn next?\n\n"
                feedback += "📊 **For visual learning, say**: 'Show me on the number line'\n"
                feedback += "🎯 **For practice problems, say**: 'Give me practice problems'"
        else:
            feedback = f"Good effort! For {problem}, the answer is actually {correct_answer}. "
            feedback += f"You got {student_answer}, which shows you're thinking about it! "
            feedback += "Let's try another one - would you like me to show you a similar problem or try a different approach?"
    
    else:
        # Generic positive feedback with specific learning options
        feedback = "Great job working with the interactive tool! You're making excellent progress. "
        feedback += "What would you like to explore next?\n\n"
        feedback += "📊 **For visual learning, say**: 'Show me on the number line'\n"
        feedback += "🎯 **For practice problems, say**: 'Give me practice problems'\n"
        feedback += "🧮 **For calculator practice, say**: 'Open the calculator'\n"
        feedback += "➕ **To try addition, say**: 'Let's practice addition'\n"
        feedback += "➖ **To try subtraction, say**: 'Teach me subtraction'\n"
        feedback += "✖️ **To try multiplication, say**: 'Show me multiplication'\n"
        feedback += "➗ **To try division, say**: 'Let's learn division'"
    
    return AIMessage(content=feedback)


# Tool for the agent to teach math concepts
TEACH_MATH_TOOL = {
    "type": "function",
    "function": {
        "name": "teach_math",
        "description": "Teach a math concept with visual aids or practice problems.",
        "parameters": {
            "type": "object",
            "properties": {
                "teaching_state": {
                    "type": "object",
                    "properties": {
                        "current_topic": {
                            "type": "string",
                            "description": "The current math topic being taught"
                        },
                        "current_operation": {
                            "type": "string",
                            "enum": [op.value for op in MathOperation],
                            "description": "The math operation being practiced"
                        },
                        "last_problem": {
                            "type": "string",
                            "description": "The math problem being solved (e.g., '5 + 3')"
                        },
                        "interaction_type": {
                            "type": "string",
                            "enum": [interaction.value for interaction in InteractionType],
                            "description": "Type of interaction: explanation, visual, or practice"
                        },
                        "feedback": {
                            "type": "string",
                            "description": "Feedback for the student"
                        }
                    }
                }
            },
            "required": ["teaching_state"]
        }
    }
}

# Tool for validating student answers
VALIDATE_ANSWER_TOOL = {
    "type": "function",
    "function": {
        "name": "validate_answer",
        "description": "Validate a student's answer to a math problem.",
        "parameters": {
            "type": "object",
            "properties": {
                "problem": {
                    "type": "string",
                    "description": "The math problem (e.g., '5 + 3')"
                },
                "student_answer": {
                    "type": "integer",
                    "description": "The student's answer"
                }
            },
            "required": ["problem", "student_answer"]
        }
    }
}


def chat_node(state: MathTeachingState) -> MathTeachingState:
    """Handle conversation and teaching logic."""
    
    print("\n" + "="*60)
    print("DEBUG: CHAT_NODE CALLED - Simplified Agent")
    print(f"DEBUG: Call timestamp: {datetime.now().isoformat()}")
    print("="*60)
    
    # Initialize state if needed
    if "current_topic" not in state:
        print("DEBUG: Initializing state for new session")
        state["current_topic"] = "Getting Started"
        state["current_operation"] = None
        state["last_problem"] = None
        state["student_answer"] = None
        state["correct_answer"] = None
        state["interaction_type"] = "explanation"
        state["feedback"] = "Welcome! What math topic would you like to learn today?"
        state["last_tool_call"] = None
        state["tool_in_progress"] = False
        state["completed_interactions"] = []
        state["pending_feedback"] = None
        # Initialize demo support
        state["demo_in_progress"] = False
        state["demo_paused"] = False
        state["demo_context"] = None
        state["interruption_query"] = None
        print(f"DEBUG: Initial state set - topic: {state['current_topic']}")
    else:
        print(f"DEBUG: Using existing state - topic: {state.get('current_topic', 'None')}")
    
    # Set up model
    model = ChatOpenAI(
        model="gpt-4o-mini", 
        temperature=0.3,
        api_key=os.getenv("OPENAI_API_KEY")
    )
    
    # Get the current messages
    messages = state.get("messages", [])
    
    print(f"DEBUG: Total messages in state: {len(messages)}")
    if messages:
        print(f"DEBUG: Last message preview: {repr(messages[-1].content[:100])}...")
        print(f"DEBUG: Last message type: {type(messages[-1])}")
        
        # Check if the last message is a tool response
        last_message = messages[-1]
        print(f"DEBUG: Last message analysis:")
        print(f"DEBUG: - Message type: {type(last_message)}")
        print(f"DEBUG: - Is HumanMessage: {isinstance(last_message, HumanMessage)}")
        print(f"DEBUG: - Content preview: {repr(last_message.content[:100] if last_message.content else 'None')}")
        print(f"DEBUG: - Current tool_in_progress: {state.get('tool_in_progress', False)}")
        print(f"DEBUG: - Current last_tool_call: {state.get('last_tool_call', None)}")
        
        is_tool_resp = is_tool_response(last_message)
        print(f"DEBUG: - Is tool response: {is_tool_resp}")
        
        if isinstance(last_message, HumanMessage) and is_tool_resp:
            print("DEBUG: ✅ DETECTED TOOL COMPLETION RESPONSE!")
            tool_info = extract_tool_completion_info(last_message)
            print(f"DEBUG: Tool completion info: {tool_info}")
            print(f"DEBUG: Previous completed interactions: {len(state.get('completed_interactions', []))}")
            
            # Handle tool completion
            feedback_response = handle_tool_completion(state, tool_info)
            print(f"DEBUG: ✅ Generated feedback response: {repr(feedback_response.content[:100])}...")
            
            updated_state = {
                **state,
                "messages": messages + [feedback_response],
                "tool_in_progress": False,
                "last_tool_call": None,
                "completed_interactions": state.get("completed_interactions", []) + [tool_info],
                # Clear demo state when tool completes
                "demo_in_progress": False,
                "demo_paused": False
            }
            print(f"DEBUG: ✅ RETURNING TOOL COMPLETION RESPONSE")
            print(f"DEBUG: - New tool_in_progress: {updated_state['tool_in_progress']}")
            print(f"DEBUG: - New completed_interactions count: {len(updated_state['completed_interactions'])}")
            return updated_state
        
        # Check for demo interruption
        elif isinstance(last_message, HumanMessage) and is_demo_interruption(last_message, state):
            print("DEBUG: 🛑 DETECTED DEMO INTERRUPTION!")
            interruption_response = handle_demo_interruption(state, last_message)
            print(f"DEBUG: ✅ Generated interruption response: {repr(interruption_response.content[:100])}...")
            
            updated_state = {
                **state,
                "messages": messages + [interruption_response],
                "demo_paused": True
            }
            print(f"DEBUG: ✅ RETURNING DEMO INTERRUPTION RESPONSE")
            return updated_state
        
        # Check for demo resume request
        elif isinstance(last_message, HumanMessage) and state.get("demo_paused", False):
            content_lower = last_message.content.lower() if last_message.content else ""
            resume_keywords = ['continue', 'resume', 'next step', 'keep going', 'proceed', 'go on']
            
            if any(keyword in content_lower for keyword in resume_keywords):
                print("DEBUG: ▶️ DETECTED DEMO RESUME REQUEST!")
                resume_response = handle_demo_resume(state)
                print(f"DEBUG: ✅ Generated resume response: {repr(resume_response.content[:100])}...")
                
                updated_state = {
                    **state,
                    "messages": messages + [resume_response],
                    "demo_paused": False
                }
                print(f"DEBUG: ✅ RETURNING DEMO RESUME RESPONSE")
                return updated_state
    else:
        print("DEBUG: No messages found - will provide welcome")
    
    # If no messages, provide welcome
    if not messages:
        welcome_message = AIMessage(content=(
            "Hi! I'm your math teacher! 😊 "
            "I can help you learn addition, subtraction, multiplication, and division with interactive tools! "
            "Here's how to get started:\n\n"
            "📊 **For visual learning**: 'Show me addition on the number line'\n"
            "🎯 **For practice problems**: 'Give me practice problems'\n"
            "🧮 **For calculator help**: 'Open the calculator'\n"
            "📚 **To learn a topic**: 'Teach me subtraction' or 'Let's learn multiplication'\n\n"
            "I'll create problems for you automatically - just tell me what you'd like to explore!"
        ))
        print("DEBUG: ✅ Returning welcome message")
        return {
            **state,
            "messages": [welcome_message]
        }
    
    # Create a simple system prompt
    system_prompt = f"""You are a patient, encouraging math teacher helping students learn basic arithmetic.

Current teaching context:
- Topic: {state.get('current_topic', 'None')}
- Tool in progress: {state.get('tool_in_progress', False)}
- Completed interactions: {len(state.get('completed_interactions', []))}

CRITICAL: You have access to these interactive tools that will show visual components to the student:

1. **demonstrate_number_line** - NEW! Use when student wants to LEARN VISUALLY or see a DEMONSTRATION
   - Use for: "show me how", "teach me visually", "I want to learn", "demonstrate", "explain step by step"
   - Call with problem (e.g., "5 + 3") and operation (e.g., "addition")
   - This will auto-demonstrate each step with AI explanations
   - Always provide encouraging text BEFORE calling the tool

2. **show_number_line** - Use when student wants to PRACTICE with visual/number line interaction
   - Use for: "let me try", "I want to practice", "interactive number line", "let me solve"
   - Call with problem (e.g., "5 + 3") and operation (e.g., "addition")
   - This allows manual student interaction
   - Always provide encouraging text BEFORE calling the tool

3. **practice_problem** - Use when student wants practice problems (always use this tool when the student asks for practice problem/question)
   - Call with problem (e.g., "7 + 4 = ?") and operation (e.g., "addition")
   - Always provide encouraging text BEFORE calling the tool

4. **open_calculator** - Use when student wants calculator help
   - Call with no parameters
   - Always provide encouraging text BEFORE calling the tool

5. **calculate** - Use for validating answers and doing calculations
   - Call with expression (e.g., "5 + 3")

TEACHING FLOW:
1. When student asks to LEARN a topic: Use demonstrate_number_line to show them how it works first
2. When student asks for "visual learning", "demonstration", "show me how": Call demonstrate_number_line tool
3. When student asks for "practice" or "let me try": Call show_number_line or practice_problem tools
4. When student asks for "calculator": Call open_calculator tool
5. Always be encouraging and provide text responses along with tool calls

PROBLEM GENERATION RULES:
- NEVER ask the user to provide problems - YOU generate them automatically
- Create age-appropriate problems based on the current topic and difficulty level
- For addition: Start with single digits (2+3, 5+4), progress to teen numbers (7+8, 9+6)
- For subtraction: Start simple (8-3, 10-4), avoid negative results for beginners
- For multiplication: Begin with small numbers (3×2, 4×5), use visual-friendly numbers
- For division: Use problems that divide evenly (8÷2, 12÷3), avoid remainders initially
- Gradually increase difficulty based on student success

IMPORTANT CONVERSATION PROGRESSION:
- After a student completes an interactive tool, provide feedback and suggest next steps
- Don't repeat the same tool immediately unless student specifically requests it
- Vary the difficulty and type of problems to keep learning engaging
- Always validate answers and provide encouragement
- Ask follow-up questions to continue the learning conversation

TOOL RESPONSE HANDLING:
- When you receive feedback from interactive tools, acknowledge the student's work
- Provide specific feedback about their answer
- Suggest related problems or new topics to explore
- Keep the conversation flowing naturally

STUDENT REQUEST EXAMPLES AND RESPONSES:
- Student: "I want to learn addition visually" → Call demonstrate_number_line("4 + 3", "addition")
- Student: "Show me how 5 + 3 works" → Call demonstrate_number_line("5 + 3", "addition")
- Student: "Teach me subtraction step by step" → Call demonstrate_number_line("9 - 4", "subtraction")
- Student: "Demonstrate addition for me" → Call demonstrate_number_line("6 + 2", "addition")
- Student: "Show me addition on the number line" → Call show_number_line("4 + 3", "addition") (for practice)
- Student: "Let me try the number line" → Call show_number_line("7 + 8", "addition")
- Student: "Give me practice problems" → Call practice_problem("6 + 2 = ?", "addition")  
- Student: "I want to practice multiplication" → Call practice_problem("3 × 4 = ?", "multiplication")

CRITICAL RULES TO PREVENT DUPLICATION:
- If tool_in_progress is True, DO NOT call any tools - wait for completion
- If you just received a tool completion response, provide feedback and move to next topic
- Only call tools when student explicitly requests them or when starting a new problem
- Never call the same tool twice in a row for the same problem

IMPORTANT: The tools will show interactive components to the student. Always include helpful text when calling tools.
"""

    # Bind tools (we'll use the existing simple tools)
    from tools import calculate, show_number_line, demonstrate_number_line, practice_problem, open_calculator, validate_learning_step
    
    print("DEBUG: Binding tools to model")
    available_tools = [calculate, show_number_line, demonstrate_number_line, practice_problem, open_calculator, validate_learning_step]
    print(f"DEBUG: Available tools: {[tool.name for tool in available_tools]}")
    
    # Check if we should prevent tool calls
    tool_in_progress = state.get('tool_in_progress', False)
    print(f"DEBUG: Tool in progress check: {tool_in_progress}")
    
    if tool_in_progress:
        print("DEBUG: ⚠️ TOOL IN PROGRESS - NOT BINDING TOOLS TO PREVENT DUPLICATION")
        model_with_tools = model  # Don't bind tools if one is in progress
    else:
        print("DEBUG: ✅ No tool in progress - binding tools to model")
        model_with_tools = model.bind_tools(available_tools)

    # Get response from the model
    messages_for_model = [
        {"role": "system", "content": system_prompt}
    ] + [
        {"role": "human" if isinstance(msg, HumanMessage) else "assistant", "content": msg.content}
        for msg in messages
    ]
    
    print(f"DEBUG: Sending {len(messages_for_model)} messages to model")
    print(f"DEBUG: System prompt length: {len(system_prompt)} chars")
    
    try:
        response = model_with_tools.invoke(messages_for_model)
        print(f"DEBUG: ✅ Model response received")
        print(f"DEBUG: Response type: {type(response)}")
        print(f"DEBUG: Response content length: {len(response.content)} chars")
        print(f"DEBUG: Response preview: {repr(response.content[:150])}...")
        
        # Check for tool calls
        has_tool_calls = hasattr(response, 'tool_calls') and response.tool_calls
        print(f"DEBUG: Has tool calls: {has_tool_calls}")
        if has_tool_calls:
            tool_names = [tc.get('name', 'unknown') for tc in response.tool_calls]
            print(f"DEBUG: 🔧 AGENT IS CALLING TOOLS: {tool_names}")
            print(f"DEBUG: - Previous tool_in_progress: {state.get('tool_in_progress', False)}")
            print(f"DEBUG: - Previous last_tool_call: {state.get('last_tool_call', None)}")
            print(f"DEBUG: - Total tool calls in this response: {len(response.tool_calls)}")
            
            # Check if we're already in a tool interaction
            if state.get('tool_in_progress', False):
                print(f"DEBUG: ⚠️ WARNING: Tool call while another tool is in progress!")
                print(f"DEBUG: - Current tool: {state.get('last_tool_call', None)}")
                print(f"DEBUG: - New tool: {tool_names[0] if tool_names else None}")
                print(f"DEBUG: - This might cause duplication!")
            
            # Update state to track tool in progress
            first_tool_name = tool_names[0] if tool_names else None
            is_demo_tool = first_tool_name and "demonstrate" in first_tool_name
            
            updated_state = {
                **state,
                "messages": messages + [response],
                "tool_in_progress": True,
                "last_tool_call": first_tool_name,
                # Set demo flags
                "demo_in_progress": is_demo_tool,
                "demo_paused": False
            }
            print(f"DEBUG: ✅ RETURNING TOOL CALL RESPONSE")
            print(f"DEBUG: - New tool_in_progress: True")
            print(f"DEBUG: - New last_tool_call: {first_tool_name}")
            print(f"DEBUG: - New demo_in_progress: {is_demo_tool}")
            return updated_state
            
    except Exception as e:
        print(f"DEBUG: ❌ Model invocation failed: {e}")
        response = AIMessage(content="I'm having a technical issue, but I'm here to help! What math topic would you like to explore?")
        print("DEBUG: ✅ Using fallback response")
    
    # Update state and return (for non-tool responses)
    final_state = {
        **state,
        "messages": messages + [response],
        "tool_in_progress": False,
        "last_tool_call": None
    }
    
    print(f"DEBUG: ✅ Returning updated state")
    print(f"DEBUG: Total messages after update: {len(final_state['messages'])}")
    print(f"DEBUG: Current topic: {final_state.get('current_topic', 'None')}")
    print("="*60)
    print("DEBUG: CHAT_NODE COMPLETED")
    print("="*60 + "\n")
    
    return final_state




# Create the workflow
workflow = StateGraph(
    MathTeachingState,
    input=GraphInput,
    output=GraphOutput
)

# Add single chat node
workflow.add_node("chat", chat_node)

# Set entry point and edges
workflow.add_edge(START, "chat")
workflow.add_edge("chat", END)

# Compile the graph
math_teacher_graph = workflow.compile(checkpointer=MemorySaver())