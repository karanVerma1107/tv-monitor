"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SidebarToggle from "./SideBarToggle"; // adjust path if needed

export default function StudioPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    instanceName: "",
    description: "",
    symbol: "",
    indicator: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    if (step === 1) {
      // Optional: validate required fields (instanceName, symbol)
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    // Final submission logic (e.g., API call)
    console.log("Final instance data:", formData);
    router.push("/"); // redirect to home after creation
  };

  return (
    <main className="relative min-h-screen bg-gray-50">
      <SidebarToggle />

      {/* Heading - top center */}
      <h1 className="fixed top-5 left-1/2 -translate-x-1/2 z-30 text-2xl font-semibold text-zinc-800 whitespace-nowrap">
        Create New Instance
      </h1>

      {/* Progress bar line below heading */}
      <div className="fixed top-[4.5rem] left-0 w-full h-1 bg-gray-200 z-30">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      {/* Form container */}
      <div className="pt-24 px-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-zinc-800 mb-2">
            Step {step} of 3
          </h2>
          <p className="text-sm text-zinc-500 mb-6">
            {step === 1 && "Basic information"}
            {step === 2 && "Additional settings (coming soon)"}
            {step === 3 && "Review & confirm (coming soon)"}
          </p>

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Instance Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="instanceName"
                  value={formData.instanceName}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., Trading Bot Alpha"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Brief description of the instance"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Symbol <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="symbol"
                  value={formData.symbol}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., BTC/USD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Indicator
                </label>
                <input
                  type="text"
                  name="indicator"
                  value={formData.indicator}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., RSI, MACD"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="py-8 text-center text-zinc-500">
              Step 2 form will be added here.
            </div>
          )}

          {step === 3 && (
            <div className="py-8 text-center text-zinc-500">
              Step 3 – final review & submit.
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
            <button
              onClick={handleBack}
              className={`px-4 py-2 rounded-md ${
                step === 1
                  ? "invisible"
                  : "border border-gray-300 text-zinc-700 hover:bg-gray-50"
              }`}
              disabled={step === 1}
            >
              ← Back
            </button>
            {step < 3 ? (
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Instance
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}