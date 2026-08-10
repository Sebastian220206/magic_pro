import { useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { X, ChevronDown, Check } from "lucide-react";
import { useToast } from "./Toast";
import { downloadExport } from "@/engine/export/projectExport";

export function ExportDialog() {
  const {
    showExportDialog,
    toggleExportDialog,
    clips,
    name: projectName,
    selectedClipIds,
    selectedClipId,
    focusedTrackId,
    selectedTrackIds,
    exportProject,
    exportStems,
  } = useProjectStore();
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    fileType: "WAVE",
    bitDepth: "24-bit",
    normalize: "Overload Protection Only",
  });

  /** Stems: one aligned file per bus, for delivery or a remix pack. */
  const [asStems, setAsStems] = useState(false);
  const [metadata, setMetadata] = useState({ title: "", artist: "", isrc: "" });

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  if (!showExportDialog) return null;

  const title =
    showExportDialog === "track"
      ? "Export Selected Track"
      : showExportDialog === "all"
        ? "Export All Tracks"
        : "Export Selected Regions";

  /**
   * Render and download the project.
   *
   * This used to go through `bounceEngine` with `effects: []` and
   * `sends: []` hardcoded — so no plugin ever reached the file — and read
   * `c.startBeat`, which project clips do not have, so every region exported
   * stacked at beat 0. It now uses the same offline path playback uses.
   */
  const handleExport = async () => {
    setExporting(true);
    setProgress(null);

    try {
      const selectedTrackId = focusedTrackId || selectedTrackIds[0];
      const regionIds = selectedClipIds.length > 0
        ? selectedClipIds
        : (selectedClipId ? [selectedClipId] : []);

      // Scope the render to whatever the dialog was opened for.
      let startBeat: number | undefined;
      let endBeat: number | undefined;
      let trackIds: string[] | undefined;

      if (showExportDialog === "track" && selectedTrackId) {
        trackIds = [selectedTrackId];
      } else if (showExportDialog === "regions" && regionIds.length > 0) {
        const regions = clips.filter(c => regionIds.includes(c.id));
        if (regions.length > 0) {
          startBeat = Math.min(...regions.map(c => c.start ?? 0));
          endBeat = Math.max(...regions.map(c => (c.start ?? 0) + c.duration));
          trackIds = [...new Set(regions.map(c => c.trackId))];
        }
      }

      const tags = {
        title: metadata.title.trim() || undefined,
        artist: metadata.artist.trim() || undefined,
        isrc: metadata.isrc.trim() || undefined,
      };
      const depth = settings.bitDepth === "16-bit" ? 16 : settings.bitDepth === "24-bit" ? 24 : 32;

      if (asStems) {
        const stems = await exportStems({ bitDepth: depth, startBeat, endBeat });
        stems.forEach(stem => downloadExport({ blob: stem.blob, fileName: stem.fileName }));
        const degraded = stems.filter(s => s.degraded).length;
        toast(
          degraded > 0
            ? `Exported ${stems.length} stems; ${degraded} rendered without plugins.`
            : `Exported ${stems.length} stems.`,
          degraded > 0 ? "error" : "success",
        );
        return;
      }

      const result = await exportProject({
        format: settings.fileType === "MP3" ? "mp3" : "wav",
        bitDepth: depth,
        startBeat,
        endBeat,
        trackIds,
        fileName: projectName || "Untitled Beat",
        metadata: tags,
      });

      downloadExport(result);

      if (result.degradedTracks.length > 0) {
        toast(
          `Exported, but ${result.degradedTracks.length} track(s) rendered without plugins.`,
          "error",
        );
      } else if (result.formatNotice) {
        toast(result.formatNotice, "success");
      } else {
        const { integratedLufs, truePeakDb } = result.loudness;
        toast(
          `Exported — ${integratedLufs.toFixed(1)} LUFS, true peak ${truePeakDb.toFixed(1)} dBTP.`,
          truePeakDb > -1 ? "error" : "success",
        );
      }
    } catch (err) {
      console.error("[ExportDialog] Export failed:", err);
      toast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setExporting(false);
      setProgress(null);
      toggleExportDialog(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9000] flex items-center justify-center p-4 selection:bg-accent-cyan/30">
      <div className="bg-studio-control w-full max-w-xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-8 py-5 flex items-center justify-between border-b border-black/40 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-accent-cyan shadow-[0_0_10px_rgba(14,165,233,0.5)]"></div>
            <h2 className="text-sm font-black text-white tracking-tight uppercase opacity-90">{title}</h2>
          </div>
          <button onClick={() => toggleExportDialog(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-studio-text-dim hover:text-white active:scale-90">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-studio-panel">
          <div className="p-10 grid grid-cols-1 gap-y-8">
            <div className="grid grid-cols-[200px_1fr] gap-y-4 items-center">
              <label className="text-[11px] font-bold text-studio-text-mid text-right pr-6">File Type:</label>
              <Dropdown
                value={settings.fileType}
                onChange={(v) => setSettings({ ...settings, fileType: v })}
                options={["WAVE"]}
              />

              <label className="text-[11px] font-bold text-studio-text-mid text-right pr-6">Bit Depth:</label>
              <Dropdown
                value={settings.bitDepth}
                onChange={(v) => setSettings({ ...settings, bitDepth: v })}
                options={["16-bit", "24-bit", "32-bit (float)"]}
              />

              <label className="text-[11px] font-bold text-studio-text-mid text-right pr-6">Stems:</label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={asStems}
                  onChange={e => setAsStems(e.target.checked)}
                  className="accent-cyan-400 w-4 h-4"
                />
                <span className="text-[11px] text-studio-text-mid">
                  One aligned file per bus, all the same length
                </span>
              </label>

              <label className="text-[11px] font-bold text-studio-text-mid text-right pr-6">Title:</label>
              <input
                value={metadata.title}
                onChange={e => setMetadata({ ...metadata, title: e.target.value })}
                placeholder={projectName || "Untitled"}
                className="bg-black/40 border border-white/10 rounded px-3 h-9 text-[12px] text-white placeholder:text-studio-text-dim focus:border-accent-cyan outline-none"
              />

              <label className="text-[11px] font-bold text-studio-text-mid text-right pr-6">Artist:</label>
              <input
                value={metadata.artist}
                onChange={e => setMetadata({ ...metadata, artist: e.target.value })}
                className="bg-black/40 border border-white/10 rounded px-3 h-9 text-[12px] text-white focus:border-accent-cyan outline-none"
              />

              <label className="text-[11px] font-bold text-studio-text-mid text-right pr-6">ISRC:</label>
              <input
                value={metadata.isrc}
                onChange={e => setMetadata({ ...metadata, isrc: e.target.value.toUpperCase() })}
                placeholder="CCXXXYYNNNNN"
                maxLength={12}
                className="bg-black/40 border border-white/10 rounded px-3 h-9 text-[12px] text-white placeholder:text-studio-text-dim font-mono focus:border-accent-cyan outline-none"
              />

              <label className="text-[11px] font-bold text-studio-text-mid text-right pr-6">Normalize:</label>
              <div>
                <Dropdown
                  value={settings.normalize}
                  onChange={(v) => setSettings({ ...settings, normalize: v })}
                  options={["Off", "Overload Protection Only", "On"]}
                />
              </div>
            </div>

            <div className="mt-4 pt-8 border-t border-white/5">
              <p className="text-center text-[11px] text-studio-text-dim">
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
              className="px-8 py-2.5 rounded-xl text-xs font-black text-studio-text-mid hover:text-white transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-12 py-2.5 bg-accent-cyan hover:bg-accent-cyan disabled:bg-accent-cyan/50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-[0_10px_20px_rgba(14,165,233,0.3)] active:scale-95 transition-all outline-none ring-offset-2 ring-offset-[#2c2c2e] focus:ring-2 focus:ring-accent-cyan"
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
        <ChevronDown className={`w-4 h-4 text-studio-text-dim transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>
      {isOpen && (
        <div className="absolute top-full mt-1 w-full bg-studio-control border border-white/10 rounded-lg shadow-2xl z-[9001] overflow-hidden py-1 animate-in slide-in-from-top-1 duration-150">
          {options.map((opt) => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              className={`px-3 py-2 text-[11px] font-medium cursor-pointer transition-colors flex items-center justify-between ${value === opt ? "bg-accent-cyan text-white" : "text-studio-text-mid hover:bg-white/5 hover:text-white"}`}
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
