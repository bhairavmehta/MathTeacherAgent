"use client";

import { useToolContext } from '@/contexts/ToolContext';
import { NumberLine } from './NumberLine';
import { VisualCalculator } from './VisualCalculator';
import { ProblemPractice } from './ProblemPractice';
import { logger } from '@/utils/logger';
import { FrontendValidator, FrontendRateLimiter } from '@/utils/validation';

export function ToolDisplay() {
  const { activeToolConfig, isToolActive, clearActiveTool } = useToolContext();

  // Don't render anything if no tool is active
  if (!isToolActive || !activeToolConfig) {
    return null;
  }

  const { type, props, respond, sendIntermediateMessage, onDemoPause, onDemoResume } = activeToolConfig;

  // Helper function to handle tool completion
  const handleToolResponse = (method: string, problem: string, answer: any, messageHistory?: string[]) => {
    try {
      // Check rate limiting
      if (!FrontendRateLimiter.isAllowed()) {
        logger.error('ToolDisplay', 'rate_limit_exceeded', { 
          remainingCalls: FrontendRateLimiter.getRemainingCalls() 
        });
        alert('Please wait a moment before submitting another answer.');
        return;
      }

      // Handle message history vs simple responses differently
      if (messageHistory && messageHistory.length > 0) {
        // Call respond() with minimal completion signal to properly end the action
        const completionSignal = "✅";
        respond(completionSignal);
        
        logger.info('ToolDisplay', 'conversation_completed_with_minimal_response', { 
          messageCount: messageHistory.length,
          finalAnswer: answer,
          problem,
          method,
          completionSignal
        });
        return;
      }
      
      // For simple cases without message history, use traditional validation and response
      const responseMessage = FrontendValidator.createSecureResponseMessage(
        method, 
        problem, 
        answer
      );
      
      logger.info('ToolDisplay', 'validated_response_created', { 
        responseMessage,
        originalProblem: problem,
        originalAnswer: answer,
        toolType: type
      });
      
      // Send response but keep the tool visible
      respond(responseMessage);
      
      logger.info('ToolDisplay', 'tool_completed_response_sent', { 
        responseMessage,
        toolType: type,
        note: 'Tool remains visible until new tool is activated'
      });
    } catch (error) {
      logger.error('ToolDisplay', 'validation_or_response_failed', { 
        error: error instanceof Error ? error.message : String(error),
        problem,
        answer,
        toolType: type
      });
      
      // Provide fallback response
      try {
        const fallbackMessage = `I got ${answer} for ${problem}`;
        respond(fallbackMessage);
        logger.info('ToolDisplay', 'fallback_response_sent', { 
          fallbackMessage,
          note: 'Tool remains visible until new tool is activated'
        });
      } catch (fallbackError) {
        logger.error('ToolDisplay', 'fallback_response_failed', { fallbackError });
      }
    }
  };

  // Render the appropriate tool component
  const renderTool = () => {
    switch (type) {
      case 'number_line':
        return (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-blue-800">
              📊 Interactive Number Line
            </h3>
            <p className="text-blue-600 mb-4">
              Click on the numbers to solve <strong>{props.problem}</strong>!
            </p>
            <NumberLine
              key={`number_line_${props.problem}_${props.operation}_${Date.now()}`}
              problem={props.problem}
              operation={props.operation === "addition" ? "addition" : "subtraction"}
              start={props.start || 0}
              end={props.end || 20}
              demoMode={false}
              onAnswer={(answer, messageHistory) => {
                logger.info('ToolDisplay', 'number_line_answer', { answer, problem: props.problem });
                handleToolResponse("number_line", props.problem, answer, messageHistory);
              }}
              sendIntermediateMessage={sendIntermediateMessage}
              onDemoPause={onDemoPause}
              onDemoResume={onDemoResume}
            />
          </div>
        );

      case 'demonstrate_number_line':
        return (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-purple-800">
              🎬 AI Number Line Demo
            </h3>
            <p className="text-purple-600 mb-4">
              Watch as I demonstrate <strong>{props.problem}</strong> step by step!
            </p>
            <NumberLine
              key={`demo_number_line_${props.problem}_${props.operation}_${Date.now()}`}
              problem={props.problem}
              operation={props.operation === "addition" ? "addition" : "subtraction"}
              start={props.start || 0}
              end={props.end || 20}
              demoMode={true}
              onAnswer={(answer, messageHistory) => {
                logger.info('ToolDisplay', 'demo_number_line_completed', { answer, problem: props.problem });
                handleToolResponse("number_line", props.problem, answer, messageHistory);
              }}
              onDemoComplete={() => {
                logger.info('ToolDisplay', 'demo_animation_completed', { problem: props.problem });
              }}
              sendIntermediateMessage={sendIntermediateMessage}
              onDemoPause={onDemoPause}
              onDemoResume={onDemoResume}
            />
          </div>
        );

      case 'practice_problem':
        return (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-green-800">
              🎯 Practice Problem
            </h3>
            <p className="text-green-600 mb-4">
              Try solving this problem: <strong>{props.problem}</strong>
            </p>
            <ProblemPractice
              key={`practice_problem_${props.problem}_${props.operation}_${Date.now()}`}
              problem={props.problem}
              operation={props.operation}
              onSubmit={(answer) => {
                logger.info('ToolDisplay', 'practice_problem_answer', { answer, problem: props.problem });
                handleToolResponse("practice", props.problem, answer);
              }}
            />
          </div>
        );

      case 'calculator':
        return (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-orange-800">
              🧮 Visual Calculator
            </h3>
            <p className="text-orange-600 mb-4">
              Use this calculator to solve math problems!
            </p>
            <VisualCalculator
              key={`calculator_${Date.now()}`}
              onCalculate={(expression, result) => {
                logger.info('ToolDisplay', 'calculator_calculation', { result, expression });
                handleToolResponse("calculator", expression, result);
              }}
            />
          </div>
        );

      default:
        return (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Unknown Tool
            </h3>
            <p className="text-gray-600">Tool type "{type}" is not recognized.</p>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          🛠️ Interactive Tools
        </h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Complete the activity below to continue the lesson
            </p>
            <button
              onClick={clearActiveTool}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-600"
              title="Close tool"
            >
              ✕
            </button>
          </div>
          
          {/* Non-blocking chat availability indicator */}
          <div className="bg-green-50 border border-green-200 rounded-md p-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-700 font-medium">
                💬 Chat is active - you can ask questions anytime!
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        {renderTool()}
      </div>
    </div>
  );
}