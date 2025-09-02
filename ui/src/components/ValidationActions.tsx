"use client";

import { useCopilotAction } from "@copilotkit/react-core";
import { useCallback, useRef } from "react";
import { logger } from "@/utils/logger";

// Global validation callbacks registry
const validationCallbacks = new Map<string, (result: any) => void>();

export function ValidationActions() {
  const pendingValidations = useRef(new Set<string>());

  // Action to handle step validation requests from tools
  useCopilotAction({
    name: "validate_learning_step",
    description: "Validate a learning step taken by the student in an interactive tool",
    parameters: [
      {
        name: "tool_type",
        type: "string",
        description: "Type of tool being used (number_line, practice_problem, calculator)",
        required: true,
      },
      {
        name: "problem",
        type: "string", 
        description: "The math problem being worked on (e.g., '5 + 3')",
        required: true,
      },
      {
        name: "operation",
        type: "string",
        description: "The operation type (addition, subtraction, multiplication, division)",
        required: true,
      },
      {
        name: "validation_data",
        type: "object",
        description: "Step-specific validation data",
        required: true,
      },
    ],
    handler: async (args: any) => {
      const { tool_type, problem, operation, validation_data } = args;
      
      logger.info('ValidationActions', 'validation_step_received', {
        tool_type,
        problem,
        operation,
        validation_data
      });

      try {
        // Create validation request ID
        const validationId = `${tool_type}_${problem}_${Date.now()}`;
        
        // Mark validation as pending
        pendingValidations.current.add(validationId);

        // Process validation (this would typically go to backend)
        const validationResult = await processValidationLocally(
          tool_type,
          problem,
          operation,
          validation_data
        );

        // Remove from pending
        pendingValidations.current.delete(validationId);

        // Find and call the appropriate callback
        const callbackKey = `${tool_type}_${problem}`;
        const callback = validationCallbacks.get(callbackKey);
        
        if (callback) {
          callback(validationResult);
          logger.info('ValidationActions', 'validation_callback_executed', {
            validationId,
            result: validationResult.result
          });
        }

        return `Validation completed: ${validationResult.feedback}`;
        
      } catch (error) {
        logger.error('ValidationActions', 'validation_error', { 
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Provide fallback validation result
        const fallbackResult = {
          result: "needs_guidance",
          is_correct: false,
          feedback: "I'm having trouble validating that step. Let's keep going!",
          hint: "Continue with the next step in your learning.",
          mistake_type: "validation_error",
          guidance_level: "gentle"
        };

        const callbackKey = `${tool_type}_${problem}`;
        const callback = validationCallbacks.get(callbackKey);
        if (callback) {
          callback(fallbackResult);
        }

        return "Validation completed with fallback guidance";
      }
    },
  });

  // This component doesn't render anything - it just handles validation actions
  return null;
}

// Local validation processing (can be enhanced to call backend)
async function processValidationLocally(
  tool_type: string,
  problem: string,
  operation: string,
  validation_data: any
): Promise<any> {
  
  // Simulate processing delay for realistic UX
  await new Promise(resolve => setTimeout(resolve, 200));
  
  logger.info('ValidationActions', 'processing_local_validation', {
    tool_type,
    problem,
    operation,
    validation_data
  });

  try {
    if (tool_type === "number_line") {
      return validateNumberLineStep(problem, operation, validation_data);
    } else if (tool_type === "practice_problem") {
      return validatePracticeStep(problem, operation, validation_data);
    } else if (tool_type === "calculator") {
      return validateCalculatorStep(validation_data);
    } else {
      throw new Error(`Unknown tool type: ${tool_type}`);
    }
  } catch (error) {
    logger.error('ValidationActions', 'local_validation_error', { 
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Number line step validation
function validateNumberLineStep(
  problem: string,
  operation: string,
  validation_data: any
): any {
  const { current_steps, proposed_step } = validation_data;
  
  // Parse problem to get expected values
  const match = problem.match(/(\d+)\s*([+\-])\s*(\d+)/);
  if (!match) {
    throw new Error("Could not parse math problem");
  }
  
  const firstNum = parseInt(match[1]);
  const operator = match[2];
  const secondNum = parseInt(match[3]);
  
  // First step validation
  if (current_steps.length === 0) {
    if (proposed_step === firstNum) {
      return {
        result: "correct",
        is_correct: true,
        feedback: `Perfect! You started at ${firstNum}. Now let's count ${operator === '+' ? 'forward' : 'backward'}!`,
        hint: `Great start! Next, click on ${firstNum + (operator === '+' ? 1 : -1)}.`,
        mistake_type: null,
        guidance_level: "encouraging"
      };
    } else {
      return {
        result: "incorrect",
        is_correct: false,
        feedback: `Let's start at the first number: ${firstNum}`,
        hint: `Click on ${firstNum} to begin the problem.`,
        mistake_type: "wrong_starting_number",
        guidance_level: "specific"
      };
    }
  }
  
  // Subsequent step validation
  const lastPosition = current_steps[current_steps.length - 1];
  const expectedNext = lastPosition + (operator === '+' ? 1 : -1);
  const stepsTaken = current_steps.length - 1;
  
  if (proposed_step === expectedNext) {
    const remainingSteps = secondNum - stepsTaken - 1;
    
    if (remainingSteps <= 0) {
      // Problem completed!
      const finalAnswer = firstNum + (operator === '+' ? secondNum : -secondNum);
      return {
        result: "correct",
        is_correct: true,
        feedback: `🎉 Fantastic! You solved ${problem} = ${finalAnswer}!`,
        hint: "Excellent work! You completed the problem step by step.",
        mistake_type: null,
        guidance_level: "celebration",
        problem_completed: true,
        final_answer: finalAnswer
      };
    } else {
      return {
        result: "correct", 
        is_correct: true,
        feedback: `Great! Keep going - ${remainingSteps} more step${remainingSteps > 1 ? 's' : ''}.`,
        hint: `Perfect! Now click on ${expectedNext + (operator === '+' ? 1 : -1)}.`,
        mistake_type: null,
        guidance_level: "encouraging",
        remaining_steps: remainingSteps
      };
    }
  } else {
    // Analyze the mistake
    if (operator === '+' && proposed_step > expectedNext) {
      return {
        result: "incorrect",
        is_correct: false,
        feedback: "Slow down! Let's count one step at a time.",
        hint: `Try clicking on ${expectedNext} instead of ${proposed_step}.`,
        mistake_type: "skipping_numbers",
        guidance_level: "gentle"
      };
    } else if (operator === '+' && proposed_step < lastPosition) {
      return {
        result: "incorrect",
        is_correct: false,
        feedback: "For addition, we count forward (to the right)!",
        hint: `Click on ${expectedNext} to continue counting forward.`,
        mistake_type: "wrong_direction",
        guidance_level: "specific"
      };
    } else {
      const direction = operator === '+' ? "forward" : "backward";
      return {
        result: "incorrect",
        is_correct: false,
        feedback: `Not quite! Let's count ${direction} one number at a time.`,
        hint: `Click on ${expectedNext} to continue.`,
        mistake_type: "incorrect_sequence", 
        guidance_level: "helpful"
      };
    }
  }
}

// Practice problem step validation
function validatePracticeStep(
  problem: string,
  operation: string,
  validation_data: any
): any {
  const { user_input, step_number } = validation_data;
  
  if (!user_input || !user_input.trim()) {
    return {
      result: "needs_guidance",
      is_correct: false,
      feedback: "Please enter your answer to continue.",
      hint: "Take your time and think about the problem step by step.",
      mistake_type: null,
      guidance_level: "gentle"
    };
  }
  
  // Parse user input
  let userAnswer;
  try {
    userAnswer = parseFloat(user_input.trim());
  } catch {
    return {
      result: "incorrect",
      is_correct: false,
      feedback: "Please enter a valid number.",
      hint: "Make sure you're entering just the number, like '8' or '12'.",
      mistake_type: "invalid_input",
      guidance_level: "specific"
    };
  }
  
  // Calculate correct answer
  const match = problem.match(/(\d+)\s*([+\-*\/])\s*(\d+)/);
  if (!match) {
    throw new Error("Could not parse math problem");
  }
  
  const firstNum = parseFloat(match[1]);
  const operator = match[2];
  const secondNum = parseFloat(match[3]);
  
  let correctAnswer;
  switch (operator) {
    case '+':
      correctAnswer = firstNum + secondNum;
      break;
    case '-':
      correctAnswer = firstNum - secondNum;
      break;
    case '*':
      correctAnswer = firstNum * secondNum;
      break;
    case '/':
      correctAnswer = firstNum / secondNum;
      break;
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
  
  // Check if answer is correct
  if (Math.abs(userAnswer - correctAnswer) < 0.01) {
    return {
      result: "correct",
      is_correct: true,
      feedback: `🎉 Excellent! ${problem} = ${correctAnswer}`,
      hint: "Great job! You solved it correctly!",
      mistake_type: null,
      guidance_level: "celebration",
      correct_answer: correctAnswer
    };
  }
  
  // Analyze common mistakes
  if (operator === '+' && (userAnswer === firstNum || userAnswer === secondNum)) {
    return {
      result: "incorrect",
      is_correct: false,
      feedback: "You entered one of the numbers from the problem. For addition, we need to add them together!",
      hint: `Try adding ${firstNum} + ${secondNum}. What do you get?`,
      mistake_type: "not_adding",
      guidance_level: "specific"
    };
  }
  
  return {
    result: "incorrect",
    is_correct: false,
    feedback: `Not quite right. The correct answer is ${correctAnswer}.`,
    hint: `Try working through ${problem} step by step.`,
    mistake_type: "incorrect_calculation",
    guidance_level: step_number === 1 ? "gentle" : "specific",
    correct_answer: correctAnswer
  };
}

// Calculator step validation
function validateCalculatorStep(validation_data: any): any {
  const { expression, operation_sequence } = validation_data;
  
  if (!expression || !expression.trim()) {
    return {
      result: "correct",
      is_correct: true,
      feedback: "Ready to calculate!",
      hint: "Enter your first number to get started.",
      guidance_level: "gentle"
    };
  }
  
  // Simple validation for now
  return {
    result: "correct",
    is_correct: true,
    feedback: "Looking good! Your calculation is on track.",
    hint: "Continue with your calculation.",
    guidance_level: "encouraging"
  };
}

// Utility functions for external components
export const ValidationUtils = {
  // Register a callback for validation results
  registerCallback: (tool_type: string, problem: string, callback: (result: any) => void) => {
    const key = `${tool_type}_${problem}`;
    validationCallbacks.set(key, callback);
    logger.info('ValidationActions', 'callback_registered', { key });
  },

  // Unregister a callback
  unregisterCallback: (tool_type: string, problem: string) => {
    const key = `${tool_type}_${problem}`;
    validationCallbacks.delete(key);
    logger.info('ValidationActions', 'callback_unregistered', { key });
  },

  // Trigger validation manually (for testing)
  triggerValidation: async (
    tool_type: string,
    problem: string,
    operation: string,
    validation_data: any
  ) => {
    try {
      const result = await processValidationLocally(tool_type, problem, operation, validation_data);
      const callbackKey = `${tool_type}_${problem}`;
      const callback = validationCallbacks.get(callbackKey);
      if (callback) {
        callback(result);
      }
      return result;
    } catch (error) {
      logger.error('ValidationActions', 'manual_validation_error', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
};