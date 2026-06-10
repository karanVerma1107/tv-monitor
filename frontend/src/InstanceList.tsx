"use client";

import { useState, useEffect, useRef } from "react";

interface Instance {
  id: string;
  instanceName: string;
  status: string;
  symbol: string;
  timeframes: string[];
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface TimeframeData {
  C?: number | string | null;
  "Fast EMA (9)"?: number | string | null;
  "Slow EMA (21)"?: number | string | null;
  "Buy Signal"?: number | string | null;
  "Sell Signal"?: number | string | null;
  trend?: "BUY" | "SELL" | string;
  error?: string;
}

interface WsData {
  instanceId?: string;
  symbol?: string;
  status?: string;
  timestamp?: string;
  serverTime?: number;
  data?: Record<string, TimeframeData>;
}

export default function InstanceList() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Modal / WebSocket state
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [wsData, setWsData] = useState<WsData | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fixed toNumber: properly handles 0 values
  const toNumber = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    const num = typeof val === "number" ? val : parseFloat(String(val));
    return isNaN(num) ? null : num;
  };

  const normalizeWsData = (payload: unknown): WsData => {
    if (!payload || typeof payload !== "object") {
      return {};
    }

    const candidate = payload as Record<string, unknown>;

    // If data is already nested under a 'data' field, use it as is
    if (candidate.data && typeof candidate.data === "object" && !Array.isArray(candidate.data)) {
      return candidate as WsData;
    }

    // Otherwise, collect top-level timeframe objects into a new data object
    const normalizedData: Record<string, TimeframeData> = {};

    Object.entries(candidate).forEach(([key, value]) => {
      if (["timestamp", "instanceId", "symbol", "status", "serverTime", "data"].includes(key)) {
        return;
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        normalizedData[key] = value as TimeframeData;
      }
    });

    return {
      ...candidate,
      data: normalizedData,
    } as WsData;
  };

  const fetchInstances = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:8000/api/instances");
      if (!response.ok) throw new Error("Failed to fetch instances");
      const data = await response.json();
      setInstances(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();

    // Cleanup WebSocket on component unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const confirmInstance = async (instanceId: string) => {
    setConfirmingId(instanceId);
    try {
      const response = await fetch(`http://localhost:8000/api/instances/${instanceId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Confirmation failed");
      }
      const result = await response.json();
      showToast(`Instance "${result.instanceId}" confirmed and ready!`, "success");
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === instanceId ? { ...inst, status: "RUNNING" } : inst
        )
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Confirmation error", "error");
    } finally {
      setConfirmingId(null);
    }
  };

  const openViewModal = (instance: Instance) => {
    setSelectedInstance(instance);
    setWsData(null);
    setWsConnected(false);
    setWsError(null);
    setShowRawJson(false);

    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `ws://localhost:8000/ws/${instance.id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setWsData(normalizeWsData(parsed));
      } catch (err) {
        console.error("Failed to parse WebSocket data", err);
      }
    };

    ws.onerror = () => {
      setWsError("Connection error. Is the backend running?");
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
    };
  };

  const closeViewModal = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setSelectedInstance(null);
    setWsData(null);
    setWsConnected(false);
    setWsError(null);
    setShowRawJson(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "WAITING_CONFIRMATION":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "RUNNING":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getTrendColor = (trend: string) => {
    if (trend === "BUY") return "bg-green-500 text-white";
    if (trend === "SELL") return "bg-red-500 text-white";
    return "bg-gray-500 text-white";
  };

  // Helper to safely display numeric values
  const formatNumber = (value: number | string | null | undefined, decimals: number = 5): string => {
    const num = toNumber(value);
    return num !== null ? num.toFixed(decimals) : "N/A";
  };

  return (
    <>
      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] animate-slide-up">
          <div className={`px-4 py-3 rounded-lg shadow-lg text-white ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
            {toast.message}
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-6 transition-all duration-300 hover:shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-zinc-800 to-zinc-600 bg-clip-text text-transparent">
            📊 Active Instances
          </h2>
          <button
            onClick={fetchInstances}
            disabled={loading}
            className="group relative px-4 py-2 bg-zinc-900 text-white rounded-xl overflow-hidden transition-all hover:bg-zinc-800 disabled:opacity-50"
          >
            <span className="relative z-10 flex items-center gap-2">
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reload
                </>
              )}
            </span>
          </button>
        </div>

        {loading && !instances.length ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-pulse flex space-x-4">
              <div className="rounded-full bg-gray-300 h-12 w-12"></div>
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded"></div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <p className="text-red-700">⚠️ {error}</p>
            <button onClick={fetchInstances} className="mt-2 text-sm text-red-600 underline">Retry</button>
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No instances</h3>
            <p className="mt-1 text-sm text-gray-500">Create your first instance using the button below.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {instances.map((inst) => (
              <div
                key={inst.id}
                onClick={() => openViewModal(inst)}
                className={`group relative bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 ${inst.status === "RUNNING" ? "cursor-pointer" : "cursor-not-allowed opacity-75"}`}
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-500 to-emerald-600"></div>
                <div className="p-5">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold text-zinc-800 truncate">{inst.instanceName}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(inst.status)}`}>
                      {inst.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 font-mono">{inst.symbol}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {inst.timeframes.map((tf) => (
                      <span key={tf} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                        {tf}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-xs text-gray-400">ID: {inst.id.slice(0, 8)}…</span>
                    {inst.status === "WAITING_CONFIRMATION" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmInstance(inst.id); }}
                        disabled={confirmingId === inst.id}
                        className="px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition disabled:opacity-50"
                      >
                        {confirmingId === inst.id ? "Confirming..." : "Confirm"}
                      </button>
                    )}
                    {inst.status === "RUNNING" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openViewModal(inst); }}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        View →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for viewing real-time data */}
      {selectedInstance && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-zinc-50 to-white">
              <h2 className="text-2xl font-bold text-zinc-800">{selectedInstance.instanceName}</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {wsConnected ? (
                    <span className="flex items-center gap-1.5 text-green-600 font-medium">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                      Live
                    </span>
                  ) : wsError ? (
                    <span className="text-red-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {wsError}
                    </span>
                  ) : (
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-gray-300"></span>
                      Connecting…
                    </span>
                  )}
                </div>
                <button
                  onClick={closeViewModal}
                  className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600 hover:text-gray-800"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Metadata */}
            {wsData && (
              <div className="px-6 py-3 bg-zinc-50 border-b flex justify-between items-center text-sm">
                <div className="flex gap-6">
                  <span className="text-zinc-600">
                    <span className="font-medium text-zinc-800">Symbol:</span> {wsData.symbol || selectedInstance.symbol}
                  </span>
                  <span className="text-zinc-600">
                    <span className="font-medium text-zinc-800">Status:</span> {wsData.status || selectedInstance.status}
                  </span>
                </div>
                {wsData.timestamp && (
                  <span className="text-zinc-400 font-mono">{wsData.timestamp}</span>
                )}
              </div>
            )}

            {/* Toggle Button */}
            {wsData && wsData.data && Object.keys(wsData.data).length > 0 && (
              <div className="px-6 py-3 border-b flex justify-end">
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="px-4 py-2 text-sm bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  {showRawJson ? "Show Formatted Data" : "Show Raw JSON"}
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {wsError ? (
                <div className="flex flex-col items-center justify-center py-16 text-red-500">
                  <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg font-medium">Failed to connect to WebSocket</p>
                  <p className="text-sm mt-2 opacity-75">Make sure the backend is running on port 8000</p>
                </div>
              ) : !wsData ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <svg className="w-16 h-16 mb-4 opacity-50 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-lg font-medium">Waiting for data…</p>
                </div>
              ) : !wsData.data || Object.keys(wsData.data).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-yellow-600">
                  <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-lg font-medium">Waiting for timeframe data…</p>
                </div>
              ) : showRawJson ? (
                /* Raw JSON Display */
                <div className="bg-zinc-900 rounded-xl p-6 overflow-auto">
                  <pre className="text-xs font-mono text-green-400 leading-relaxed">
                    {JSON.stringify(wsData, null, 2)}
                  </pre>
                </div>
              ) : (
                /* Formatted Timeframe Cards */
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(wsData.data).map(([timeframe, values]) => (
                      <div key={timeframe} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 overflow-hidden">
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-zinc-800 to-zinc-600 px-5 py-4 flex justify-between items-center">
                          <h3 className="text-lg font-bold text-white font-mono">{timeframe}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getTrendColor(values.trend ?? "UNKNOWN")}`}>
                            {values.trend ?? "UNKNOWN"}
                          </span>
                        </div>

                        {/* Card Content */}
                        <div className="p-5">
                          {values.error ? (
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span className="font-medium">{values.error}</span>
                            </div>
                          ) : (
                            <dl className="space-y-3">
                              {/* Close (C) */}
                              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <dt className="text-sm text-gray-500 font-medium">Close (C)</dt>
                                <dd className="font-mono font-bold text-zinc-800 text-lg">
                                  {formatNumber(values.C)}
                                </dd>
                              </div>

                              {/* Fast EMA */}
                              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <dt className="text-sm text-gray-500 font-medium">Fast EMA (9)</dt>
                                <dd className="font-mono text-blue-600 font-semibold">
                                  {formatNumber(values["Fast EMA (9)"])}
                                </dd>
                              </div>

                              {/* Slow EMA */}
                              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                <dt className="text-sm text-gray-500 font-medium">Slow EMA (21)</dt>
                                <dd className="font-mono text-purple-600 font-semibold">
                                  {formatNumber(values["Slow EMA (21)"])}
                                </dd>
                              </div>

                              {/* Buy Signal */}
                              <div className="flex justify-between items-center py-2 bg-green-50 rounded-lg px-3">
                                <dt className="text-sm text-green-700 font-bold">Buy Signal</dt>
                                <dd className="font-mono font-bold text-green-600">
                                  {toNumber(values["Buy Signal"]) ?? 0}
                                </dd>
                              </div>

                              {/* Sell Signal */}
                              <div className="flex justify-between items-center py-2 bg-red-50 rounded-lg px-3">
                                <dt className="text-sm text-red-700 font-bold">Sell Signal</dt>
                                <dd className="font-mono font-bold text-red-600">
                                  {toNumber(values["Sell Signal"]) ?? 0}
                                </dd>
                              </div>
                            </dl>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {wsData && wsData.data && Object.keys(wsData.data).length > 0 && (
              <div className="px-6 py-3 bg-zinc-50 border-t text-xs text-zinc-400 flex justify-between">
                <span>Real-time data from TradingView</span>
                {wsData.serverTime && (
                  <span className="font-mono">Server: {new Date(wsData.serverTime).toLocaleTimeString()}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slideUp 0.2s ease-out; }
      `}</style>
    </>
  );
}