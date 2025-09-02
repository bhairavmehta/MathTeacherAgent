"""
Step-by-step validation service for educational tool interactions.
Provides intelligent validation and guidance for user learning progression.
"""

import re
import json
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from enum import Enum


class ValidationResult(Enum):
    """Validation result types."""
    CORRECT = "correct"
    INCORRECT = "incorrect"
    PARTIALLY_CORRECT = "partially_correct"
    NEEDS_GUIDANCE = "needs_guidance"


class ToolType(Enum):
    """Types of educational tools."""
    NUMBER_LINE = "number_line"
    PRACTICE_PROBLEM = "practice_problem"
    CALCULATOR = "calculator"


class StepValidator:
    """Main validation service for educational step-by-step interactions."""
    
    def __init__(self):
        self.validation_history = []
        self.common_mistakes = self._load_common_mistakes()
    
    def _load_common_mistakes(self) -> Dict[str, List[str]]:
        """Load common mistake patterns for different operations."""
        return {
            "addition": [
                "counting_by_wrong_increment",
                "starting_from_wrong_number", 
                "going_backward_instead_forward",
                "skipping_numbers",
                "adding_instead_of_counting"
            ],
            "subtraction": [
                "going_forward_instead_backward",
                "subtracting_wrong_amount",
                "starting_from_wrong_number",
                "skipping_numbers",
                "negative_result_confusion"
            ],
            "multiplication": [
                "adding_wrong_groups",
                "incorrect_grouping",
                "skip_counting_errors",
                "repeated_addition_mistakes"
            ],
            "division": [
                "incorrect_grouping",
                "remainder_confusion",
                "multiplication_reversal"
            ]
        }
    
    def validate_number_line_step(
        self, 
        problem: str,
        operation: str,
        current_steps: List[int],
        proposed_step: int,
        expected_sequence: List[int]
    ) -> Dict[str, Any]:
        """
        Validate a single step in number line interaction.
        
        Args:
            problem: Math problem being solved (e.g., "5 + 3")
            operation: Operation type (addition, subtraction)
            current_steps: Steps taken so far
            proposed_step: Next step user wants to take
            expected_sequence: Expected correct sequence
            
        Returns:
            Validation result with feedback and guidance
        """
        print(f"🔍 [STEP VALIDATION] Number line: {problem}, steps: {current_steps}, proposed: {proposed_step}")
        
        try:
            # Parse the problem
            numbers = self._parse_math_problem(problem)
            if not numbers:
                return self._create_error_result("Could not parse the math problem")
            
            first_num, second_num, operator = numbers
            
            # Validate the proposed step
            if len(current_steps) == 0:
                # First step validation
                return self._validate_first_step(first_num, proposed_step, operator)
            
            # Subsequent step validation
            return self._validate_subsequent_step(
                first_num, second_num, operator, current_steps, proposed_step
            )
            
        except Exception as e:
            print(f"❌ [STEP VALIDATION] Error: {str(e)}")
            return self._create_error_result(f"Validation error: {str(e)}")
    
    def validate_practice_step(
        self,
        problem: str,
        operation: str,
        user_input: str,
        step_number: int
    ) -> Dict[str, Any]:
        """
        Validate intermediate steps in practice problem solving.
        
        Args:
            problem: Math problem being solved
            operation: Operation type
            user_input: User's current input/answer attempt
            step_number: Which step in the process (1=first attempt, etc.)
            
        Returns:
            Validation result with feedback
        """
        print(f"🔍 [PRACTICE VALIDATION] Problem: {problem}, input: {user_input}, step: {step_number}")
        
        try:
            # Parse input safely
            if not user_input or not user_input.strip():
                return {
                    "result": ValidationResult.NEEDS_GUIDANCE.value,
                    "is_correct": False,
                    "feedback": "Please enter your answer to continue.",
                    "hint": "Take your time and think about the problem step by step.",
                    "mistake_type": None,
                    "guidance_level": "gentle"
                }
            
            # Try to parse as number
            try:
                user_answer = float(user_input.strip())
            except ValueError:
                return {
                    "result": ValidationResult.INCORRECT.value,
                    "is_correct": False,
                    "feedback": "Please enter a valid number.",
                    "hint": "Make sure you're entering just the number, like '8' or '12'.",
                    "mistake_type": "invalid_input",
                    "guidance_level": "specific"
                }
            
            # Calculate correct answer
            numbers = self._parse_math_problem(problem)
            if not numbers:
                return self._create_error_result("Could not parse the math problem")
            
            first_num, second_num, operator = numbers
            correct_answer = self._calculate_answer(first_num, second_num, operator)
            
            # Check if answer is correct
            if abs(user_answer - correct_answer) < 0.01:
                return {
                    "result": ValidationResult.CORRECT.value,
                    "is_correct": True,
                    "feedback": f"🎉 Excellent! {problem} = {correct_answer}",
                    "hint": "Great job! You solved it correctly!",
                    "mistake_type": None,
                    "guidance_level": "celebration",
                    "correct_answer": correct_answer
                }
            
            # Answer is incorrect - analyze the mistake
            return self._analyze_practice_mistake(
                first_num, second_num, operator, user_answer, correct_answer, step_number
            )
            
        except Exception as e:
            print(f"❌ [PRACTICE VALIDATION] Error: {str(e)}")
            return self._create_error_result(f"Validation error: {str(e)}")
    
    def validate_calculator_step(
        self,
        expression: str,
        operation_sequence: List[str],
        current_input: str
    ) -> Dict[str, Any]:
        """
        Validate calculator operation sequence for educational soundness.
        
        Args:
            expression: Full expression being built
            operation_sequence: Sequence of operations taken
            current_input: Current calculator input
            
        Returns:
            Validation result with guidance
        """
        print(f"🔍 [CALCULATOR VALIDATION] Expression: {expression}, sequence: {operation_sequence}")
        
        try:
            # Basic validation - ensure mathematical correctness
            if not expression or not expression.strip():
                return {
                    "result": ValidationResult.CORRECT.value,
                    "is_correct": True,
                    "feedback": "Ready to calculate!",
                    "hint": "Enter your first number to get started.",
                    "guidance_level": "gentle"
                }
            
            # Check for common calculator mistakes
            mistakes = self._analyze_calculator_sequence(operation_sequence)
            
            if mistakes:
                return {
                    "result": ValidationResult.NEEDS_GUIDANCE.value,
                    "is_correct": False,
                    "feedback": f"Let's double-check that calculation: {mistakes['feedback']}",
                    "hint": mistakes['hint'],
                    "mistake_type": mistakes['type'],
                    "guidance_level": "helpful"
                }
            
            return {
                "result": ValidationResult.CORRECT.value,
                "is_correct": True,
                "feedback": "Looking good! Your calculation is on track.",
                "hint": "Continue with your calculation.",
                "guidance_level": "encouraging"
            }
            
        except Exception as e:
            print(f"❌ [CALCULATOR VALIDATION] Error: {str(e)}")
            return self._create_error_result(f"Validation error: {str(e)}")
    
    def _validate_first_step(self, first_num: int, proposed_step: int, operator: str) -> Dict[str, Any]:
        """Validate the first step in number line interaction."""
        if proposed_step == first_num:
            return {
                "result": ValidationResult.CORRECT.value,
                "is_correct": True,
                "feedback": f"Perfect! You started at {first_num}. Now let's count {'forward' if operator == '+' else 'backward'}!",
                "hint": f"Great start! Next, click on {first_num + (1 if operator == '+' else -1)}.",
                "mistake_type": None,
                "guidance_level": "encouraging"
            }
        else:
            return {
                "result": ValidationResult.INCORRECT.value,
                "is_correct": False,
                "feedback": f"Let's start at the first number: {first_num}",
                "hint": f"Click on {first_num} to begin the problem.",
                "mistake_type": "wrong_starting_number",
                "guidance_level": "specific"
            }
    
    def _validate_subsequent_step(
        self, 
        first_num: int, 
        second_num: int, 
        operator: str, 
        current_steps: List[int], 
        proposed_step: int
    ) -> Dict[str, Any]:
        """Validate subsequent steps in number line interaction."""
        last_position = current_steps[-1]
        expected_next = last_position + (1 if operator == '+' else -1)
        steps_taken = len(current_steps) - 1  # Subtract 1 because first step is starting position
        
        if proposed_step == expected_next:
            remaining_steps = second_num - steps_taken - 1
            
            if remaining_steps <= 0:
                # Problem completed!
                final_answer = first_num + (second_num if operator == '+' else -second_num)
                return {
                    "result": ValidationResult.CORRECT.value,
                    "is_correct": True,
                    "feedback": f"🎉 Fantastic! You solved {first_num} {operator} {second_num} = {final_answer}!",
                    "hint": "Excellent work! You completed the problem step by step.",
                    "mistake_type": None,
                    "guidance_level": "celebration",
                    "problem_completed": True,
                    "final_answer": final_answer
                }
            else:
                return {
                    "result": ValidationResult.CORRECT.value,
                    "is_correct": True,
                    "feedback": f"Great! Keep going - {remaining_steps} more step{'s' if remaining_steps > 1 else ''}.",
                    "hint": f"Perfect! Now click on {expected_next + (1 if operator == '+' else -1)}.",
                    "mistake_type": None,
                    "guidance_level": "encouraging",
                    "remaining_steps": remaining_steps
                }
        else:
            # Analyze the mistake
            return self._analyze_number_line_mistake(
                operator, last_position, expected_next, proposed_step, second_num - steps_taken
            )
    
    def _analyze_number_line_mistake(
        self, 
        operator: str, 
        last_position: int, 
        expected_next: int, 
        proposed_step: int,
        remaining_count: int
    ) -> Dict[str, Any]:
        """Analyze and provide feedback for number line mistakes."""
        
        # Check if user clicked too far ahead
        if operator == '+' and proposed_step > expected_next:
            return {
                "result": ValidationResult.INCORRECT.value,
                "is_correct": False,
                "feedback": f"Slow down! Let's count one step at a time.",
                "hint": f"Try clicking on {expected_next} instead of {proposed_step}.",
                "mistake_type": "skipping_numbers",
                "guidance_level": "gentle"
            }
        
        # Check if user went backward when should go forward
        elif operator == '+' and proposed_step < last_position:
            return {
                "result": ValidationResult.INCORRECT.value,
                "is_correct": False,
                "feedback": "For addition, we count forward (to the right)!",
                "hint": f"Click on {expected_next} to continue counting forward.",
                "mistake_type": "wrong_direction",
                "guidance_level": "specific"
            }
        
        # Check if user went forward when should go backward
        elif operator == '-' and proposed_step > last_position:
            return {
                "result": ValidationResult.INCORRECT.value,
                "is_correct": False,
                "feedback": "For subtraction, we count backward (to the left)!",
                "hint": f"Click on {expected_next} to continue counting backward.",
                "mistake_type": "wrong_direction",
                "guidance_level": "specific"
            }
        
        # Check if user clicked too far back
        elif operator == '-' and proposed_step < expected_next:
            return {
                "result": ValidationResult.INCORRECT.value,
                "is_correct": False,
                "feedback": f"Let's count one step at a time.",
                "hint": f"Try clicking on {expected_next} instead of {proposed_step}.",
                "mistake_type": "skipping_numbers",
                "guidance_level": "gentle"
            }
        
        # Generic incorrect step
        else:
            direction = "forward" if operator == '+' else "backward"
            return {
                "result": ValidationResult.INCORRECT.value,
                "is_correct": False,
                "feedback": f"Not quite! Let's count {direction} one number at a time.",
                "hint": f"Click on {expected_next} to continue.",
                "mistake_type": "incorrect_sequence",
                "guidance_level": "helpful"
            }
    
    def _analyze_practice_mistake(
        self, 
        first_num: int, 
        second_num: int, 
        operator: str, 
        user_answer: float, 
        correct_answer: float, 
        step_number: int
    ) -> Dict[str, Any]:
        """Analyze practice problem mistakes and provide targeted feedback."""
        
        # Check for common mistake patterns
        if operator == '+':
            if user_answer == first_num or user_answer == second_num:
                return {
                    "result": ValidationResult.INCORRECT.value,
                    "is_correct": False,
                    "feedback": f"You entered one of the numbers from the problem. For addition, we need to add them together!",
                    "hint": f"Try adding {first_num} + {second_num}. What do you get?",
                    "mistake_type": "not_adding",
                    "guidance_level": "specific"
                }
            elif abs(user_answer - (first_num - second_num)) < 0.01:
                return {
                    "result": ValidationResult.INCORRECT.value,
                    "is_correct": False,
                    "feedback": f"It looks like you subtracted instead of adding!",
                    "hint": f"For addition, we add the numbers together: {first_num} + {second_num}.",
                    "mistake_type": "wrong_operation",
                    "guidance_level": "specific"
                }
        
        elif operator == '-':
            if abs(user_answer - (first_num + second_num)) < 0.01:
                return {
                    "result": ValidationResult.INCORRECT.value,
                    "is_correct": False,
                    "feedback": f"It looks like you added instead of subtracting!",
                    "hint": f"For subtraction, we take away: {first_num} - {second_num}.",
                    "mistake_type": "wrong_operation",
                    "guidance_level": "specific"
                }
        
        # Check if answer is close (off by small amount)
        diff = abs(user_answer - correct_answer)
        if diff <= 2:
            return {
                "result": ValidationResult.PARTIALLY_CORRECT.value,
                "is_correct": False,
                "feedback": f"You're very close! The answer is {correct_answer}, you got {user_answer}.",
                "hint": f"Try again - you're almost there!",
                "mistake_type": "close_answer",
                "guidance_level": "encouraging"
            }
        
        # Generic incorrect answer with guidance
        guidance_level = "gentle" if step_number == 1 else "specific"
        return {
            "result": ValidationResult.INCORRECT.value,
            "is_correct": False,
            "feedback": f"Not quite right. The correct answer is {correct_answer}.",
            "hint": f"Try working through {first_num} {operator} {second_num} step by step.",
            "mistake_type": "incorrect_calculation",
            "guidance_level": guidance_level,
            "correct_answer": correct_answer
        }
    
    def _analyze_calculator_sequence(self, operation_sequence: List[str]) -> Optional[Dict[str, Any]]:
        """Analyze calculator operation sequence for educational mistakes."""
        
        # Check for common calculator mistakes
        if len(operation_sequence) < 2:
            return None  # Not enough operations to analyze
        
        # Check for repeated operators
        operators = [op for op in operation_sequence if op in ['+', '-', '*', '/', '×', '÷']]
        if len(operators) > len(set(operators)) * 2:  # Allow some repetition
            return {
                "type": "repeated_operators",
                "feedback": "Looks like you entered the same operator multiple times.",
                "hint": "Double-check your calculation - you might have an extra operator."
            }
        
        # Check for missing numbers between operators
        has_consecutive_operators = False
        for i in range(len(operation_sequence) - 1):
            if (operation_sequence[i] in ['+', '-', '*', '/', '×', '÷'] and 
                operation_sequence[i + 1] in ['+', '-', '*', '/', '×', '÷']):
                has_consecutive_operators = True
                break
        
        if has_consecutive_operators:
            return {
                "type": "consecutive_operators",
                "feedback": "You have two operators in a row.",
                "hint": "Make sure to enter a number between each operator."
            }
        
        return None  # No mistakes detected
    
    def _parse_math_problem(self, problem: str) -> Optional[Tuple[int, int, str]]:
        """Parse a math problem string into components."""
        if not problem or not isinstance(problem, str):
            return None
        
        # Match patterns like "5 + 3", "10 - 4", etc.
        pattern = r'(\d+)\s*([+\-×÷*/])\s*(\d+)'
        match = re.search(pattern, problem)
        
        if match:
            first_num = int(match.group(1))
            operator = match.group(2)
            second_num = int(match.group(3))
            
            # Normalize operator
            if operator in ['×', '*']:
                operator = '*'
            elif operator in ['÷', '/']:
                operator = '/'
            
            return (first_num, second_num, operator)
        
        return None
    
    def _calculate_answer(self, first_num: int, second_num: int, operator: str) -> float:
        """Calculate the correct answer for a math problem."""
        if operator == '+':
            return float(first_num + second_num)
        elif operator == '-':
            return float(first_num - second_num)
        elif operator == '*':
            return float(first_num * second_num)
        elif operator == '/':
            if second_num == 0:
                raise ValueError("Division by zero")
            return float(first_num / second_num)
        else:
            raise ValueError(f"Unknown operator: {operator}")
    
    def _create_error_result(self, error_message: str) -> Dict[str, Any]:
        """Create a standardized error result."""
        return {
            "result": ValidationResult.NEEDS_GUIDANCE.value,
            "is_correct": False,
            "feedback": "I'm having trouble understanding that step. Let's try again!",
            "hint": "Take your time and try the next logical step.",
            "mistake_type": "validation_error",
            "guidance_level": "gentle",
            "error": error_message
        }
    
    def generate_success_message(self, tool_type: str, problem: str, performance_metrics: Dict[str, Any]) -> str:
        """Generate encouraging success message based on performance."""
        steps_taken = performance_metrics.get("steps_taken", 0)
        mistakes_made = performance_metrics.get("mistakes_made", 0)
        
        if mistakes_made == 0:
            return f"🌟 Perfect! You solved {problem} with no mistakes!"
        elif mistakes_made == 1:
            return f"🎉 Great job! You solved {problem} and learned from one small mistake!"
        else:
            return f"✅ Well done! You kept trying and solved {problem} successfully!"
    
    def get_learning_insights(self, validation_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze validation history to provide learning insights."""
        if not validation_history:
            return {"insights": [], "recommendations": []}
        
        mistake_types = [v.get("mistake_type") for v in validation_history if v.get("mistake_type")]
        common_mistakes = {}
        for mistake in mistake_types:
            if mistake:
                common_mistakes[mistake] = common_mistakes.get(mistake, 0) + 1
        
        insights = []
        recommendations = []
        
        if "wrong_direction" in common_mistakes:
            insights.append("Student sometimes confuses addition and subtraction directions")
            recommendations.append("Practice more direction awareness exercises")
        
        if "skipping_numbers" in common_mistakes:
            insights.append("Student tends to skip steps in counting")
            recommendations.append("Emphasize one-step-at-a-time approach")
        
        return {
            "insights": insights,
            "recommendations": recommendations,
            "mistake_frequency": common_mistakes,
            "total_validations": len(validation_history)
        }