"use client"
import React, { useState, useEffect, useRef } from "react"
import { useProjectStore } from "@/store/projectStore"

export function AppMenuBar() {
    const { setShowSettingsDialog } = useProjectStore();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenu(null);
                setHoveredMenuItem(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const preferencesMenu = [
        { label: "General..." },
        { label: "Audio..." },
        { label: "Recording..." },
        { label: "MIDI..." },
        { label: "Display..." },
    ];

    const logicMenu = [
        { label: "About Magic Pro X" },
        { separator: true },
        { label: "Preferences", id: "prefs", hasSubmenu: true, subItems: preferencesMenu },
        { separator: true },
        { label: "Quit Magic Pro X" },
    ];

    return (
        <div ref={menuRef} className="h-[24px] bg-gradient-to-b from-[#e7e7e7] to-[#d1d1d1] border-b border-[#a5a5a5] flex items-center px-2 shrink-0 z-[110] select-none text-[12px] font-sans text-black/90 shadow-sm relative">
            <div className="flex items-center h-full">
                <div className="px-3 hover:bg-black/10 h-full flex items-center cursor-default transition-colors">
                    <svg viewBox="0 0 16 16" className="w-[14px] h-[14px] fill-black/80" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.152 8.9c-.012-1.295 1.059-1.92 1.109-1.95-.602-.879-1.537-.999-1.871-1.013-.797-.081-1.558.47-1.962.47-.404 0-1.018-.459-1.684-.446-.879.013-1.691.512-2.144 1.297-.914 1.577-.234 3.913.654 5.196.435.627.952 1.33 1.632 1.305.654-.025.901-.423 1.691-.423.79 0 1.013.423 1.699.41.701-.013 1.155-.64 1.587-1.269.499-.731.705-1.44.717-1.477-.013-.006-1.381-.53-1.396-2.11zM10.154 4.195c.358-.435.6-.1.737-.899.137-.799-.059-1.583-.059-1.583s-.664.027-1.282.748c-.411.481-.722 1.139-.623 1.831.099.692.651.83.651.83l.576-.927z" />
                    </svg>
                </div>
                <div
                    onClick={() => setActiveMenu(activeMenu === "logic" ? null : "logic")}
                    onMouseEnter={() => activeMenu && setActiveMenu("logic")}
                    className={`px-3 h-full flex items-center cursor-default transition-colors tracking-tight font-bold ${
                        activeMenu === "logic" ? "bg-[#0058d8] text-white" : "hover:bg-black/10"
                    }`}
                >
                    Magic Pro X

                    {activeMenu === "logic" && (
                        <div className="absolute top-[24px] left-0 w-[240px] bg-[#e2e2e2]/95 backdrop-blur-md border border-[#a5a5a5] shadow-2xl rounded-b-md py-1 z-[120]">
                            {logicMenu.map((menuItem: any, idx: number) =>
                                menuItem.separator ? (
                                    <div key={idx} className="h-[1px] bg-black/15 my-1 mx-1" />
                                ) : (
                                    <div
                                        key={idx}
                                        onMouseEnter={() => setHoveredMenuItem(menuItem.id || menuItem.label)}
                                        className={`px-5 py-0.5 flex items-center justify-between text-[13px] transition-colors cursor-default relative ${
                                            hoveredMenuItem === (menuItem.id || menuItem.label)
                                                ? "bg-[#0058d8] text-white"
                                                : "text-black/90 hover:bg-[#0058d8] hover:text-white"
                                        }`}
                                    >
                                        <span>{menuItem.label}</span>
                                        <div className="flex items-center gap-2">
                                            {menuItem.shortcut && (
                                                <span className="text-[11px] font-medium opacity-60">{menuItem.shortcut}</span>
                                            )}
                                            {menuItem.hasSubmenu && (
                                                <svg viewBox="0 0 24 24" className="w-3.4 h-3.4 fill-current opacity-60">
                                                    <path d="M10 17l5-5-5-5v10z" />
                                                </svg>
                                            )}
                                        </div>

                                        {menuItem.subItems && hoveredMenuItem === menuItem.id && (
                                            <div className="absolute top-[-4px] left-[238px] w-[200px] bg-[#e2e2e2]/95 backdrop-blur-md border border-[#a5a5a5] shadow-2xl rounded-md py-1 z-[130]">
                                                {menuItem.subItems.map((subItem: any, sIdx: number) => {
                                                    const tabMapping: Record<string, string> = {
                                                        "General...": "General",
                                                        "Audio...": "Audio",
                                                        "Recording...": "Recording",
                                                        "MIDI...": "MIDI",
                                                        "Display...": "View",
                                                    };
                                                    return (
                                                        <div
                                                            key={sIdx}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const tab = tabMapping[subItem.label] || "Audio";
                                                                setShowSettingsDialog(true, tab);
                                                                setActiveMenu(null);
                                                            }}
                                                            className="px-5 py-0.5 flex items-center justify-between text-[13px] text-black/90 hover:bg-[#0058d8] hover:text-white transition-colors cursor-default"
                                                        >
                                                            {subItem.label}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 h-full" />

            <div className="flex items-center h-full gap-4 px-4 overflow-hidden">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-black/70">
                    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-black/70">
                    <circle cx="12" cy="18" r="2" fill="currentColor" />
                    <path d="M5 12.5a10 10 0 0 1 14 0M8.5 15a5 5 0 0 1 7 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
                <div className="w-6 h-3 border border-black/40 rounded-sm relative flex items-center p-[1px]">
                    <div className="h-full w-[80%] bg-black/60 rounded-[1px]" />
                    <div className="absolute -right-[2px] top-1/2 -translate-y-1/2 w-[1px] h-1 bg-black/40 rounded-r-sm" />
                </div>
                <div className="text-[11px] font-semibold text-black/80 whitespace-nowrap">
                    Fri Apr 17 12:48 PM
                </div>
            </div>
        </div>
    )
}
