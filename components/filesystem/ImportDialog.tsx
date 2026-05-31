'use client';

/**
 * ImportDialog - Modal dialog for importing files
 * 
 * Features:
 * - Drag and drop support
 * - File type filtering
 * - Progress indication
 * - Duplicate detection warning
 * - Batch import
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileAudio, FileMusic, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { ImportFileType, ImportResult } from '../../engine/filesystem/importManager';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: File[]) => Promise<ImportResult[]>;
  projectId: string;
}

interface FileWithStatus {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'duplicate';
  progress: number;
  result?: ImportResult;
  error?: string;
}

export function ImportDialog({ isOpen, onClose, onImport, projectId }: ImportDialogProps) {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  // Add files to list
  const addFiles = (newFiles: File[]) => {
    const filesWithStatus: FileWithStatus[] = newFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...filesWithStatus]);
  };

  // Remove file from list
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Clear all files
  const clearFiles = () => {
    setFiles([]);
  };

  // Start import
  const handleImport = async () => {
    if (files.length === 0) return;

    setIsImporting(true);

    const pendingFiles = files.filter(f => f.status === 'pending');
    const fileList = pendingFiles.map(f => f.file);

    try {
      const results = await onImport(fileList);

      // Update file statuses
      setFiles(prev => {
        return prev.map((f, index) => {
          if (f.status !== 'pending') return f;

          const result = results[index];
          if (!result) return f;

          return {
            ...f,
            status: result.success 
              ? (result.isDuplicate ? 'duplicate' : 'success')
              : 'error',
            result,
            error: result.error,
            progress: 100,
          };
        });
      });
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  // Detect file type from extension
  const getFileType = (filename: string): ImportFileType => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['wav', 'mp3', 'ogg', 'flac', 'm4a', 'aiff'].includes(ext)) return 'audio';
    if (['mid', 'midi'].includes(ext)) return 'midi';
    if (['json', 'dawproject'].includes(ext)) return 'project';
    return 'unknown';
  };

  // Get icon for file type
  const getFileIcon = (type: ImportFileType) => {
    switch (type) {
      case 'audio':
        return <FileAudio className="w-5 h-5 text-blue-400" />;
      case 'midi':
        return <FileMusic className="w-5 h-5 text-green-400" />;
      default:
        return <Upload className="w-5 h-5 text-gray-400" />;
    }
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Count files by status
  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const duplicateCount = files.filter(f => f.status === 'duplicate').length;

  const hasPending = pendingCount > 0;
  const allDone = files.length > 0 && pendingCount === 0 && !isImporting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Import Files</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop zone */}
        <div className="p-6">
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${isDragging 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800'
              }
            `}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <p className="text-white font-medium mb-2">
              Drag and drop files here
            </p>
            <p className="text-sm text-gray-500 mb-4">
              or click to browse
            </p>
            <p className="text-xs text-gray-600">
              Supports: WAV, MP3, MIDI, and DAW Project files
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".wav,.mp3,.ogg,.flac,.m4a,.aiff,.mid,.midi,.json,.dawproject"
              onChange={(e) => {
                if (e.target.files) {
                  addFiles(Array.from(e.target.files));
                }
              }}
              className="hidden"
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-400">
                  {files.length} file{files.length !== 1 ? 's' : ''}
                </h3>
                <button
                  onClick={clearFiles}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear all
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border
                      ${file.status === 'success' ? 'bg-green-500/10 border-green-500/30' : ''}
                      ${file.status === 'error' ? 'bg-red-500/10 border-red-500/30' : ''}
                      ${file.status === 'duplicate' ? 'bg-yellow-500/10 border-yellow-500/30' : ''}
                      ${file.status === 'pending' ? 'bg-gray-800 border-gray-700' : ''}
                    `}
                  >
                    {getFileIcon(getFileType(file.file.name))}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{file.file.name}</p>
                      <p className="text-xs text-gray-500">{formatSize(file.file.size)}</p>
                      
                      {/* Progress bar */}
                      {file.status === 'uploading' && (
                        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      )}

                      {/* Status message */}
                      {file.status === 'success' && (
                        <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                          <Check className="w-3 h-3" />
                          Imported successfully
                        </p>
                      )}
                      {file.status === 'duplicate' && (
                        <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          Already in project
                        </p>
                      )}
                      {file.status === 'error' && (
                        <p className="text-xs text-red-400 mt-1">{file.error}</p>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                      disabled={isImporting}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {allDone && (
            <div className="mt-4 p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-4 text-sm">
                {successCount > 0 && (
                  <span className="text-green-400">
                    {successCount} imported
                  </span>
                )}
                {duplicateCount > 0 && (
                  <span className="text-yellow-400">
                    {duplicateCount} duplicates
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-400">
                    {errorCount} failed
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            {allDone ? 'Close' : 'Cancel'}
          </button>
          
          {hasPending && (
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg font-medium transition-colors"
            >
              {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
              Import {pendingCount > 0 && `(${pendingCount})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportDialog;
