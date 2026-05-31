import { useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { X, ChevronDown, Check } from "lucide-react";
import { useToast } from "./Toast";
import { audioEngine } from "@/engine/AudioEngineAdapter";
import { bounceEngine } from "@/engine/audioEngine/bounceEngine";

export function ExportDialog() {
  const {
    showExportDialog,
    toggleExportDialog,
    clips,
    tracks,
    tempo,
    name: projectName,
    selectedClipIds,
    selectedClipId,
    focusedTrackId,
    selectedTrackIds,
  } = useProjectStore();
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    fileType: "WAVE",
    bitDepth: "24-bit",
    normalize: "Overload Protection Only",
  });

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  if (!showExportDialog) return null;

  const title =
    showExportDialog === "track"
      ? "Export Selected Track"
      : showExportDialog === "all"
        ? "Export All Tracks"
        : "Export Selected Regions";

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);

    const progressListener = (event: any) => {
      if (event.type === 'bounceProgress' && event.progress) {
        setProgress(Math.round(event.progress.progress * 100));
      }
    };
    bounceEngine.addEventListener(progressListener);

    try {
      const mappedTracks = tracks.map(t => ({
        id: t.id,
        name: t.name,
        volume: t.volume,
        pan: t.pan,
        muted: t.muted || false,
        solo: t.soloed || false,
        armed: t.recordEnabled || false,
        effects: [],
        sends: [],
        enabled: t.enabled !== false,
      }));

      const mappedClips = clips.map(c => ({
        id: c.id,
        name: c.name,
        buffer: audioEngine.getBuffer(c.sampleId ?? c.id) || undefined,
        startBeat: c.startBeat ?? 0,
        duration: c.duration,
        trackId: c.trackId,
        pitchShift: c.transpose || 0,
        timeStretch: 1.0,
        volume: 1.0,
        pan: 0.0,
        muted: c.muted || false,
        loop: c.loop || false,
      }));

      let targetClips = mappedClips;
      if (showExportDialog === "track") {
        const selectedTrackId = focusedTrackId || selectedTrackIds[0];
        targetClips = selectedTrackId ? mappedClips.filter(c => c.trackId === selectedTrackId) : mappedClips;
      } else if (showExportDialog === "regions") {
        const targetIds = selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : []);
        targetClips = targetIds.length > 0 ? mappedClips.filter(c => targetIds.includes(c.id)) : mappedClips;
      }

      let startBeat = 0;
      let endBeat = 8;
      if (targetClips.length > 0) {
        startBeat = Math.min(...targetClips.map(c => c.startBeat));
        endBeat = Math.max(...targetClips.map(c => c.startBeat + c.duration));
      }

      const { url } = await bounceEngine.bounceProject(
        targetClips,
        mappedTracks,
        startBeat,
        endBeat,
        tempo,
        {
          sampleRate: 44100,
          bitDepth: settings.bitDepth === "16-bit" ? 16 : settings.bitDepth === "24-bit" ? 24 : 32,
          normalize: settings.normalize === "On" || settings.normalize === "Overload Protection Only",
          format: "wav",
        }
      );

      const link = document.createElement("a");
      link.href = url;
      link.download = `${projectName || "Untitled Beat"}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast("Export completed! Your WAV file is downloading.", "success");
    } catch (err) {
      console.error("[ExportDialog] Bounce failed:", err);
      toast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      bounceEngine.removeEventListener(progressListener);
      setExporting(false);
      setProgress(null);
      toggleExportDialog(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9000] flex items-center justify-center p-4 selection:bg-sky-500/30">
      <div className="bg-[#2c2c2e] w-full max-w-xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-8 py-5 flex items-center justify-between border-b border-black/40 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
            <h2 className="text-sm font-black text-white tracking-tight uppercase opacity-90">{title}</h2>
          </div>
          <button onClick={() => toggleExportDialog(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-gray-500 hover:text-white active:scale-90">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1c1c1e]">
          <div className="p-10 grid grid-cols-1 gap-y-8">
            <div className="grid grid-cols-[200px_1fr] gap-y-4 items-center">
              <label className="text-[11px] font-bold text-gray-400 text-right pr-6">File Type:</label>
              <Dropdown
                value={settings.fileType}
                onChange={(v) => setSettings({ ...settings, fileType: v })}
                options={["WAVE"]}
              />

              <label className="text-[11px] font-bold text-gray-400 text-right pr-6">Bit Depth:</label>
              <Dropdown
                value={settings.bitDepth}
                onChange={(v) => setSettings({ ...settings, bitDepth: v })}
                options={["16-bit", "24-bit", "32-bit (float)"]}
              />

              <label className="text-[11px] font-bold text-gray-400 text-right pr-6">Normalize:</label>
              <div>
                <Dropdown
                  value={settings.normalize}
                  onChange={(v) => setSettings({ ...settings, normalize: v })}
                  options={["Off", "Overload Protection Only", "On"]}
                />
              </div>
            </div>

            <div className="mt-4 pt-8 border-t border-white/5">
              <p className="text-center text-[11px] text-gray-500">
                WAV export is the only format currently supported. MP3, AIFF, and other formats are not available in this version.
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 bg-black/20 border-t border-black/40 flex items-center justify-between">
          <div />
          <div className="flex gap-4">
            <button
              onClick={() => toggleExportDialog(null)}
              className="px-8 py-2.5 rounded-xl text-xs font-black text-gray-400 hover:text-white transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-12 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-[0_10px_20px_rgba(14,165,233,0.3)] active:scale-95 transition-all outline-none ring-offset-2 ring-offset-[#2c2c2e] focus:ring-2 focus:ring-sky-500"
            >
              {exporting && progress !== null ? `Exporting (${progress}%)...` : exporting ? "Exporting..." : "EXPORT"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative group max-w-[280px]">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white flex items-center justify-between cursor-pointer hover:bg-black/60 transition-all shadow-inner group-hover:border-white/20"
      >
        <span className="truncate">{value}</span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>
      {isOpen && (
        <div className="absolute top-full mt-1 w-full bg-[#333] border border-white/10 rounded-lg shadow-2xl z-[9001] overflow-hidden py-1 animate-in slide-in-from-top-1 duration-150">
          {options.map((opt) => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              className={`px-3 py-2 text-[11px] font-medium cursor-pointer transition-colors flex items-center justify-between ${value === opt ? "bg-sky-500 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
            >
              {opt}
              {value === opt && <Check className="w-3 h-3" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
