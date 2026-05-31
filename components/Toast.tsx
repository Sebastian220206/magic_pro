"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, X, Info } from "lucide-react";

interface Toast {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

interface ToastContextValue {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md text-sm font-medium animate-in slide-in-from-right-2 fade-in duration-200 max-w-sm ${
              t.type === "error"
                ? "bg-red-900/80 border-red-700/50 text-red-200"
                : t.type === "success"
                ? "bg-emerald-900/80 border-emerald-700/50 text-emerald-200"
                : "bg-gray-800/80 border-gray-600/50 text-gray-200"
            }`}
          >
            {t.type === "error" ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : t.type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <Info className="w-4 h-4 flex-shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="p-0.5 hover:bg-white/10 rounded transition"
            >
              <X className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
