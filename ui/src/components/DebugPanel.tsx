"use client";

import { useState, useEffect } from "react";
import { logger } from "@/utils/logger";

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setLogs(logger.getRecentLogs(20));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const refreshLogs = () => {
    setLogs(logger.getRecentLogs(20));
  };

  const downloadLogs = () => {
    logger.downloadLogs();
  };

  const clearLogs = () => {
    logger.clearLogs();
    setLogs([]);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-700 shadow-lg"
        >
          🐛 Debug
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-white border border-gray-300 rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
        <span className="font-semibold">Debug Panel</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white hover:text-gray-300"
        >
          ✕
        </button>
      </div>
      
      <div className="p-3">
        <div className="flex gap-2 mb-3">
          <button
            onClick={refreshLogs}
            className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
          >
            Refresh
          </button>
          <button
            onClick={downloadLogs}
            className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
          >
            Download
          </button>
          <button
            onClick={clearLogs}
            className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
          >
            Clear
          </button>
          <label className="flex items-center text-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-1"
            />
            Auto
          </label>
        </div>
        
        <div className="overflow-y-auto max-h-64 text-xs font-mono bg-gray-50 p-2 rounded">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet...</div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`mb-1 p-1 rounded ${
                  log.level === 'error' 
                    ? 'bg-red-100 text-red-800' 
                    : log.level === 'warn'
                    ? 'bg-yellow-100 text-yellow-800'
                    : log.level === 'info'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="font-semibold">
                  [{log.timestamp.split('T')[1].split('.')[0]}] {log.component}
                </div>
                <div>{log.event}</div>
                {log.data && (
                  <div className="text-gray-600 mt-1">
                    {JSON.stringify(log.data, null, 2)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}