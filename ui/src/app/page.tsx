"use client";

import { ToolDisplay } from "@/components/ToolDisplay";
import { useToolContext } from "@/contexts/ToolContext";

export default function Home() {
  const { isToolActive } = useToolContext();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex">
      {/* Left Sidebar - Tool Display */}
      {isToolActive && (
        <div className="w-1/3 min-w-[400px] bg-white shadow-lg">
          <ToolDisplay />
        </div>
      )}
      
      {/* Main Content Area */}
      <div className={`flex-1 p-8 ${isToolActive ? 'max-w-2xl' : 'max-w-4xl mx-auto'}`}>
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🧮 Math Teacher AI
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Learn addition, subtraction, multiplication, and division with your AI teacher!
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              ➕ Addition
            </h2>
            <p className="text-gray-600 mb-4">
              Learn to add numbers together and discover the joy of combining quantities!
            </p>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                Example: 5 + 3 = 8
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              ➖ Subtraction
            </h2>
            <p className="text-gray-600 mb-4">
              Master the art of taking away and finding the difference between numbers!
            </p>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                Example: 10 - 4 = 6
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              ✖️ Multiplication
            </h2>
            <p className="text-gray-600 mb-4">
              Explore repeated addition and learn multiplication tables with fun!
            </p>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                Example: 4 × 3 = 12
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              ➗ Division
            </h2>
            <p className="text-gray-600 mb-4">
              Learn to share and split numbers equally into groups!
            </p>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-orange-800">
                Example: 12 ÷ 3 = 4
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Ready to Start Learning? 🚀
          </h2>
          <p className="text-gray-600 mb-6">
            Open the chat sidebar on the right and tell me what you'd like to learn!
            I'm here to help you master math step by step.
          </p>
          <div className="flex justify-center space-x-4 text-sm text-gray-500">
            <span>💬 Interactive Chat</span>
            <span>📊 Visual Learning</span>
            <span>🧮 Calculator Tools</span>
            <span>🎯 Practice Problems</span>
          </div>
        </div>
      </div>
    </div>
  );
}