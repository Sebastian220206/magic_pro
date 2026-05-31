"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";

interface Props {
  projectName: string;
  open: boolean;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ projectName, open, deleting, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-daw-panel border border-daw-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-900/30 border border-red-800/40 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-lg">Delete Project</h3>
            <p className="text-gray-400 text-sm mt-1">
              Are you sure you want to delete <span className="text-white font-medium">"{projectName}"</span>?
              This action cannot be undone.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-lg hover:bg-daw-surface flex items-center justify-center text-gray-400 hover:text-white transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-daw-surface transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition flex items-center gap-2 disabled:opacity-50"
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
