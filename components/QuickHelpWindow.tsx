import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { QUICK_HELP_DATA } from '@/data/quickHelpData'

interface QuickHelpWindowProps {
    onClose: () => void
}

export function QuickHelpWindow({ onClose }: QuickHelpWindowProps) {
    const { hoveredHelpId } = useProjectStore()
    const [displayData, setDisplayData] = useState(QUICK_HELP_DATA['quick_help'])
    const [isTransitioning, setIsTransitioning] = useState(false)

    useEffect(() => {
        if (!hoveredHelpId) {
            // Revert to default/static help or keep last (usually Logic reverts to default or "Hover over element")
            setIsTransitioning(true)
            const timer = setTimeout(() => {
                setDisplayData({
                    id: 'idle',
                    name: 'Quick Help',
                    description: 'Hover over a control to see help.'
                })
                setIsTransitioning(false)
            }, 50)
            return () => clearTimeout(timer)
        }

        const newData = QUICK_HELP_DATA[hoveredHelpId]
        if (newData) {
            setIsTransitioning(true)
            const timer = setTimeout(() => {
                setDisplayData(newData)
                setIsTransitioning(false)
            }, 50) // Very fast transition for instant feel
            return () => clearTimeout(timer)
        }
    }, [hoveredHelpId])

    return (
        <div className="fixed top-24 left-24 z-[2500] bg-[#e6e6e8] rounded-xl border border-[#c4c4c4] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 w-[340px] select-none pointer-events-none">
            {/* macOS Style Title Bar */}
            <div className="bg-[#f0f0f2] border-b border-[#c4c4c4] px-4 py-2.5 flex items-center justify-center relative cursor-move pointer-events-auto">
                <div className="absolute left-3 flex gap-1.5 pt-0.5">
                    <div onClick={onClose} className="w-3 h-3 rounded-full bg-[#bfbfbf] hover:bg-[#ff5f57] border border-black/10 transition-colors cursor-pointer" />
                    <div className="w-3 h-3 rounded-full bg-[#bfbfbf] border border-black/10" />
                    <div className="w-3 h-3 rounded-full bg-[#bfbfbf] border border-black/10" />
                </div>
                <span className="text-[13px] font-bold text-[#5c5c5e]">Quick Help</span>
            </div>

            {/* Content Area */}
            <div className={`p-6 bg-[#f0f0f2]/95 backdrop-blur-md text-[#2c2c2e] min-h-[160px] transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                <div className="space-y-4">
                    <div>
                        <h2 className="text-[15px] font-black leading-tight mb-2 uppercase tracking-wide">
                            {displayData.name}
                        </h2>
                        <p className="text-[14px] font-medium leading-[1.5] text-[#3c3c3e]">
                            {displayData.description}
                        </p>
                    </div>
                    
                    {displayData.tip && (
                        <div>
                            <p className="text-[13px] font-black leading-tight text-[#2c2c2e]">
                                Tip: <span className="font-medium text-[#4c4c4e]">{displayData.tip}</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Subtle bottom shadow/border */}
            <div className="h-px bg-white/40" />
        </div>
    )
}
