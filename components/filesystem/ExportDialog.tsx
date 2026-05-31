'use client';

/**
 * ExportDialog - Modal dialog for exporting projects
 * 
 * Features:
 * - Export format selection (WAV, MP3, STEM, MIDI, JSON, ZIP)
 * - Quality settings
 * - Time range selection
 * - Progress indication
 * - Download trigger
 */

import React, { useState, useCallback } from 'react';
import { 
  Download, 
  FileAudio, 
  FileMusic, 
  Archive, 
  FileJson, 
  X, 
  Loader2,
  Check,
  Music,
  Settings2
} from 'lucide-react';
import { ExportFormat, ExportOptions, ExportResult, StemExportResult } from '../../engine/filesystem/exportManager';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<ExportResult>;
  onExportStems?: (options: ExportOptions) => Promise<StemExportResult>;
  projectName: string;
  projectDuration: number; // in beats
  tempo: number;
}

type ExportStage = 'options' | 'exporting' | 'complete' | 'error';

export function ExportDialog({
  isOpen,
  onClose,
  onExport,
  onExportStems,
  projectName,
  projectDuration,
  tempo,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('wav');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [startBeat, setStartBeat] = useState(0);
  const [endBeat, setEndBeat] = useState(projectDuration);
  const [normalize, setNormalize] = useState(true);
  const [includeAssets, setIncludeAssets] = useState(false);
  
  const [stage, setStage] = useState<ExportStage>('options');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stemResult, setStemResult] = useState<StemExportResult | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setStage('exporting');
    setProgress(0);
    setError(null);

    const options: ExportOptions = {
      format,
      startBeat,
      endBeat,
      quality,
      normalize,
      includeAssets: format === 'zip' ? true : includeAssets,
    };

    try {
      if (format === 'stems' && onExportStems) {
        const stems = await onExportStems(options);
        setStemResult(stems);
      } else {
        const exportResult = await onExport(options);
        setResult(exportResult);
      }
      
      setStage('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setStage('error');
    }
  };

  const handleDownload = () => {
    if (!result) return;

    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadStems = () => {
    if (!stemResult?.zipBlob) return;

    const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const url = URL.createObjectURL(stemResult.zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_stems.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStage('options');
    setProgress(0);
    setResult(null);
    setStemResult(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Format options
  const formatOptions: Array<{
    value: ExportFormat;
    label: string;
    icon: React.ReactNode;
    description: string;
  }> = [
    { value: 'wav', label: 'WAV Audio', icon: <FileAudio className="w-5 h-5" />, description: 'Uncompressed, highest quality' },
    { value: 'mp3', label: 'MP3 Audio', icon: <FileAudio className="w-5 h-5" />, description: 'Compressed, smaller file size' },
    { value: 'stems', label: 'STEM Export', icon: <Music className="w-5 h-5" />, description: 'Individual track exports' },
    { value: 'midi', label: 'MIDI File', icon: <FileMusic className="w-5 h-5" />, description: 'MIDI notes and events' },
    { value: 'json', label: 'Project JSON', icon: <FileJson className="w-5 h-5" />, description: 'Project data only' },
    { value: 'zip', label: 'Project Archive', icon: <Archive className="w-5 h-5" />, description: 'Full project with assets' },
  ];

  // Quality settings by format
  const showQualitySettings = format === 'wav' || format === 'mp3';
  const showTimeRange = format !== 'midi' && format !== 'json' && format !== 'zip';

  // Calculate duration in time
  const durationSeconds = ((endBeat - startBeat) / tempo) * 60;
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Export Project</h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {stage === 'options' && (
            <div className="space-y-6">
              {/* Format selection */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {formatOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormat(option.value)}
                      className={`
                        flex items-start gap-3 p-3 rounded-lg border text-left transition-all
                        ${format === option.value
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                        }
                      `}
                    >
                      <div className={format === option.value ? 'text-blue-400' : 'text-gray-500'}>
                        {option.icon}
                      </div>
                      <div>
                        <p className={`font-medium ${format === option.value ? 'text-white' : 'text-gray-300'}`}>
                          {option.label}
                        </p>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality settings */}
              {showQualitySettings && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">
                    Quality
                  </label>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => setQuality(q)}
                        className={`
                          flex-1 py-2 px-3 rounded-lg border text-sm font-medium capitalize transition-all
                          ${quality === q
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                          }
                        `}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time range */}
              {showTimeRange && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">
                    Time Range ({formatTime(durationSeconds)})
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-16">Start:</span>
                      <input
                        type="number"
                        min={0}
                        max={endBeat}
                        value={startBeat}
                        onChange={(e) => setStartBeat(Math.max(0, Math.min(endBeat, Number(e.target.value))))}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-sm text-gray-500">beats</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-16">End:</span>
                      <input
                        type="number"
                        min={startBeat}
                        max={projectDuration}
                        value={endBeat}
                        onChange={(e) => setEndBeat(Math.max(startBeat, Math.min(projectDuration, Number(e.target.value))))}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-sm text-gray-500">beats</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Options */}
              {format === 'wav' && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="normalize"
                    checked={normalize}
                    onChange={(e) => setNormalize(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
                  />
                  <label htmlFor="normalize" className="text-sm text-gray-300">
                    Normalize audio (peak at -1 dB)
                  </label>
                </div>
              )}

              {format === 'zip' && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="includeAssets"
                    checked={includeAssets}
                    onChange={(e) => setIncludeAssets(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500"
                  />
                  <label htmlFor="includeAssets" className="text-sm text-gray-300">
                    Include audio assets in archive
                  </label>
                </div>
              )}
            </div>
          )}

          {stage === 'exporting' && (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
              <p className="text-white font-medium mb-2">Exporting...</p>
              <p className="text-sm text-gray-500">This may take a few moments</p>
              
              {/* Progress bar */}
              <div className="mt-6 max-w-xs mx-auto">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {stage === 'complete' && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-white font-medium mb-2">Export Complete!</p>
              
              {result && (
                <div className="text-sm text-gray-500 space-y-1">
                  <p>{result.filename}</p>
                  <p>Duration: {formatTime(result.duration)} • Size: {formatSize(result.size)}</p>
                </div>
              )}

              {stemResult && (
                <div className="text-sm text-gray-500 space-y-1">
                  <p>{stemResult.stems.length} stems exported</p>
                </div>
              )}
            </div>
          )}

          {stage === 'error' && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-white font-medium mb-2">Export Failed</p>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          {stage === 'options' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </>
          )}

          {stage === 'exporting' && (
            <button
              disabled
              className="px-4 py-2 text-gray-500 cursor-not-allowed"
            >
              Exporting...
            </button>
          )}

          {stage === 'complete' && (
            <>
              <button
                onClick={reset}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Export Again
              </button>
              <button
                onClick={stemResult ? handleDownloadStems : handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </>
          )}

          {stage === 'error' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                onClick={reset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Format file size helper
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default ExportDialog;
