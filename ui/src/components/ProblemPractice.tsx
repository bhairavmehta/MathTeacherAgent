"use client";

import { useState, useEffect, useCallback } from "react";
import { ValidationUtils } from "./ValidationActions";

interface ProblemPracticeProps {
  problem: string;
  operation: string;
  onSubmit: (answer: number) => void;
}

export function ProblemPractice({ problem, operation, onSubmit }: ProblemPracticeProps) {
  const [answer, setAnswer] = useState<string>("");
  const [showHint, setShowHint] = useState(false);
  
  // Step validation state
  const [validationInProgress, setValidationInProgress] = useState(false);
  const [stepFeedback, setStepFeedback] = useState<string>("");
  const [lastValidationResult, setLastValidationResult] = useState<any>(null);
  const [showValidationFeedback, setShowValidationFeedback] = useState(false);
  const [stepNumber, setStepNumber] = useState(1);
  const [hasValidated, setHasValidated] = useState(false);

  // Setup validation callback for step validation results
  useEffect(() => {
    // Register callback for validation results
    ValidationUtils.registerCallback("practice_problem", problem, (result) => {
      console.log("🔍 [PRACTICE VALIDATION RESULT] Received:", result);
      setLastValidationResult(result);
      setStepFeedback(result.feedback || "");
      setShowValidationFeedback(true);
      setValidationInProgress(false);

      // If answer is correct, proceed with submission
      if (result.is_correct) {
        const numericAnswer = parseFloat(answer);
        setTimeout(() => {
          onSubmit(numericAnswer);
          setAnswer("");
          setShowHint(false);
          setShowValidationFeedback(false);
        }, 1500); // Show success feedback briefly
      }
    });

    return () => {
      ValidationUtils.unregisterCallback("practice_problem", problem);
    };
  }, [problem, answer, onSubmit]);

  // Validation function for practice answers
  const validateAnswer = useCallback(async (userInput: string) => {
    console.log("🔍 [PRACTICE VALIDATION] Validating answer:", userInput, "for problem:", problem);
    
    setValidationInProgress(true);
    setShowValidationFeedback(false);
    setHasValidated(true);

    try {
      // Trigger validation through ValidationUtils
      const result = await ValidationUtils.triggerValidation(
        "practice_problem",
        problem,
        operation,
        {
          user_input: userInput,
          step_number: stepNumber
        }
      );

      // Increment step number for next attempt
      if (!result.is_correct) {
        setStepNumber(prev => prev + 1);
      }

      return result.is_correct;
    } catch (error) {
      console.error("🔍 [PRACTICE VALIDATION ERROR]", error);
      setValidationInProgress(false);
      setStepFeedback("I'm having trouble validating that answer. Try submitting it!");
      setShowValidationFeedback(true);
      return true; // Allow submission on validation error
    }
  }, [problem, operation, stepNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!answer.trim()) return;

    // Validate the answer before submission
    await validateAnswer(answer.trim());
    
    // Note: If validation is correct, the callback will handle submission
    // If validation is incorrect, user stays on the form to try again
  };

  // Add a check answer button for immediate feedback
  const handleCheckAnswer = async () => {
    if (!answer.trim()) return;
    await validateAnswer(answer.trim());
  };

  const getHint = () => {
    switch (operation) {
      case "addition":
        return "💡 Hint: Start with the first number and count forward!";
      case "subtraction":
        return "💡 Hint: Start with the first number and count backward!";
      case "multiplication":
        return "💡 Hint: Think of this as repeated addition!";
      case "division":
        return "💡 Hint: How many groups can you make?";
      default:
        return "💡 Hint: Take your time and think it through!";
    }
  };

  const getOperationColor = () => {
    switch (operation) {
      case "addition":
        return "from-blue-400 to-blue-600";
      case "subtraction":
        return "from-green-400 to-green-600";
      case "multiplication":
        return "from-purple-400 to-purple-600";
      case "division":
        return "from-orange-400 to-orange-600";
      default:
        return "from-gray-400 to-gray-600";
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto border">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Solve This Problem! 🎯
        </h2>
        <p className="text-gray-600">
          Take your time and do your best!
        </p>
      </div>

      <div className={`bg-gradient-to-r ${getOperationColor()} rounded-lg p-6 mb-6`}>
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-2">
            {problem}
          </div>
          <div className="text-white/80 text-sm capitalize">
            {operation} Problem
          </div>
        </div>
      </div>

      {/* Step Validation Feedback */}
      {showValidationFeedback && stepFeedback && (
        <div className={`mb-4 p-3 rounded-lg border ${
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

      {/* Smart validation indicator */}
      {!validationInProgress && !showValidationFeedback && (
        <div className="mb-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Smart answer validation - I'll check your work!</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
            Your Answer:
          </label>
          <input
            id="answer"
            type="number"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              // Clear validation feedback when user changes answer
              if (hasValidated) {
                setShowValidationFeedback(false);
                setLastValidationResult(null);
              }
            }}
            className="w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
            placeholder="Enter your answer"
            autoFocus
            disabled={validationInProgress}
          />
        </div>

        <div className="flex gap-2">
          {/* Check Answer Button - for immediate validation feedback */}
          <button
            type="button"
            onClick={handleCheckAnswer}
            disabled={!answer.trim() || validationInProgress}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {validationInProgress ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Checking...
              </>
            ) : (
              <>🔍 Check Answer</>
            )}
          </button>
          
          {/* Submit Button - only shows if answer was validated as correct */}
          {lastValidationResult?.is_correct && (
            <button
              type="submit"
              disabled={!answer.trim() || validationInProgress}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              ✅ Submit Final Answer
            </button>
          )}
          
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            💡 Hint
          </button>
        </div>
      </form>

      {showHint && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            {getHint()}
          </p>
        </div>
      )}

      <div className="mt-6 text-center text-sm text-gray-500">
        💪 You've got this! Take your time and think it through.
      </div>
    </div>
  );
}