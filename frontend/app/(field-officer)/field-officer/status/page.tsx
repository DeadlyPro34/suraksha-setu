"use client";

import { useState } from "react";

export default function UpdateStatus() {
  const [status, setStatus] = useState<string | null>(null);
  
  const statuses = ["En Route", "On Scene", "Resolved", "Need Backup"];

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-6">Update Status</h1>
      <div className="space-y-4">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`w-full py-4 rounded-lg border-2 text-lg font-semibold transition-all ${
              status === s 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                : 'bg-white text-gray-800 border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {status && (
        <div className="mt-8 p-4 bg-green-50 text-green-800 border border-green-200 rounded-lg text-center font-medium">
          Current Status: {status}
        </div>
      )}
    </div>
  );
}
