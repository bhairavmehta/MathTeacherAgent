"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ValidationUtils } from "./ValidationActions";

interface NumberLineProps {
  problem: string;
  start?: number;
  end?: number;
  operation: "addition" | "subtraction";
  onAnswer: (answer: number, messageHistory?: string[]) => void;
  demoMode?: boolean;
  onDemoComplete?: () => void;
  sendIntermediateMessage?: (message: string) => void;
  onDemoPause?: (demoState: DemoState) => void;
  onDemoResume?: () => void;
}

interface DemoState {
  currentStep: number;
  nextStepDelay: number;
  pauseReason?: string;
  resumeAt?: number;
}

export function NumberLine({ 
  problem, 
  start = 0, 
  end = 20, 
  operation,
  onAnswer,
  demoMode = false,
  onDemoComplete,
  sendIntermediateMessage,
  onDemoPause,
  onDemoResume
}: NumberLineProps) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [steps, setSteps] = useState<number[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [demoStep, setDemoStep] = useState(0);
  const [demoExplanation, setDemoExplanation] = useState("");
  const [isDemoComplete, setIsDemoComplete] = useState(false);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  
  // Demo pause/resume state
  const [isDemoPaused, setIsDemoPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string>("");
  const [savedDemoState, setSavedDemoState] = useState<DemoState | null>(null);
  const [resumeRequested, setResumeRequested] = useState(false);

  // Step validation state
  const [validationInProgress, setValidationInProgress] = useState(false);
  const [stepFeedback, setStepFeedback] = useState<string>("");
  const [lastValidationResult, setLastValidationResult] = useState<any>(null);
  const [validatedSteps, setValidatedSteps] = useState<Set<number>>(new Set());
  const [showValidationFeedback, setShowValidationFeedback] = useState(false);

  // Parse the problem to get numbers
  const parseNumbers = (problem: string) => {
    console.log("🔍 NumberLine parseNumbers called with:", { problem, type: typeof problem });
    
    // Add defensive check for undefined/null problem
    if (!problem || typeof problem !== 'string') {
      console.warn("⚠️ NumberLine: problem is not a valid string:", problem);
      return null;
    }
    
    const match = problem.match(/(\d+)\s*[+\-]\s*(\d+)/);
    console.log("🔍 NumberLine parseNumbers match result:", match);
    
    if (match) {
      const result = {
        firstNumber: parseInt(match[1]),
        secondNumber: parseInt(match[2]),
        operator: problem.includes('+') ? '+' : '-'
      };
      console.log("🔍 NumberLine parseNumbers result:", result);
      return result;
    }
    
    console.warn("⚠️ NumberLine: Could not parse problem:", problem);
    return null;
  };

  const numbers = useMemo(() => parseNumbers(problem), [problem]);
  const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  // Helper function to send message and collect it in history
  const sendAndCollectMessage = (message: string) => {
    const cleanMessage = message.replace('📍 ', '');
    setMessageHistory(prev => [...prev, cleanMessage]);
    
    if (sendIntermediateMessage) {
      sendIntermediateMessage(message);
    }
  };

  // Demo control functions
  const pauseDemo = (reason: string = "User query") => {
    if (!demoMode || isDemoComplete) return;
    
    console.log(`🛑 [DEMO PAUSE] Pausing demo at step ${demoStep}, reason: ${reason}`);
    
    const currentState: DemoState = {
      currentStep: demoStep,
      nextStepDelay: demoStep === 0 ? 2000 : 1200, // Match original timing
      pauseReason: reason,
      resumeAt: Date.now()
    };
    
    setIsDemoPaused(true);
    setPauseReason(reason);
    setSavedDemoState(currentState);
    
    if (onDemoPause) {
      onDemoPause(currentState);
    }
    
    // Send pause notification
    sendAndCollectMessage(`📍 🛑 Demo paused - ${reason}`);
  };

  const resumeDemo = () => {
    if (!savedDemoState) return;
    
    console.log(`▶️ [DEMO RESUME] Resuming demo from step ${savedDemoState.currentStep}`);
    
    setIsDemoPaused(false);
    setPauseReason("");
    setResumeRequested(true);
    
    if (onDemoResume) {
      onDemoResume();
    }
    
    // Send resume notification
    sendAndCollectMessage(`📍 ▶️ Demo resuming...`);
    
    // Continue from where we left off
    setTimeout(() => {
      setResumeRequested(false);
      setDemoStep(savedDemoState.currentStep);
    }, 500);
  };

  // Expose pause/resume functions for external control
  useEffect(() => {
    // Create global functions for external control
    if (typeof window !== 'undefined') {
      (window as any).__numberLineDemoControl = {
        pause: pauseDemo,
        resume: resumeDemo,
        isPaused: isDemoPaused,
        currentStep: demoStep
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__numberLineDemoControl;
      }
    };
  }, [isDemoPaused, demoStep]);

  // Setup validation callback for step validation results
  useEffect(() => {
    if (!demoMode && numbers) {
      // Register callback for validation results
      ValidationUtils.registerCallback("number_line", problem, (result) => {
        console.log("🔍 [VALIDATION RESULT] Received:", result);
        setLastValidationResult(result);
        setStepFeedback(result.feedback || "");
        setShowValidationFeedback(true);
        setValidationInProgress(false);

        // Auto-hide feedback after 3 seconds for positive results
        if (result.is_correct) {
          setTimeout(() => {
            setShowValidationFeedback(false);
          }, 3000);
        }
      });

      return () => {
        ValidationUtils.unregisterCallback("number_line", problem);
      };
    }
  }, [demoMode, problem, numbers]);

  // Validation function for step validation in manual mode
  const validateStep = useCallback(async (proposedStep: number, currentSteps: number[]) => {
    if (demoMode || !numbers) return true; // Skip validation in demo mode

    console.log("🔍 [STEP VALIDATION] Validating step:", proposedStep, "with current steps:", currentSteps);
    
    setValidationInProgress(true);
    setShowValidationFeedback(false);

    try {
      // Create expected sequence
      const { firstNumber, secondNumber, operator } = numbers;
      const expectedSequence = [];
      const direction = operator === '+' ? 1 : -1;
      
      for (let i = 0; i <= secondNumber; i++) {
        expectedSequence.push(firstNumber + (direction * i));
      }

      // Trigger validation through ValidationUtils
      const result = await ValidationUtils.triggerValidation(
        "number_line",
        problem,
        operation,
        {
          current_steps: currentSteps,
          proposed_step: proposedStep,
          expected_sequence: expectedSequence
        }
      );

      return result.is_correct;
    } catch (error) {
      console.error("🔍 [VALIDATION ERROR]", error);
      setValidationInProgress(false);
      setStepFeedback("I'm having trouble validating that step. Let's keep going!");
      setShowValidationFeedback(true);
      return true; // Allow progression on validation error
    }
  }, [demoMode, numbers, problem, operation]);

  // Send initial instruction when component first loads
  useEffect(() => {
    if (!sendIntermediateMessage || !numbers) return;
    
    if (demoMode) {
      sendAndCollectMessage("📍 Watch as I demonstrate the solution step by step!");
    } else {
      sendAndCollectMessage(`📍 Click on ${numbers.firstNumber} to start!`);
    }
  }, []); // Only run once on mount

  // Demo mode effect
  useEffect(() => {
    // Don't run demo if paused, complete, or resuming
    if (!demoMode || !numbers || isDemoComplete || isDemoPaused || resumeRequested) return;

    let timeoutId: NodeJS.Timeout;

    const runDemo = async () => {
      const { firstNumber, secondNumber, operator } = numbers;
      
      if (demoStep === 0) {
        // Step 1: Highlight starting number
        const message = `Let's start at ${firstNumber}! 👈`;
        setDemoExplanation(message);
        setSelectedNumber(firstNumber);
        setSteps([firstNumber]);
        
        // Send message immediately to chat
        sendAndCollectMessage(`📍 ${message}`);
        
        timeoutId = setTimeout(() => setDemoStep(1), 2000);
      } else if (demoStep <= secondNumber) {
        // Step 2-N: Move step by step
        const direction = operator === '+' ? 1 : -1;
        const currentPosition = firstNumber + (direction * (demoStep - 1));
        const nextPosition = firstNumber + (direction * demoStep);
        
        let message;
        if (demoStep === 1) {
          message = `Now let's ${operator === '+' ? 'add' : 'subtract'} ${secondNumber} step by step...`;
        } else {
          message = `Step ${demoStep}: Moving to ${nextPosition}... ${operator === '+' ? '➡️' : '⬅️'}`;
        }
        
        setDemoExplanation(message);
        setSteps(prev => [...prev, nextPosition]);
        
        // Send message immediately to chat
        sendAndCollectMessage(`📍 ${message}`);
        timeoutId = setTimeout(() => setDemoStep(demoStep + 1), 1200);
      } else {
        // Final step: Show result
        const result = operator === '+' ? firstNumber + secondNumber : firstNumber - secondNumber;
        const finalMessage = `🎉 Done! ${firstNumber} ${operator} ${secondNumber} = ${result}`;
        setDemoExplanation(finalMessage);
        setIsDemoComplete(true);
        
        // Send final message immediately to chat
        sendAndCollectMessage(`📍 ${finalMessage}`);
        
        // Auto-submit the answer and call completion callback
        setTimeout(() => {
          // Add final completion message
          sendAndCollectMessage(`📍 ✅ Great job! We successfully solved ${problem} and got ${result}!`);
          
          // Small delay to ensure final message is sent before completion
          setTimeout(() => {
            onAnswer(result, messageHistory);
            onDemoComplete?.();
          }, 500);
        }, 2000);
      }
    };

    runDemo();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [demoMode, demoStep, numbers, isDemoComplete, isDemoPaused, resumeRequested]);


  const handleNumberClick = async (num: number) => {
    if (!numbers || validationInProgress) return;

    // Skip validation in demo mode or proceed with validation in manual mode
    if (!demoMode) {
      // First validate the step
      const isValidStep = await validateStep(num, steps);
      
      // Mark this step as validated if correct
      if (isValidStep) {
        setValidatedSteps(prev => new Set([...prev, num]));
      } else {
        // Invalid step - validation feedback will be shown automatically
        return;
      }
    }

    if (selectedNumber === null) {
      // First click - select starting number
      if (num === numbers.firstNumber) {
        setSelectedNumber(num);
        setSteps([num]);
        setCurrentStep(1);
        
        // Send immediate message for first selection
        const remaining = numbers.secondNumber;
        const message = `Great! Now count ${operation === 'addition' ? 'forward' : 'backward'} ${remaining} more step${remaining > 1 ? 's' : ''}`;
        sendAndCollectMessage(`📍 ${message}`);
      } else if (!demoMode) {
        // Wrong starting number - validation will handle feedback
        return;
      }
    } else {
      // Subsequent clicks - build the path
      const lastStep = steps[steps.length - 1];
      
      if (operation === "addition" && num === lastStep + 1) {
        const newSteps = [...steps, num];
        setSteps(newSteps);
        
        // Send immediate progress message (only if not validation feedback is showing)
        if (!showValidationFeedback) {
          const remaining = numbers.secondNumber - (newSteps.length - 1);
          if (remaining > 0) {
            const message = `Great! Now count forward ${remaining} more step${remaining > 1 ? 's' : ''}`;
            sendAndCollectMessage(`📍 ${message}`);
          } else {
            sendAndCollectMessage(`📍 You did it! 🎉`);
          }
        }
        
        if (newSteps.length - 1 === numbers.secondNumber) {
          // Completed the addition
          setTimeout(() => {
            sendAndCollectMessage(`📍 ✅ Excellent! You successfully solved ${numbers.firstNumber} + ${numbers.secondNumber} = ${num}!`);
            setTimeout(() => {
              onAnswer(num, messageHistory);
            }, 300);
          }, 500);
        }
      } else if (operation === "subtraction" && num === lastStep - 1) {
        const newSteps = [...steps, num];
        setSteps(newSteps);
        
        // Send immediate progress message (only if not validation feedback is showing)
        if (!showValidationFeedback) {
          const remaining = numbers.secondNumber - (newSteps.length - 1);
          if (remaining > 0) {
            const message = `Great! Now count backward ${remaining} more step${remaining > 1 ? 's' : ''}`;
            sendAndCollectMessage(`📍 ${message}`);
          } else {
            sendAndCollectMessage(`📍 You did it! 🎉`);
          }
        }
        
        if (newSteps.length - 1 === numbers.secondNumber) {
          // Completed the subtraction
          setTimeout(() => {
            sendAndCollectMessage(`📍 ✅ Excellent! You successfully solved ${numbers.firstNumber} - ${numbers.secondNumber} = ${num}!`);
            setTimeout(() => {
              onAnswer(num, messageHistory);
            }, 300);
          }, 500);
        }
      } else if (!demoMode) {
        // Wrong step - validation will handle feedback
        return;
      }
    }
  };

  const handleReset = () => {
    setSelectedNumber(null);
    setSteps([]);
    setCurrentStep(0);
    // Clear validation state
    setValidatedSteps(new Set());
    setShowValidationFeedback(false);
    setStepFeedback("");
    setLastValidationResult(null);
  };

  const getInstructions = () => {
    // Demo mode instructions
    if (demoMode) {
      if (demoExplanation) {
        return demoExplanation;
      }
      return "Watch as I demonstrate the solution step by step! 👀";
    }

    // Manual mode instructions
    if (!numbers) {
      if (!problem || typeof problem !== 'string') {
        return "⚠️ Invalid problem data. Please check the input.";
      }
      return "Click on the numbers to solve the problem!";
    }
    
    if (selectedNumber === null) {
      return `Click on ${numbers.firstNumber} to start!`;
    }
    
    if (operation === "addition") {
      const remaining = numbers.secondNumber - (steps.length - 1);
      if (remaining > 0) {
        return `Great! Now count forward ${remaining} more step${remaining > 1 ? 's' : ''}`;
      }
    } else {
      const remaining = numbers.secondNumber - (steps.length - 1);
      if (remaining > 0) {
        return `Great! Now count backward ${remaining} more step${remaining > 1 ? 's' : ''}`;
      }
    }
    
    return "You did it! 🎉";
  };

  // Note: Removed useEffect-based messaging in favor of direct messaging
  // Messages are now sent immediately when state changes occur

  const isNumberInPath = (num: number) => steps.includes(num);
  const isCurrentPosition = (num: number) => num === steps[steps.length - 1];
  const isStartingNumber = (num: number) => numbers && num === numbers.firstNumber;

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto border">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {demoMode ? "🎬 AI Number Line Demo" : "📏 Number Line Helper"}
        </h2>
        <div className="text-lg font-semibold text-blue-600 mb-2">
          {problem || "⚠️ No problem provided"}
        </div>
        {(!problem || typeof problem !== 'string') && (
          <div className="text-sm text-red-600 mb-2">
            Debug: problem = {JSON.stringify(problem)}, type = {typeof problem}
          </div>
        )}
        <p className={`text-gray-600 ${demoMode ? 'text-lg font-medium' : ''}`}>
          {getInstructions()}
        </p>
        {demoMode && !isDemoComplete && (
          <div className="mt-2 space-y-2">
            <div className="text-sm text-gray-500">
              {isDemoPaused ? (
                <div className="flex items-center gap-2 text-orange-600">
                  <span className="animate-pulse">🛑</span>
                  Demo paused - {pauseReason}
                  <span className="text-xs bg-orange-100 px-2 py-1 rounded">
                    Will resume after your question
                  </span>
                </div>
              ) : resumeRequested ? (
                <div className="flex items-center gap-2 text-green-600">
                  <span className="animate-bounce">▶️</span>
                  Demo resuming...
                </div>
              ) : (
                "I'm demonstrating each step automatically..."
              )}
            </div>
            
            {/* Interruption availability indicator */}
            {!isDemoPaused && !resumeRequested && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-blue-700">
                    💬 Type questions in chat anytime during the demo!
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step Validation Feedback - only in manual mode */}
        {!demoMode && showValidationFeedback && stepFeedback && (
          <div className={`mt-4 p-3 rounded-lg border ${
            lastValidationResult?.is_correct 
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                {validationInProgress ? (
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                ) : lastValidationResult?.is_correct ? (
                  <span className="text-green-600">✅</span>
                ) : (
                  <span className="text-red-600">❌</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">{stepFeedback}</p>
                {lastValidationResult?.hint && (
                  <p className="text-sm mt-1 opacity-90">{lastValidationResult.hint}</p>
                )}
              </div>
              {!validationInProgress && (
                <button
                  onClick={() => setShowValidationFeedback(false)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Manual mode validation indicator */}
        {!demoMode && !validationInProgress && (
          <div className="mt-3 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Smart step validation active - I'll guide you!</span>
            </div>
          </div>
        )}
      </div>

      <div className="mb-8 overflow-x-auto">
        <div className="flex items-center justify-center min-w-max px-4">
          {range.map((num, index) => (
            <div key={num} className="flex flex-col items-center">
              {/* Number circle */}
              <button
                onClick={() => !demoMode && handleNumberClick(num)}
                disabled={demoMode || validationInProgress}
                className={`
                  w-12 h-12 rounded-full border-2 font-bold text-lg transition-all duration-200 mb-2 relative
                  ${isCurrentPosition(num) 
                    ? 'bg-red-500 text-white border-red-500 shadow-lg scale-110' 
                    : isNumberInPath(num)
                    ? 'bg-blue-500 text-white border-blue-500'
                    : validatedSteps.has(num) && !demoMode
                    ? 'bg-green-500 text-white border-green-500 shadow-md'
                    : isStartingNumber(num) && selectedNumber === null
                    ? 'bg-green-100 border-green-500 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }
                  ${selectedNumber !== null && num === steps[steps.length - 1] + (operation === 'addition' ? 1 : -1)
                    ? 'ring-4 ring-yellow-300 hover:bg-yellow-100'
                    : ''
                  }
                  ${validationInProgress ? 'opacity-50 cursor-wait' : ''}
                `}
              >
                {/* Validation indicator overlay */}
                {!demoMode && validatedSteps.has(num) && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                    <span className="text-xs">✓</span>
                  </div>
                )}
                {validationInProgress && num === steps[steps.length - 1] + (operation === 'addition' ? 1 : -1) && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                {num}
              </button>
              
              {/* Connection line */}
              {index < range.length - 1 && (
                <div className={`
                  w-8 h-1 -mt-6 mb-6
                  ${isNumberInPath(num) && isNumberInPath(range[index + 1])
                    ? 'bg-blue-500'
                    : 'bg-gray-300'
                  }
                `} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Progress indicator */}
      {numbers && selectedNumber !== null && (
        <div className="mb-6">
          <div className="bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ 
                width: `${((steps.length - 1) / numbers.secondNumber) * 100}%` 
              }}
            />
          </div>
          <div className="text-center text-sm text-gray-600">
            Progress: {steps.length - 1} of {numbers.secondNumber} steps
          </div>
        </div>
      )}

      {/* Control buttons */}
      {!demoMode && (
        <div className="flex justify-center gap-4">
          <button
            onClick={handleReset}
            className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            🔄 Reset
          </button>
          
          {steps.length > 1 && (
            <button
              onClick={() => {
                const finalAnswer = steps[steps.length - 1];
                sendAndCollectMessage(`📍 ✅ Great! You chose ${finalAnswer} as your final answer!`);
                setTimeout(() => {
                  onAnswer(finalAnswer, messageHistory);
                }, 300);
              }}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              ✓ Submit Answer: {steps[steps.length - 1]}
            </button>
          )}
        </div>
      )}

      {/* Demo completion message */}
      {demoMode && isDemoComplete && (
        <div className="text-center">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            🎉 Demo complete! Now you can try practicing on your own.
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-100 border-2 border-green-500"></div>
          <span>Start Here</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          <span>Your Path</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span>Current Position</span>
        </div>
      </div>
    </div>
  );
}