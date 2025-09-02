"use client";

import { useCoAgent } from "@copilotkit/react-core";
import { useState } from "react";
import { NumberLine } from "./NumberLine";
import { VisualCalculator } from "./VisualCalculator";
import { ProblemPractice } from "./ProblemPractice";

// Define the math teaching state interface
interface MathTeachingState {
  current_topic?: string;
  current_operation?: string;
  last_problem?: string;
  student_answer?: number;
  correct_answer?: number;
  interaction_type?: string;
  feedback?: string;
}

const INITIAL_STATE: MathTeachingState = {
  current_topic: "Getting Started",
  current_operation: undefined,
  last_problem: undefined,
  student_answer: undefined,
  correct_answer: undefined,
  interaction_type: "explanation",
  feedback: "Welcome! What math topic would you like to learn today!"
};

export function MathTeacher() {
  const { state: agentState, setState: setAgentState } = useCoAgent<MathTeachingState>({
    name: "math_teacher",
    initialState: INITIAL_STATE,
  });

  // Debug logging for state changes
  console.log("🔍 MathTeacher - Current agent state:", agentState);
  console.log("🔍 MathTeacher - Interaction type:", agentState?.interaction_type);
  console.log("🔍 MathTeacher - Last problem:", agentState?.last_problem);

  // Handle answers from interactive components
  const handleAnswer = (answer: number, method: string, problem: string) => {
    console.log("🔍 MathTeacher - handleAnswer called:", { answer, method, problem });
    
    // Update the agent state with the student's answer
    const newState = {
      ...agentState,
      student_answer: answer,
      last_problem: problem,
      interaction_type: "validation"
    };
    
    console.log("🔍 MathTeacher - Setting new state:", newState);
    setAgentState(newState);

    // The agent will automatically validate this through the validate_answer tool
  };

  // Render the appropriate component based on interaction type
  const renderInteractiveComponent = () => {
    console.log("🔍 MathTeacher - renderInteractiveComponent called");
    console.log("🔍 MathTeacher - interaction_type:", agentState?.interaction_type);
    console.log("🔍 MathTeacher - last_problem:", agentState?.last_problem);
    
    if (!agentState?.interaction_type || !agentState?.last_problem) {
      console.log("🔍 MathTeacher - No interactive component to render");
      return null;
    }

    const problem = agentState.last_problem;
    const operation = agentState.current_operation;
    console.log("🔍 MathTeacher - Rendering component for:", { problem, operation, type: agentState.interaction_type });

    switch (agentState.interaction_type) {
      case "visual":
        return (
          <div className="mb-6">
            <NumberLine
              problem={problem}
              operation={operation === "addition" ? "addition" : "subtraction"}
              start={0}
              end={20}
              onAnswer={(answer) => handleAnswer(answer, "number_line", problem)}
            />
          </div>
        );
      
      case "practice":
        return (
          <div className="mb-6">
            <ProblemPractice
              problem={problem}
              operation={operation || "addition"}
              onSubmit={(answer) => handleAnswer(answer, "practice", problem)}
            />
          </div>
        );
      
      case "calculator":
        return (
          <div className="mb-6">
            <VisualCalculator
              onCalculate={(expression, result) => handleAnswer(result, "calculator", expression)}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Current Topic Display */}
      {agentState?.current_topic && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-xl font-semibold text-blue-800">
            Current Topic: {agentState.current_topic}
          </h2>
          {agentState.feedback && (
            <p className="text-blue-600 mt-2">{agentState.feedback}</p>
          )}
        </div>
      )}

      {/* Interactive Component */}
      {renderInteractiveComponent()}

      {/* Progress Display */}
      {(agentState?.student_answer !== undefined || agentState?.correct_answer !== undefined) && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="font-semibold text-gray-800 mb-2">Progress</h3>
          {agentState.last_problem && (
            <p className="text-gray-600">
              Problem: <span className="font-mono">{agentState.last_problem}</span>
            </p>
          )}
          {agentState.student_answer !== undefined && (
            <p className="text-gray-600">
              Your Answer: <span className="font-mono">{agentState.student_answer}</span>
            </p>
          )}
          {agentState.correct_answer !== undefined && (
            <p className="text-gray-600">
              Correct Answer: <span className="font-mono">{agentState.correct_answer}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}