"use client";

import { useState, useEffect } from "react";
import { X, Copy, Check, Loader2, Globe, EyeOff } from "lucide-react";

interface Props {
  projectId: string;
  onClose: () => void;
}

export function ShareModal({ projectId, onClose }: Props) {
  const [shareUrl, setShareUrl] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/project/${projectId}/share`, {
      method: "POST",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.url) {
          setShareUrl(data.url);
          setIsPublic(true);
        } else {
          setError(data.error || "Failed to generate link");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleDisable = async () => {
    setLoading(true);
    await fetch(`/api/project/${projectId}/share`, { method: "DELETE" });
    setShareUrl("");
    setIsPublic(false);
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-daw-panel border border-daw-border rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-lg">Share Project</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition p-1 -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-daw-primary" />
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Status indicator */}
            <div className="flex items-center gap-2 mb-4">
              {isPublic ? (
                <>
                  <Globe className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-sm font-medium">
                    Public — anyone with the link can play
                  </span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400 text-sm">Private — not shared</span>
                </>
              )}
            </div>

            {/* Share URL */}
            {shareUrl && (
              <div className="mb-4">
                <div className="flex items-center gap-2 bg-daw-surface rounded-lg p-3 border border-daw-border">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className="shrink-0 bg-daw-primary text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-600 transition flex items-center gap-1.5"
                  >
                    {copied ? (
                      <><Check className="w-3.5 h-3.5" /> Copied</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> Copy</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Disable sharing */}
            {isPublic && (
              <button
                onClick={handleDisable}
                className="w-full text-sm text-gray-400 hover:text-red-400 transition py-2"
              >
                Disable public link
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
