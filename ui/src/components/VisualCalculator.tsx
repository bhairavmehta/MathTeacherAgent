"use client";

import { useState, useEffect, useCallback } from "react";
import { ValidationUtils } from "./ValidationActions";

interface VisualCalculatorProps {
  onCalculate: (expression: string, result: number) => void;
}

export function VisualCalculator({ onCalculate }: VisualCalculatorProps) {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [isResult, setIsResult] = useState(false);
  
  // Validation state
  const [operationSequence, setOperationSequence] = useState<string[]>([]);
  const [validationFeedback, setValidationFeedback] = useState<string>("");

  const handleNumber = (num: string) => {
    if (isResult) {
      setDisplay(num);
      setExpression(num);
      setIsResult(false);
      setOperationSequence([num]);
    } else {
      const newDisplay = display === "0" ? num : display + num;
      setDisplay(newDisplay);
      setExpression(prev => prev + num);
      setOperationSequence(prev => [...prev, num]);
    }
  };

  const handleOperator = (op: string) => {
    if (isResult) {
      setExpression(display + ` ${op} `);
      setIsResult(false);
      setOperationSequence([display, op]);
    } else {
      setExpression(prev => prev + ` ${op} `);
      setOperationSequence(prev => [...prev, op]);
    }
    setDisplay("0");
  };

  const handleCalculate = () => {
    try {
      // Replace visual operators with JavaScript operators
      const jsExpression = expression
        .replace(/×/g, '*')
        .replace(/÷/g, '/');
      
      const result = eval(jsExpression);
      setDisplay(result.toString());
      onCalculate(expression, result);
      setIsResult(true);
    } catch (error) {
      setDisplay("Error");
      setExpression("");
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setExpression("");
    setIsResult(false);
    setOperationSequence([]);
    setValidationFeedback("");
  };

  const Button = ({ 
    children, 
    onClick, 
    className = "", 
    variant = "default" 
  }: {
    children: React.ReactNode;
    onClick: () => void;
    className?: string;
    variant?: "default" | "operator" | "equals" | "clear";
  }) => {
    const baseClasses = "font-semibold text-lg rounded-lg transition-all duration-150 active:scale-95";
    
    const variantClasses = {
      default: "bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300",
      operator: "bg-blue-500 hover:bg-blue-600 text-white border border-blue-600",
      equals: "bg-green-500 hover:bg-green-600 text-white border border-green-600",
      clear: "bg-red-500 hover:bg-red-600 text-white border border-red-600"
    };

    return (
      <button
        onClick={onClick}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      >
        {children}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm mx-auto border">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          🧮 Calculator Helper
        </h2>
        <p className="text-gray-600 text-sm">
          Use this calculator to help solve problems!
        </p>
      </div>

      {/* Basic validation feedback */}
      {validationFeedback && (
        <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          <div className="flex items-center gap-2">
            <span>💡</span>
            <span>{validationFeedback}</span>
          </div>
        </div>
      )}

      {/* Smart validation indicator for calculator */}
      {expression && !isResult && (
        <div className="mb-4 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Smart calculation tracking active!</span>
          </div>
        </div>
      )}

      {/* Display */}
      <div className="bg-gray-900 rounded-lg p-4 mb-4">
        <div className="text-right">
          {expression && (
            <div className="text-gray-400 text-sm mb-1 h-4">
              {expression}
            </div>
          )}
          <div className="text-white text-2xl font-mono">
            {display}
          </div>
        </div>
      </div>

      {/* Button Grid */}
      <div className="grid grid-cols-4 gap-3">
        {/* Row 1 */}
        <Button onClick={handleClear} variant="clear" className="col-span-2 py-3">
          Clear
        </Button>
        <Button onClick={() => handleOperator("÷")} variant="operator" className="py-3">
          ÷
        </Button>
        <Button onClick={() => handleOperator("×")} variant="operator" className="py-3">
          ×
        </Button>

        {/* Row 2 */}
        <Button onClick={() => handleNumber("7")} className="py-3">
          7
        </Button>
        <Button onClick={() => handleNumber("8")} className="py-3">
          8
        </Button>
        <Button onClick={() => handleNumber("9")} className="py-3">
          9
        </Button>
        <Button onClick={() => handleOperator("-")} variant="operator" className="py-3">
          −
        </Button>

        {/* Row 3 */}
        <Button onClick={() => handleNumber("4")} className="py-3">
          4
        </Button>
        <Button onClick={() => handleNumber("5")} className="py-3">
          5
        </Button>
        <Button onClick={() => handleNumber("6")} className="py-3">
          6
        </Button>
        <Button onClick={() => handleOperator("+")} variant="operator" className="py-3">
          +
        </Button>

        {/* Row 4 */}
        <Button onClick={() => handleNumber("1")} className="py-3">
          1
        </Button>
        <Button onClick={() => handleNumber("2")} className="py-3">
          2
        </Button>
        <Button onClick={() => handleNumber("3")} className="py-3">
          3
        </Button>
        <Button onClick={handleCalculate} variant="equals" className="row-span-2 py-3">
          =
        </Button>

        {/* Row 5 */}
        <Button onClick={() => handleNumber("0")} className="col-span-2 py-3">
          0
        </Button>
        <Button onClick={() => handleNumber(".")} className="py-3">
          .
        </Button>
      </div>

      {/* Send to Teacher Button */}
      {isResult && (
        <div className="mt-4">
          <button
            onClick={() => onCalculate(expression, parseFloat(display))}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            📤 Send to Teacher
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 text-center text-xs text-gray-500">
        💡 Calculate your answer and send it to your teacher!
      </div>
    </div>
  );
}