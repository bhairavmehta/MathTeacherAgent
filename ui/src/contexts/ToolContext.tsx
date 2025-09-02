"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Tool types that can be displayed in the sidebar
export type ToolType = 'number_line' | 'demonstrate_number_line' | 'practice_problem' | 'calculator';

// Demo state interface
export interface DemoState {
  currentStep: number;
  nextStepDelay: number;
  pauseReason?: string;
  resumeAt?: number;
}

// Tool configuration interface
export interface ToolConfig {
  type: ToolType;
  props: any;
  respond: (message: string) => void;
  sendIntermediateMessage?: (message: string) => void;
  onDemoPause?: (demoState: DemoState) => void;
  onDemoResume?: () => void;
}

// Context state interface
interface ToolContextState {
  activeToolConfig: ToolConfig | null;
  isToolActive: boolean;
  setActiveTool: (config: ToolConfig | null) => void;
  clearActiveTool: () => void;
  // Demo control methods
  isDemoActive: boolean;
  isDemoPaused: boolean;
  pauseDemo: (reason?: string) => void;
  resumeDemo: () => void;
  getDemoState: () => DemoState | null;
  // Non-blocking tool management
  isChatBlocked: boolean;
  setChatBlocked: (blocked: boolean) => void;
  toolCompletionCallbacks: Map<string, (message: string) => void>;
  registerToolCompletion: (toolId: string, callback: (message: string) => void) => void;
  unregisterToolCompletion: (toolId: string) => void;
}

// Create the context
const ToolContext = createContext<ToolContextState | undefined>(undefined);

// Provider component
interface ToolProviderProps {
  children: ReactNode;
}

export function ToolProvider({ children }: ToolProviderProps) {
  const [activeToolConfig, setActiveToolConfig] = useState<ToolConfig | null>(null);
  const [demoState, setDemoState] = useState<DemoState | null>(null);
  const [isDemoPaused, setIsDemoPaused] = useState(false);
  const [isChatBlocked, setIsChatBlocked] = useState(false);
  const [toolCompletionCallbacks] = useState(new Map<string, (message: string) => void>());

  const setActiveTool = (config: ToolConfig | null) => {
    setActiveToolConfig(config);
  };

  const clearActiveTool = () => {
    setActiveToolConfig(null);
    setDemoState(null);
    setIsDemoPaused(false);
  };

  // Demo control functions
  const pauseDemo = (reason: string = "User query") => {
    if (!activeToolConfig?.type.includes('demonstrate')) return;
    
    console.log(`🛑 [TOOL CONTEXT] Pausing demo, reason: ${reason}`);
    setIsDemoPaused(true);
    
    // Use global control if available
    if (typeof window !== 'undefined' && (window as any).__numberLineDemoControl) {
      (window as any).__numberLineDemoControl.pause(reason);
    }
  };

  const resumeDemo = () => {
    if (!demoState) return;
    
    console.log('▶️ [TOOL CONTEXT] Resuming demo');
    setIsDemoPaused(false);
    
    // Use global control if available
    if (typeof window !== 'undefined' && (window as any).__numberLineDemoControl) {
      (window as any).__numberLineDemoControl.resume();
    }
  };

  const getDemoState = () => demoState;

  // Non-blocking tool management
  const setChatBlocked = (blocked: boolean) => {
    setIsChatBlocked(blocked);
    console.log(`🔧 [TOOL CONTEXT] Chat ${blocked ? 'blocked' : 'unblocked'}`);
  };

  const registerToolCompletion = (toolId: string, callback: (message: string) => void) => {
    toolCompletionCallbacks.set(toolId, callback);
    console.log(`🔧 [TOOL CONTEXT] Registered completion callback for: ${toolId}`);
  };

  const unregisterToolCompletion = (toolId: string) => {
    toolCompletionCallbacks.delete(toolId);
    console.log(`🔧 [TOOL CONTEXT] Unregistered completion callback for: ${toolId}`);
  };

  const value: ToolContextState = {
    activeToolConfig,
    isToolActive: activeToolConfig !== null,
    setActiveTool,
    clearActiveTool,
    // Demo control methods
    isDemoActive: activeToolConfig?.type.includes('demonstrate') || false,
    isDemoPaused,
    pauseDemo,
    resumeDemo,
    getDemoState,
    // Non-blocking tool management
    isChatBlocked,
    setChatBlocked,
    toolCompletionCallbacks,
    registerToolCompletion,
    unregisterToolCompletion,
  };

  return (
    <ToolContext.Provider value={value}>
      {children}
    </ToolContext.Provider>
  );
}

// Hook to use the tool context
export function useToolContext() {
  const context = useContext(ToolContext);
  if (context === undefined) {
    throw new Error('useToolContext must be used within a ToolProvider');
  }
  return context;
}

// Helper hook for easy tool activation
export function useActivateTool() {
  const { setActiveTool } = useToolContext();
  
  return (
    type: ToolType, 
    props: any, 
    respond: (message: string) => void,
    sendIntermediateMessage?: (message: string) => void,
    onDemoPause?: (demoState: DemoState) => void,
    onDemoResume?: () => void
  ) => {
    setActiveTool({ type, props, respond, sendIntermediateMessage, onDemoPause, onDemoResume });
  };
}