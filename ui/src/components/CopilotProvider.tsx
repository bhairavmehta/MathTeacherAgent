"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { MathActions } from "./MathActions";
import { DebugPanel } from "./DebugPanel";
import { useEffect, useState } from "react";

interface CopilotProviderProps {
  children: React.ReactNode;
}

export function CopilotProvider({ children }: CopilotProviderProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Don't render CopilotKit on the server to avoid hydration mismatch
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {children}
      </div>
    );
  }

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="math_teacher"
    >
      <MathActions />
      {children}
      <CopilotSidebar
        defaultOpen={true}
        instructions="You are a patient and encouraging math teacher. Help students learn addition, subtraction, multiplication, and division through interactive conversations. Use visual aids and interactive components when helpful."
        labels={{
          title: "🧮 Math Teacher AI",
          initial: "Hi! I'm your math teacher. What would you like to learn today?",
        }}
      />
      <DebugPanel />
    </CopilotKit>
  );
}