"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCopilotMessagesContext, useCopilotChat } from "@copilotkit/react-core";
import { Message, TextMessage, Role } from "@copilotkit/runtime-client-gql";

interface DemoInterruptionManagerProps {
  isActive: boolean;
  onInterruption: (userMessage: string) => void;
  onResume: () => void;
}

interface EnhancedDemoInterruptionState extends DemoInterruptionState {
  isNonBlockingMode: boolean;
  lastMessageTimestamp: number;
}

interface DemoInterruptionState {
  isMonitoring: boolean;
  lastProcessedMessageId: string | null;
  isDemoActive: boolean;
  pendingQueries: string[];
}

export function DemoInterruptionManager({ 
  isActive, 
  onInterruption, 
  onResume 
}: DemoInterruptionManagerProps) {
  const { messages } = useCopilotMessagesContext();
  const stateRef = useRef<EnhancedDemoInterruptionState>({
    isMonitoring: false,
    lastProcessedMessageId: null,
    isDemoActive: false,
    pendingQueries: [],
    isNonBlockingMode: true, // Enable non-blocking mode by default
    lastMessageTimestamp: Date.now()
  });

  // Demo-related keywords that should NOT trigger interruption
  const DEMO_KEYWORDS = [
    'continue', 'resume', 'next step', 'keep going',
    'proceed', 'go on', 'demo', 'demonstration',
    'show me', 'let me see', 'continue demo'
  ];

  // Question/interruption indicators
  const QUESTION_INDICATORS = [
    'what', 'how', 'why', 'when', 'where', 'who',
    'can you', 'could you', 'would you', 'will you',
    'explain', 'tell me', 'help me', '?'
  ];

  const isUserQuery = useCallback((message: string): boolean => {
    const lowerMessage = message.toLowerCase().trim();
    
    // Skip very short messages
    if (lowerMessage.length < 3) return false;
    
    // Check if it's a demo continuation request
    const isDemoContinuation = DEMO_KEYWORDS.some(keyword => 
      lowerMessage.includes(keyword)
    );
    if (isDemoContinuation) return false;
    
    // Check if it's a question or request
    const isQuestion = QUESTION_INDICATORS.some(indicator => 
      lowerMessage.includes(indicator)
    );
    
    // Or if it contains question mark
    const hasQuestionMark = lowerMessage.includes('?');
    
    // Or if it starts with common question words
    const startsWithQuestion = /^(what|how|why|when|where|who|can|could|would|will|is|are|do|does)\s/i.test(lowerMessage);
    
    return isQuestion || hasQuestionMark || startsWithQuestion;
  }, []);

  const detectInterruption = useCallback((newMessages: Message[]) => {
    if (!isActive || !stateRef.current.isMonitoring) return;

    const now = Date.now();
    
    // In non-blocking mode, check all recent messages (last 30 seconds)
    const recentThreshold = stateRef.current.isNonBlockingMode ? now - 30000 : 0;
    
    // Find new user messages since last check
    const lastProcessedIndex = stateRef.current.lastProcessedMessageId 
      ? newMessages.findIndex(msg => msg.id === stateRef.current.lastProcessedMessageId)
      : -1;
    
    const candidateMessages = stateRef.current.isNonBlockingMode 
      ? newMessages // Check all messages in non-blocking mode
      : newMessages.slice(lastProcessedIndex + 1);
    
    const newUserMessages = candidateMessages.filter(msg => 
      (msg as any).role === 'user' && 
      (msg as any).content && 
      typeof (msg as any).content === 'string' &&
      ((msg as any).createdAt ? new Date((msg as any).createdAt).getTime() > stateRef.current.lastMessageTimestamp : true)
    );

    if (newUserMessages.length === 0) return;

    // Check if any new message is a user query
    for (const message of newUserMessages) {
      const content = typeof (message as any).content === 'string' ? (message as any).content : '';
      
      if (isUserQuery(content)) {
        console.log('🛑 [NON-BLOCKING INTERRUPTION] User query detected:', content);
        console.log('🔧 [NON-BLOCKING] Chat should remain active during this interruption');
        
        // Update state
        stateRef.current.lastProcessedMessageId = message.id;
        stateRef.current.pendingQueries.push(content);
        stateRef.current.lastMessageTimestamp = now;
        
        // Trigger interruption
        onInterruption(content);
        break;
      }
    }

    // Update timestamp tracking
    if (newUserMessages.length > 0) {
      const lastMessage = newUserMessages[newUserMessages.length - 1];
      stateRef.current.lastProcessedMessageId = lastMessage.id;
      stateRef.current.lastMessageTimestamp = now;
    }
  }, [isActive, onInterruption, isUserQuery]);

  // Monitor messages for interruptions
  useEffect(() => {
    if (!isActive) {
      stateRef.current.isMonitoring = false;
      return;
    }

    stateRef.current.isMonitoring = true;
    stateRef.current.isDemoActive = true;
    
    if (stateRef.current.isNonBlockingMode) {
      console.log('🔍 [NON-BLOCKING MANAGER] Starting continuous message monitoring');
      console.log('💬 [NON-BLOCKING] Chat remains available for interruptions');
    } else {
      console.log('🔍 [INTERRUPTION MANAGER] Starting message monitoring');
    }
    
    // Check current messages
    detectInterruption(messages);
    
    return () => {
      stateRef.current.isMonitoring = false;
      stateRef.current.isDemoActive = false;
      if (stateRef.current.isNonBlockingMode) {
        console.log('🔍 [NON-BLOCKING MANAGER] Stopping continuous monitoring');
      } else {
        console.log('🔍 [INTERRUPTION MANAGER] Stopping message monitoring');
      }
    };
  }, [messages, detectInterruption, isActive]);

  // Handle resume requests
  useEffect(() => {
    if (!isActive) return;

    // Look for resume indicators in recent messages
    const recentMessages = messages.slice(-3); // Check last 3 messages
    const hasResumeRequest = recentMessages.some(msg => 
      (msg as any).role === 'user' && 
      (msg as any).content && 
      typeof (msg as any).content === 'string' &&
      DEMO_KEYWORDS.some(keyword => 
        ((msg as any).content as string).toLowerCase().includes(keyword)
      )
    );

    if (hasResumeRequest && stateRef.current.pendingQueries.length > 0) {
      console.log('▶️ [INTERRUPTION MANAGER] Resume request detected');
      stateRef.current.pendingQueries = [];
      onResume();
    }
  }, [messages, onResume, isActive]);

  // Expose global control functions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__demoInterruptionManager = {
        forceInterruption: (reason: string) => onInterruption(reason),
        forceResume: () => onResume(),
        getState: () => ({ ...stateRef.current }),
        isMonitoring: () => stateRef.current.isMonitoring
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__demoInterruptionManager;
      }
    };
  }, [onInterruption, onResume]);

  // This is a headless component - no visual render
  return null;
}