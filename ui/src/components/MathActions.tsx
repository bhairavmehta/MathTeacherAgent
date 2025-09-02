"use client";

import { useCopilotAction, useCopilotChat, useCopilotMessagesContext } from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import { useActivateTool } from "@/contexts/ToolContext";
import { logger } from "@/utils/logger";
import { useEffect, useRef, useCallback, useState } from "react";
import { DemoInterruptionManager } from "./DemoInterruptionManager";
import { ValidationActions } from "./ValidationActions";

export function MathActions() {
  const activateTool = useActivateTool();
  const { appendMessage } = useCopilotChat();
  const { messages, setMessages } = useCopilotMessagesContext();
  
  // Demo interruption state
  const [activeDemoType, setActiveDemoType] = useState<string | null>(null);
  const [isDemoInterrupted, setIsDemoInterrupted] = useState(false);
  const demoControlRef = useRef<any>(null);

  // Create stable message function using direct context manipulation
  const sendMessageToChat = useCallback((message: string) => {
    console.log('🕐 [DIRECT_CONTEXT] Sending message via direct context manipulation:', new Date().toISOString(), message);
    
    const newMessage = new TextMessage({
      content: message,
      role: Role.Assistant,
    });
    
    setMessages(prev => [...prev, newMessage]);
    
    console.log('🕐 [DIRECT_CONTEXT] Direct context setMessages call completed:', new Date().toISOString());
  }, [setMessages]);

  // Interruption handling functions
  const handleDemoInterruption = useCallback((userMessage: string) => {
    console.log('🛑 [DEMO INTERRUPTION] User query during demo:', userMessage);
    
    setIsDemoInterrupted(true);
    
    // Pause the number line demo if active
    if (typeof window !== 'undefined' && (window as any).__numberLineDemoControl) {
      (window as any).__numberLineDemoControl.pause(`Answering: "${userMessage}"`);
    }
    
    // Send acknowledgment message
    sendMessageToChat(`🛑 I'll pause the demonstration to answer your question: "${userMessage}"`);
    
    // Set a flag to resume after the agent processes the query
    setTimeout(() => {
      sendMessageToChat("💭 Let me think about your question...");
    }, 500);
  }, [sendMessageToChat]);

  const handleDemoResume = useCallback(() => {
    console.log('▶️ [DEMO RESUME] Resuming demonstration');
    
    setIsDemoInterrupted(false);
    
    // Resume the number line demo if active
    if (typeof window !== 'undefined' && (window as any).__numberLineDemoControl) {
      (window as any).__numberLineDemoControl.resume();
    }
    
    // Send resume message
    sendMessageToChat("▶️ Great! Let's continue with the demonstration...");
  }, [sendMessageToChat]);

  // Enhanced tool activation with demo support
  const activateToolWithDemo = useCallback((
    type: string, 
    props: any, 
    respond: (message: string) => void,
    sendIntermediateMessage?: (message: string) => void
  ) => {
    // Track active demo type
    if (type.includes('demonstrate')) {
      setActiveDemoType(type);
      console.log(`🎬 [DEMO START] Starting demo: ${type}`);
    }
    
    // Enhanced sendIntermediateMessage that handles interruptions
    const enhancedSendMessage = sendIntermediateMessage ? (message: string) => {
      // Only send if not interrupted
      if (!isDemoInterrupted) {
        sendIntermediateMessage(message);
      }
    } : undefined;
    
    // Enhanced respond function to clear demo state on completion
    const enhancedRespond = (message: string) => {
      respond(message);
      // Clear demo state when tool completes
      if (type.includes('demonstrate')) {
        console.log(`🏁 [DEMO END] Demo completed: ${type}`);
        setActiveDemoType(null);
        setIsDemoInterrupted(false);
      }
    };
    
    activateTool(type as any, props, enhancedRespond, enhancedSendMessage);
  }, [activateTool, isDemoInterrupted]);

  // Action for demonstrating number line with AI guidance
  useCopilotAction({
    name: "demonstrate_number_line",
    description: "Demonstrate step-by-step visual learning on the number line with AI guidance",
    parameters: [
      {
        name: "problem",
        type: "string",
        description: "The math problem to demonstrate (e.g., '5 + 3')",
        required: true,
      },
      {
        name: "operation",
        type: "string", 
        description: "The operation type (addition, subtraction, etc.)",
        required: true,
      },
    ],
    handler: async (args: any) => {
      logger.info('MathActions', 'demonstrate_number_line_handler_called', { args });
      
      const problem = args?.problem || "Unknown problem";
      const operation = args?.operation || "addition";
      
      // Set demo as active immediately
      setActiveDemoType('demonstrate_number_line');
      console.log('🎬 [NON-BLOCKING DEMO] Starting demonstration:', problem);
      
      // Create a dummy respond function for tool activation
      const nonBlockingRespond = (message: string) => {
        console.log('🎬 [DEMO COMPLETE]', message);
        // Send completion message to chat
        sendMessageToChat(`✅ Demonstration complete! ${message}`);
        // Clear demo state
        setActiveDemoType(null);
        setIsDemoInterrupted(false);
      };
      
      // Activate tool without blocking
      setTimeout(() => {
        activateToolWithDemo('demonstrate_number_line', {
          problem,
          operation,
          start: 0,
          end: 20
        }, nonBlockingRespond, sendMessageToChat || (() => {}));
      }, 100); // Small delay to ensure state updates
      
      // Return immediately to keep chat active
      return `🎬 Starting step-by-step demonstration of "${problem}"! You can ask questions anytime during the demo.`;
    },
  });

  // Action for showing number line
  useCopilotAction({
    name: "show_number_line",
    description: "Show an interactive number line for visual math learning",
    parameters: [
      {
        name: "problem",
        type: "string",
        description: "The math problem to display (e.g., '5 + 3')",
        required: true,
      },
      {
        name: "operation",
        type: "string", 
        description: "The operation type (addition, subtraction, etc.)",
        required: true,
      },
    ],
    handler: async (args: any) => {
      logger.info('MathActions', 'show_number_line_handler_called', { args });
      
      const problem = args?.problem || "Unknown problem";
      const operation = args?.operation || "addition";
      
      console.log('📊 [NON-BLOCKING TOOL] Starting interactive number line:', problem);
      
      // Create non-blocking respond function
      const nonBlockingRespond = (message: string) => {
        console.log('📊 [TOOL COMPLETE]', message);
        sendMessageToChat(`✅ Great work! ${message}`);
      };
      
      // Activate tool without blocking
      setTimeout(() => {
        activateToolWithDemo('number_line', {
          problem,
          operation,
          start: 0,
          end: 20
        }, nonBlockingRespond, sendMessageToChat || (() => {}));
      }, 100);
      
      // Return immediately to keep chat active
      return `📊 Interactive number line is ready for "${problem}"! Try clicking on the numbers to solve it. You can ask for help anytime!`;
    },
  });

  // Action for practice problems
  useCopilotAction({
    name: "practice_problem",
    description: "Show an interactive practice problem for the student to solve",
    parameters: [
      {
        name: "problem",
        type: "string",
        description: "The practice problem to display (e.g., '7 + 4 = ?')",
        required: true,
      },
      {
        name: "operation",
        type: "string",
        description: "The operation type (addition, subtraction, etc.)",
        required: true,
      },
    ],
    handler: async (args: any) => {
      logger.info('MathActions', 'practice_problem_handler_called', { args });
      
      const problem = args?.problem || "Unknown problem";
      const operation = args?.operation || "addition";
      
      console.log('🎯 [NON-BLOCKING PRACTICE] Starting practice problem:', problem);
      
      // Create non-blocking respond function
      const nonBlockingRespond = (message: string) => {
        console.log('🎯 [PRACTICE COMPLETE]', message);
        sendMessageToChat(`🎉 Excellent work! ${message}`);
      };
      
      // Activate tool without blocking
      setTimeout(() => {
        activateToolWithDemo('practice_problem', {
          problem,
          operation
        }, nonBlockingRespond, () => {});
      }, 100);
      
      // Return immediately to keep chat active
      return `🎯 Here's a practice problem: "${problem}". Take your time to solve it! Ask for hints if you need help.`;
    },
  });

  // Action for calculator
  useCopilotAction({
    name: "open_calculator",
    description: "Show an interactive visual calculator for mathematical operations",
    parameters: [],
    handler: async () => {
      logger.info('MathActions', 'open_calculator_handler_called');
      
      console.log('🧮 [NON-BLOCKING CALCULATOR] Opening visual calculator');
      
      // Create non-blocking respond function
      const nonBlockingRespond = (message: string) => {
        console.log('🧮 [CALCULATOR RESULT]', message);
        sendMessageToChat(`🧮 ${message}`);
      };
      
      // Activate tool without blocking
      setTimeout(() => {
        activateToolWithDemo('calculator', {}, nonBlockingRespond, () => {});
      }, 100);
      
      // Return immediately to keep chat active
      return `🧮 Visual calculator is ready! Use it to solve math problems or check your work. You can still chat while using it!`;
    },
  });

  // This component registers actions and manages demo interruptions and validation
  return (
    <>
      <DemoInterruptionManager
        isActive={activeDemoType !== null}
        onInterruption={handleDemoInterruption}
        onResume={handleDemoResume}
      />
      <ValidationActions />
    </>
  );
}