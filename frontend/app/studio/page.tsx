"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Icons (unchanged)
const MenuIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-zinc-600 hover:text-blue-600 transition-colors"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-zinc-600 hover:text-blue-600 transition-colors"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const DashboardIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-blue-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"
    />
  </svg>
);

const StudioIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-blue-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
);

export default function StudioPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [jsonPayload, setJsonPayload] = useState("");

  // Form data with dynamic arrays
  const [formData, setFormData] = useState({
    instanceName: "",
    description: "",
    symbol: "",
    timeframes: [""],
    fieldsToScrape: [""],
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Update a specific timeframe index
  const updateTimeframe = (index: number, value: string) => {
    const updated = [...formData.timeframes];
    updated[index] = value;
    setFormData((prev) => ({ ...prev, timeframes: updated }));
  };

  // Add new empty timeframe input
  const addTimeframe = () => {
    setFormData((prev) => ({
      ...prev,
      timeframes: [...prev.timeframes, ""],
    }));
  };

  // Remove timeframe at index
  const removeTimeframe = (index: number) => {
    const updated = [...formData.timeframes];
    updated.splice(index, 1);
    setFormData((prev) => ({ ...prev, timeframes: updated }));
  };

  // Update a specific field index
  const updateField = (index: number, value: string) => {
    const updated = [...formData.fieldsToScrape];
    updated[index] = value;
    setFormData((prev) => ({ ...prev, fieldsToScrape: updated }));
  };

  // Add new empty field input
  const addField = () => {
    setFormData((prev) => ({
      ...prev,
      fieldsToScrape: [...prev.fieldsToScrape, ""],
    }));
  };

  // Remove field at index
  const removeField = (index: number) => {
    const updated = [...formData.fieldsToScrape];
    updated.splice(index, 1);
    setFormData((prev) => ({ ...prev, fieldsToScrape: updated }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.instanceName || !formData.symbol) {
        alert("Instance Name and Symbol are required.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const validTimeframes = formData.timeframes.filter((tf) => tf.trim() !== "");
      if (validTimeframes.length === 0) {
        alert("Add at least one timeframe (non-empty).");
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  // Prepare payload and show preview
  const prepareAndShowPreview = () => {
    const validTimeframes = formData.timeframes.filter((tf) => tf.trim() !== "");
    const validFields = formData.fieldsToScrape.filter((f) => f.trim() !== "");

    if (validFields.length === 0) {
      alert("Add at least one field to scrape (non-empty).");
      return;
    }

    const payload = {
      instanceName: formData.instanceName,
      description: formData.description,
      symbol: formData.symbol,
      timeframes: validTimeframes,
      fieldsToScrape: validFields,
    };

    setJsonPayload(JSON.stringify(payload, null, 2));
    setShowJsonPreview(true);
  };

  // Actually submit after preview confirmation
  const confirmSubmit = async () => {
    setShowJsonPreview(false);
    setIsSubmitting(true);
    try {
      const payload = JSON.parse(jsonPayload);
      const response = await fetch("http://localhost:8000/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create instance");
      }

      const result = await response.json();
      console.log("Instance created:", result);
      router.push("/");
    } catch (error) {
      console.error("Submission error:", error);
      alert(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-gray-50">
      {/* Sidebar (unchanged) */}
      <div
        className={`
          fixed top-0 left-0 h-screen w-64 bg-white
          border-r-2 border-green-500 shadow-lg
          transition-transform duration-300 ease-in-out
          z-50 font-sans
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 z-[60] focus:outline-none"
          aria-label="Close sidebar"
        >
          <CloseIcon />
        </button>

        <div className="flex flex-col h-full">
          <div className="px-6 pt-8 pb-4 border-b border-green-200">
            <h1 className="text-xl font-semibold text-zinc-800 tracking-tight">
              FinTech
            </h1>
            <p className="text-xs text-green-600 mt-0.5">secure platform</p>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1">
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md
                         text-blue-600 font-medium text-sm uppercase tracking-wide
                         hover:bg-green-50 transition-colors"
              onClick={() => console.log("Dashboard")}
            >
              <DashboardIcon />
              <span>Dashboard</span>
            </button>
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md
                         text-blue-600 font-medium text-sm uppercase tracking-wide
                         hover:bg-green-50 transition-colors"
              onClick={() => console.log("Studio")}
            >
              <StudioIcon />
              <span>Studio</span>
            </button>
          </nav>
          <div className="px-6 py-4 border-t border-green-100 text-xs text-zinc-400">
            v2.0 • secure
          </div>
        </div>
      </div>

      {/* Fixed header (unchanged) */}
      <header className="fixed top-0 left-0 w-full bg-white shadow-md z-30">
        <div className="relative flex items-center justify-center py-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 z-[60] focus:outline-none"
            aria-label="Open sidebar"
          >
            <MenuIcon />
          </button>
          <h1 className="text-xl font-semibold text-zinc-800">
            Create New Instance
          </h1>
        </div>

        <div className="w-full h-[2px] bg-gray-200">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="flex justify-center gap-8 py-2 bg-white">
          {[1, 2, 3].map((num) => (
            <div
              key={num}
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                transition-all duration-200 shadow-sm
                ${
                  num <= step
                    ? "bg-green-500 text-white border-2 border-green-600"
                    : "bg-gray-100 text-gray-400 border-2 border-gray-200"
                }
              `}
            >
              {num}
            </div>
          ))}
        </div>
      </header>

      {/* Scrollable form (unchanged except button action) */}
      <div className="pt-32 px-4 max-w-2xl mx-auto pb-12">
        <div className="bg-white rounded-lg shadow-md p-6 mt-4">
          <h2 className="text-xl font-semibold text-zinc-800 mb-2">
            Step {step} of 3
          </h2>
          <p className="text-sm text-zinc-500 mb-6">
            {step === 1 && "Basic information"}
            {step === 2 && "Add timeframes (each row = one timeframe)"}
            {step === 3 && "Add fields to scrape"}
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
                  placeholder="e.g., AUDUSD EMA"
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
                  placeholder="e.g., EMA crossover monitor"
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
                  placeholder="e.g., OANDA:AUDUSD"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Timeframes
              </label>
              {formData.timeframes.map((tf, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={tf}
                    onChange={(e) => updateTimeframe(idx, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., 1h, 15m, 1d"
                  />
                  <button
                    type="button"
                    onClick={() => removeTimeframe(idx)}
                    className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addTimeframe}
                className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 inline-flex items-center gap-1"
              >
                + Add Timeframe
              </button>
              <p className="text-xs text-zinc-500 mt-2">
                Each row is one timeframe. Use the + button to add more.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Fields to Scrape
              </label>
              {formData.fieldsToScrape.map((field, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={field}
                    onChange={(e) => updateField(idx, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Fast EMA (9), Buy Signal"
                  />
                  <button
                    type="button"
                    onClick={() => removeField(idx)}
                    className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addField}
                className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 inline-flex items-center gap-1"
              >
                + Add Field
              </button>
              <p className="text-xs text-zinc-500 mt-2">
                Each row is one field. Use the + button to add more.
              </p>
            </div>
          )}

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
                onClick={prepareAndShowPreview}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Create Instance
              </button>
            )}
          </div>
        </div>
      </div>

      {/* JSON Preview Modal */}
      {showJsonPreview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-zinc-800">
                JSON Payload Preview
              </h3>
              <button
                onClick={() => setShowJsonPreview(false)}
                className="text-zinc-500 hover:text-zinc-700"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="bg-gray-100 p-4 rounded-md text-sm font-mono whitespace-pre-wrap">
                {jsonPayload}
              </pre>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowJsonPreview(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-zinc-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </main>
  );
}