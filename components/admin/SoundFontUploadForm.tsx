'use client';

import { useState } from 'react';

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Uploading file…</span>
        <span className="text-gray-500 tabular-nums">{percent}%</span>
      </div>
      <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-200 ease-out"
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
    </div>
  );
}

export function SoundFontUploadForm({ onUploaded }: { onUploaded?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Piano');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name) return;

    setStatus('uploading');
    setErrorMsg('');
    setUploadProgress(0);

    try {
      const signedRes = await fetch('/api/admin/soundfonts/signed-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
      });
      const signedData = await signedRes.json();
      if (!signedRes.ok) throw new Error(signedData.error || 'Could not get upload URL');

      const { signedUrl, path } = signedData;

      const xhr = new XMLHttpRequest();

      const uploadResult = await new Promise<{ ok: boolean }>((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300 });
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));
        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.send(file);
      });

      if (!uploadResult.ok) {
        throw new Error('Upload failed');
      }

      setUploadProgress(100);

      const finalizeRes = await fetch('/api/admin/soundfonts/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path,
          name,
          category,
          fileSizeKb: Math.round(file.size / 1024),
        }),
      });
      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeData.error || 'Could not save to library');

      setStatus('success');
      setFile(null);
      setName('');
      onUploaded?.();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
      <label className="text-sm text-gray-300">
        SF2 File
        <input
          type="file"
          accept=".sf2"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="block mt-1 text-gray-400 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-orange-500/20 file:text-orange-400 hover:file:bg-orange-500/30"
        />
      </label>

      <label className="text-sm text-gray-300">
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Upright Piano"
          required
          className="block w-full mt-1 px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50"
        />
      </label>

      <label className="text-sm text-gray-300">
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="block w-full mt-1 px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded text-sm text-white focus:outline-none focus:border-orange-500/50"
        >
          <option>Piano</option>
          <option>Strings</option>
          <option>Bass</option>
          <option>Brass</option>
          <option>Synth</option>
          <option>Other</option>
        </select>
      </label>

      {status === 'uploading' && <ProgressBar percent={uploadProgress} />}

      <button
        type="submit"
        disabled={status === 'uploading' || !file || !name}
        className="px-4 py-2 rounded text-sm font-medium transition-all bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === 'uploading' ? `Uploading… ${uploadProgress}%` : 'Upload to Library'}
      </button>

      {status === 'success' && (
        <p className="text-sm text-green-400 bg-green-400/10 rounded px-3 py-2">Uploaded successfully.</p>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-400 bg-red-400/10 rounded px-3 py-2">{errorMsg}</p>
      )}
    </form>
  );
}