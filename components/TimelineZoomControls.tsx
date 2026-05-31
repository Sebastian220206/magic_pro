"use client"
import { useState, useCallback } from "react"
import { ZoomIn, ZoomOut, Maximize2, Move } from "lucide-react"
import { useTimelineZoom } from "@/engine/timelineZoom"
import { useProjectStore } from "@/store/projectStore"

export function TimelineZoomControls() {
    const { tempo } = useProjectStore()
    const timeline = useTimelineZoom()
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, scrollX: 0 })

    // Update tempo in timeline zoom manager
    timeline.setTempo(tempo)

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsDragging(true)
        setDragStart({ x: e.clientX, scrollX: timeline.viewport.scrollX })
        e.preventDefault()
    }, [timeline.viewport.scrollX])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return
        const deltaX = e.clientX - dragStart.x
        timeline.setScrollX(dragStart.scrollX - deltaX)
    }, [isDragging, dragStart, timeline])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault()
        
        if (e.ctrlKey || e.metaKey) {
            // Zoom with Ctrl/Cmd + scroll
            const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1
            const newZoom = timeline.viewport.zoomLevel * (1 + zoomDelta)
            timeline.setZoom(newZoom)
        } else {
            // Horizontal scroll with regular scroll
            const scrollDelta = e.deltaY * 2
            timeline.setScrollX(timeline.viewport.scrollX + scrollDelta)
        }
    }, [timeline])

    return (
        <div className="flex items-center gap-2 bg-[#1a1a1a] border-b border-black px-3 py-2 h-8">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => timeline.zoomOut()}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Zoom Out (Ctrl+Scroll Down)"
                >
                    <ZoomOut className="w-4 h-4 text-gray-400" />
                </button>
                
                <div className="min-w-[60px] text-center text-xs text-gray-400 font-mono">
                    {Math.round(timeline.viewport.zoomLevel)}px/beat
                </div>
                
                <button
                    onClick={() => timeline.zoomIn()}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Zoom In (Ctrl+Scroll Up)"
                >
                    <ZoomIn className="w-4 h-4 text-gray-400" />
                </button>
                
                <button
                    onClick={() => timeline.resetZoom()}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Reset Zoom"
                >
                    <Maximize2 className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            {/* Separator */}
            <div className="w-px h-4 bg-gray-700" />

            {/* Pan/Scroll Area */}
            <div 
                className={`flex-1 h-6 bg-[#0a0a0a] border border-[#333] rounded cursor-move flex items-center justify-center text-xs text-gray-600 select-none ${
                    isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                title="Drag to pan, scroll to move, Ctrl+scroll to zoom"
            >
                <Move className="w-3 h-3" />
                <span className="ml-2">
                    Beat {timeline.screenXToBeat(0).toFixed(1)} - {timeline.screenXToBeat(timeline.viewport.viewportWidth).toFixed(1)}
                </span>
            </div>

            {/* Quick Zoom Presets */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => timeline.setZoom(10)}
                    className="px-2 py-1 text-xs bg-[#0a0a0a] border border-[#333] rounded hover:bg-white/10 transition-colors text-gray-400"
                    title="Wide View"
                >
                    Wide
                </button>
                <button
                    onClick={() => timeline.setZoom(20)}
                    className="px-2 py-1 text-xs bg-[#0a0a0a] border border-[#333] rounded hover:bg-white/10 transition-colors text-gray-400"
                    title="Normal View"
                >
                    Normal
                </button>
                <button
                    onClick={() => timeline.setZoom(50)}
                    className="px-2 py-1 text-xs bg-[#0a0a0a] border border-[#333] rounded hover:bg-white/10 transition-colors text-gray-400"
                    title="Close View"
                >
                    Close
                </button>
            </div>
        </div>
    )
}
