"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import {
  MousePointer2, Pencil, Eraser, Type, Scissors,
  Combine, Ear, VolumeX, Search,
  MousePointerClick, PenTool, Crop, GitFork
} from "lucide-react"

export type EditTool =
  | 'pointer' | 'pencil' | 'draw' | 'erase' | 'text' | 'scissors'
  | 'glue' | 'solo' | 'mute' | 'zoom' | 'fade'
  | 'automation-select' | 'automation-curve' | 'marquee' | 'flex'

interface ToolDef {
  id: EditTool
  name: string
  icon: any
  shortcut: string
}

export const TOOLS: ToolDef[] = [
  { id: 'pointer',          name: 'Pointer Tool',          icon: MousePointer2,      shortcut: 'A' },
  { id: 'pencil',           name: 'Pencil Tool',           icon: Pencil,             shortcut: 'P' },
  { id: 'erase',            name: 'Eraser Tool',           icon: Eraser,             shortcut: 'E' },
  { id: 'text',             name: 'Text Tool',             icon: Type,               shortcut: 'T' },
  { id: 'scissors',         name: 'Scissors Tool',         icon: Scissors,           shortcut: 'S' },
  { id: 'glue',             name: 'Glue Tool',             icon: Combine,            shortcut: 'G' },
  { id: 'solo',             name: 'Solo Tool',             icon: Ear,                shortcut: 'O' },
  { id: 'mute',             name: 'Mute Tool',             icon: VolumeX,            shortcut: 'M' },
  { id: 'zoom',             name: 'Zoom Tool',             icon: Search,             shortcut: 'Z' },
  { id: 'fade',             name: 'Fade Tool',             icon: FadeIcon,           shortcut: 'F' },
  { id: 'automation-select',name: 'Automation Select Tool', icon: MousePointerClick, shortcut: 'Q' },
  { id: 'automation-curve', name: 'Automation Curve Tool', icon: PenTool, shortcut: 'W' },
  { id: 'marquee',          name: 'Marquee Tool',          icon: Crop,               shortcut: 'R' },
  { id: 'flex',             name: 'Flex Tool',             icon: GitFork,            shortcut: 'X' },
]

function FadeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M3 12h4l2-3 2 3 2-3 2 3 2-3 2 3h4" />
      <path d="M3 12v-2M21 12v-2" opacity="0.4" />
    </svg>
  )
}

interface Props {
  anchorEl: HTMLElement | null
  onClose: () => void
  open?: boolean
}

export function ToolsMenu({ anchorEl, onClose, open }: Props) {
  const { currentTool, setCurrentTool, showToolsMenu: globalShow } = useProjectStore()
  const showToolsMenu = open !== undefined ? open : globalShow
  const menuRef = useRef<HTMLDivElement>(null)
  const [focusIdx, setFocusIdx] = useState(-1)
  const [visible, setVisible] = useState(false)
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 })

  // Position the menu below the anchor element
  useEffect(() => {
    if (!anchorEl || !showToolsMenu) return
    const rect = anchorEl.getBoundingClientRect()
    setStyle({
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${Math.max(4, rect.left)}px`,
      opacity: 1,
    })
  }, [anchorEl, showToolsMenu])

  // Animate in
  useEffect(() => {
    if (showToolsMenu) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [showToolsMenu])

  // Reset focus on open
  useEffect(() => {
    if (showToolsMenu) setFocusIdx(TOOLS.findIndex(t => t.id === currentTool))
  }, [showToolsMenu, currentTool])

  const handleSelect = useCallback((tool: EditTool) => {
    setCurrentTool(tool)
    onClose()
  }, [setCurrentTool, onClose])

  // Keyboard navigation within the menu
  useEffect(() => {
    if (!showToolsMenu) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        const tool = TOOLS[focusIdx]
        if (tool) handleSelect(tool.id)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusIdx(i => (i + 1) % TOOLS.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusIdx(i => (i - 1 + TOOLS.length) % TOOLS.length)
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [showToolsMenu, onClose, handleSelect, focusIdx])

  if (!showToolsMenu) return null

  return (
    <>
      <div className="fixed inset-0 z-[8000]" onClick={onClose} />
      <div
        ref={menuRef}
        role="menu"
        aria-label="Editing Tools"
        style={style}
        className={`z-[8001] w-[240px] bg-[#29323c]/95 backdrop-blur-2xl rounded-md border border-white/10 shadow-2xl shadow-black/60 py-1 overflow-hidden transition-all duration-120 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {TOOLS.map((tool, i) => {
          const Icon = tool.icon
          const isActive = currentTool === tool.id
          const isFocused = i === focusIdx
          return (
            <button
              key={tool.id}
              role="menuitem"
              aria-label={tool.name}
              onClick={() => handleSelect(tool.id)}
              onMouseEnter={() => setFocusIdx(i)}
              onMouseLeave={() => setFocusIdx(-1)}
              className={`w-full flex items-center px-2 py-1 text-left ${
                isFocused
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-200'
              }`}
            >
              <div className="w-5 flex justify-center items-center shrink-0">
                {isActive && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 5L3.5 7.5L9 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div className="w-6 flex justify-center items-center shrink-0">
                <Icon className="w-3.5 h-3.5 opacity-90" />
              </div>
              <span className="flex-1 text-[13px] tracking-wide ml-1 font-[400]">{tool.name}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
