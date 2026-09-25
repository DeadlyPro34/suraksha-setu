"use client";

import { useState } from "react";

export default function RequestResources() {
  const [type, setType] = useState("");
  const [quantity, setQuantity] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Resource Requested:", { type, quantity });
    alert(`Requested ${quantity} units of ${type}`);
    setType("");
    setQuantity("");
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-6">Request Resources</h1>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Resource Type
          </label>
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)}
            className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
            required
          >
            <option value="" disabled>Select a resource</option>
            <option value="medical">Medical Kit</option>
            <option value="food">Food Rations</option>
            <option value="water">Drinking Water</option>
            <option value="boat">Rescue Boat</option>
            <option value="personnel">Backup Personnel</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Quantity
          </label>
          <input 
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
            placeholder="Enter quantity"
            required
          />
        </div>
        <button 
          type="submit"
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition-colors"
        >
          Submit Request
        </button>
      </form>
    </div>
  );
}
