"""Math tools for the teacher agent."""

from langchain_core.tools import tool
import re
import operator


@tool
def calculate(expression: str) -> dict:
    """Perform basic math calculations for addition, subtraction, multiplication, and division.
    
    Args:
        expression: A mathematical expression like "5 + 3", "10 - 4", "6 * 2", or "8 / 2"
        
    Returns:
        dict: Contains the result, original expression, and explanation
    """
    try:
        # Import the validators here to avoid circular imports
        from validators import InputSanitizer, ValidationError, SecurityError
        
        # Use centralized sanitization
        sanitizer = InputSanitizer()
        clean_expression = sanitizer.sanitize_math_expression(expression)
        
        # Evaluate the expression safely
        result = eval(clean_expression)
        
        # Create explanation based on operation
        explanation = _create_explanation(clean_expression, result)
        
        return {
            "expression": clean_expression,
            "original_expression": expression,
            "result": result,
            "error": None,
            "explanation": explanation
        }
        
    except (ValidationError, SecurityError) as e:
        return {
            "expression": expression,
            "result": None,
            "error": f"Validation error: {str(e)}",
            "explanation": "The expression contains invalid or potentially dangerous content. Please use only numbers and basic math operations (+, -, *, /)."
        }
    except ZeroDivisionError:
        return {
            "expression": expression,
            "result": None,
            "error": "Cannot divide by zero",
            "explanation": "Division by zero is not allowed in mathematics."
        }
    except Exception as e:
        return {
            "expression": expression,
            "result": None,
            "error": f"Error calculating: {str(e)}",
            "explanation": "There was an error with this calculation. Please check the expression."
        }


def _create_explanation(expression: str, result: float) -> str:
    """Create a helpful explanation for the calculation."""
    
    # Simple addition
    if "+" in expression and "-" not in expression:
        parts = expression.split("+")
        if len(parts) == 2:
            num1, num2 = parts[0].strip(), parts[1].strip()
            return f"Adding {num1} and {num2} gives us {result}"
    
    # Simple subtraction
    elif "-" in expression and "+" not in expression:
        parts = expression.split("-")
        if len(parts) == 2:
            num1, num2 = parts[0].strip(), parts[1].strip()
            return f"Subtracting {num2} from {num1} gives us {result}"
    
    # Simple multiplication
    elif "*" in expression:
        parts = expression.split("*")
        if len(parts) == 2:
            num1, num2 = parts[0].strip(), parts[1].strip()
            return f"Multiplying {num1} by {num2} gives us {result}"
    
    # Simple division
    elif "/" in expression:
        parts = expression.split("/")
        if len(parts) == 2:
            num1, num2 = parts[0].strip(), parts[1].strip()
            return f"Dividing {num1} by {num2} gives us {result}"
    
    # Default explanation
    return f"The calculation {expression} equals {result}"


@tool
def show_number_line(problem: str, operation: str, start: int = 0, end: int = 20) -> dict:
    """Show an interactive number line for visual addition or subtraction learning.
    
    Args:
        problem: The math problem to solve (e.g., '5 + 3' or '10 - 4')
        operation: The operation type: 'addition' or 'subtraction'
        start: Starting number for the number line (default: 0)
        end: Ending number for the number line (default: 20)
        
    Returns:
        dict: Information about the number line display
    """
    return {
        "action": "show_number_line",
        "problem": problem,
        "operation": operation,
        "start": start,
        "end": end,
        "message": f"Displaying number line for {problem} ({operation})"
    }


@tool
def demonstrate_number_line(problem: str, operation: str, start: int = 0, end: int = 20) -> dict:
    """Demonstrate step-by-step visual learning on the number line with AI guidance.
    
    Use this tool when users want to LEARN visually or ask for demonstrations.
    The AI will automatically show each step with explanations.
    
    Args:
        problem: The math problem to demonstrate (e.g., '5 + 3' or '10 - 4')
        operation: The operation type: 'addition' or 'subtraction'
        start: Starting number for the number line (default: 0)
        end: Ending number for the number line (default: 20)
        
    Returns:
        dict: Information about the number line demonstration
    """
    return {
        "action": "demonstrate_number_line",
        "problem": problem,
        "operation": operation,
        "start": start,
        "end": end,
        "message": f"Let me demonstrate how {problem} works step by step!"
    }


@tool
def practice_problem(problem: str, operation: str) -> dict:
    """Show a practice problem for the student to solve.
    
    Args:
        problem: The math problem to practice (e.g., '7 + 4 = ?')
        operation: The operation type: 'addition', 'subtraction', 'multiplication', or 'division'
        
    Returns:
        dict: Information about the practice problem
    """
    return {
        "action": "practice_problem",
        "problem": problem,
        "operation": operation,
        "message": f"Here's a practice problem: {problem}"
    }


@tool
def open_calculator() -> dict:
    """Open a visual calculator for students to perform calculations.
    
    Returns:
        dict: Information about opening the calculator
    """
    return {
        "action": "open_calculator",
        "message": "Opening the visual calculator for you to use"
    }


@tool
def validate_learning_step(
    tool_type: str,
    problem: str,
    operation: str,
    validation_data: dict
) -> dict:
    """Validate a learning step taken by the student in an interactive tool.
    
    This tool validates whether the student is progressing correctly through
    their learning journey and provides educational feedback and guidance.
    
    Args:
        tool_type: Type of tool being used ('number_line', 'practice_problem', 'calculator')
        problem: The math problem being worked on (e.g., '5 + 3')
        operation: The operation type ('addition', 'subtraction', 'multiplication', 'division')
        validation_data: Dictionary containing step-specific validation data:
            - For number_line: {'current_steps': [1,2,3], 'proposed_step': 4, 'expected_sequence': [1,2,3,4,5]}
            - For practice_problem: {'user_input': '8', 'step_number': 1}
            - For calculator: {'expression': '5+3', 'operation_sequence': ['5', '+', '3'], 'current_input': '8'}
    
    Returns:
        dict: Validation result with feedback, guidance, and correctness information
    """
    try:
        from step_validator import StepValidator
        
        validator = StepValidator()
        
        print(f"🔍 [VALIDATION TOOL] Validating {tool_type} step for {problem}")
        print(f"🔍 [VALIDATION DATA] {validation_data}")
        
        if tool_type == "number_line":
            result = validator.validate_number_line_step(
                problem=problem,
                operation=operation,
                current_steps=validation_data.get('current_steps', []),
                proposed_step=validation_data.get('proposed_step', 0),
                expected_sequence=validation_data.get('expected_sequence', [])
            )
        
        elif tool_type == "practice_problem":
            result = validator.validate_practice_step(
                problem=problem,
                operation=operation,
                user_input=validation_data.get('user_input', ''),
                step_number=validation_data.get('step_number', 1)
            )
        
        elif tool_type == "calculator":
            result = validator.validate_calculator_step(
                expression=validation_data.get('expression', ''),
                operation_sequence=validation_data.get('operation_sequence', []),
                current_input=validation_data.get('current_input', '')
            )
        
        else:
            result = {
                "result": "needs_guidance",
                "is_correct": False,
                "feedback": f"Unknown tool type: {tool_type}",
                "hint": "Please try again with a valid tool type.",
                "mistake_type": "invalid_tool",
                "guidance_level": "error"
            }
        
        print(f"✅ [VALIDATION RESULT] {result.get('result', 'unknown')}: {result.get('feedback', 'No feedback')}")
        
        return {
            "action": "validate_learning_step",
            "tool_type": tool_type,
            "problem": problem,
            "validation_result": result,
            "message": result.get("feedback", "Step validated")
        }
        
    except Exception as e:
        print(f"❌ [VALIDATION TOOL] Error: {str(e)}")
        return {
            "action": "validate_learning_step",
            "tool_type": tool_type,
            "problem": problem,
            "validation_result": {
                "result": "needs_guidance",
                "is_correct": False,
                "feedback": "I'm having trouble validating that step. Let's keep going!",
                "hint": "Continue with the next step in your learning.",
                "mistake_type": "validation_error",
                "guidance_level": "gentle",
                "error": str(e)
            },
            "message": "Validation completed with fallback guidance"
        }