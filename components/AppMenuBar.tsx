"use client"
import React, { useState, useEffect, useRef } from "react"
import { useProjectStore } from "@/store/projectStore"

export function AppMenuBar() {
    const { setShowSettingsDialog } = useProjectStore();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);
    const [menuExpanded, setMenuExpanded] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [batteryLevel, setBatteryLevel] = useState(0.85);
    const [batteryCharging, setBatteryCharging] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if ('getBattery' in navigator) {
            (navigator as any).getBattery().then((battery: any) => {
                setBatteryLevel(battery.level);
                setBatteryCharging(battery.charging);
                battery.addEventListener('levelchange', () => setBatteryLevel(battery.level));
                battery.addEventListener('chargingchange', () => setBatteryCharging(battery.charging));
            });
        }
    }, []);

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

    const menuDefs: Record<string, { label: string; shortcut?: string; action?: () => void }[]> = {
        logic: [
            { label: "About Magic Pro" },
            { separator: true } as any,
            { label: "Preferences - General...", action: () => setShowSettingsDialog(true, "General") },
            { label: "Preferences - Audio...", action: () => setShowSettingsDialog(true, "Audio") },
            { label: "Preferences - Recording...", action: () => setShowSettingsDialog(true, "Recording") },
            { label: "Preferences - MIDI...", action: () => setShowSettingsDialog(true, "MIDI") },
            { label: "Preferences - Display...", action: () => setShowSettingsDialog(true, "View") },
            { separator: true } as any,
            { label: "Quit Magic Pro" },
        ],
        File: [
            { label: "New", shortcut: "Cmd+N" },
            { label: "Open...", shortcut: "Cmd+O" },
            { separator: true } as any,
            { label: "Save", shortcut: "Cmd+S" },
            { label: "Save As...", shortcut: "Cmd+Shift+S" },
            { separator: true } as any,
            { label: "Export Audio..." },
        ],
        Edit: [
            { label: "Undo", shortcut: "Cmd+Z" },
            { label: "Redo", shortcut: "Cmd+Shift+Z" },
            { separator: true } as any,
            { label: "Cut", shortcut: "Cmd+X" },
            { label: "Copy", shortcut: "Cmd+C" },
            { label: "Paste", shortcut: "Cmd+V" },
            { label: "Delete", shortcut: "Delete" },
            { separator: true } as any,
            { label: "Select All", shortcut: "Cmd+A" },
        ],
        Track: [
            { label: "New Track...", shortcut: "Cmd+Opt+N" },
            { label: "Duplicate Track", shortcut: "Cmd+D" },
            { label: "Delete Track" },
            { separator: true } as any,
            { label: "Create Track Stack" },
        ],
        Navigate: [
            { label: "Go to Beginning", shortcut: "Return" },
            { label: "Go to End" },
            { label: "Go to Selection", shortcut: "Shift+Return" },
            { label: "Go to Locator" },
        ],
        Record: [
            { label: "Record", shortcut: "R" },
            { label: "Record with Count-In" },
            { label: "Autopunch Record" },
            { label: "Record Replace" },
        ],
        Setting: [
            { label: "General...", action: () => setShowSettingsDialog(true, "General") },
            { label: "Audio...", action: () => setShowSettingsDialog(true, "Audio") },
            { label: "Recording...", action: () => setShowSettingsDialog(true, "Recording") },
            { label: "MIDI...", action: () => setShowSettingsDialog(true, "MIDI") },
            { label: "Display...", action: () => setShowSettingsDialog(true, "View") },
        ],
        Mix: [
            { label: "Show Mixer", shortcut: "Cmd+M" },
            { label: "Show Channel EQ" },
            { label: "Show Dynamics" },
        ],
        View: [
            { label: "Show Editor" },
            { label: "Show Mixer" },
            { label: "Show Toolbar" },
            { separator: true } as any,
            { label: "Full Screen", shortcut: "Ctrl+Cmd+F" },
        ],
        Window: [
            { label: "Minimize", shortcut: "Cmd+M" },
            { label: "Zoom" },
            { separator: true } as any,
            { label: "Cycle Through Windows" },
        ],
        Help: [
            { label: "Logic Pro Help", shortcut: "Cmd+?" },
            { separator: true } as any,
            { label: "Keyboard Shortcuts..." },
            { separator: true } as any,
            { label: "About Magic Pro" },
        ],
    };

    const leftMenus = ["File", "Edit", "Track", "Navigate", "Record"];
    const rightMenus = ["Setting", "Mix", "View", "Window", "Help"];

    const renderDropdown = (menuName: string) => {
        const items = menuDefs[menuName];
        if (!items) return null;
        return (
            <div className="absolute top-[24px] left-0 min-w-[220px] bg-[#e2e2e2]/95 backdrop-blur-md border border-[#a5a5a5] shadow-2xl rounded-b-md py-1 z-[120]">
                {items.map((item: any, idx: number) =>
                    item.label === "separator" || item.separator ? (
                        <div key={idx} className="h-[1px] bg-black/15 my-1 mx-2" />
                    ) : (
                        <div
                            key={idx}
                            onMouseEnter={() => setHoveredMenuItem(item.label)}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (item.action) {
                                    item.action();
                                    setActiveMenu(null);
                                }
                            }}
                            className={`px-4 py-0.5 flex items-center justify-between text-[13px] cursor-default ${
                                hoveredMenuItem === item.label
                                    ? "bg-[#0058d8] text-white"
                                    : "text-black/90 hover:bg-[#0058d8] hover:text-white"
                            }`}
                        >
                            <span>{item.label}</span>
                            {item.shortcut && (
                                <span className="text-[11px] font-medium opacity-60 ml-8">{item.shortcut}</span>
                            )}
                        </div>
                    )
                )}
            </div>
        );
    };

    const renderMenuItem = (menu: string) => {
        const isActive = activeMenu === menu;
        return (
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(isActive ? null : menu);
                    setHoveredMenuItem(null);
                }}
                onMouseEnter={() => activeMenu && setActiveMenu(menu)}
                className={`px-3 h-full flex items-center cursor-default transition-colors whitespace-nowrap ${
                    isActive ? "bg-[#0058d8] text-white" : "hover:bg-black/10"
                }`}
            >
                {menu}
            </div>
        );
    };

    return (
        <div ref={menuRef} className="h-[24px] bg-gradient-to-b from-[#e7e7e7] to-[#d1d1d1] border-b border-[#a5a5a5] flex items-center px-2 shrink-0 z-[110] select-none text-[12px] font-sans text-black/90 shadow-sm relative">
            <div className="flex items-center h-full">
                <div className="px-3 hover:bg-black/10 h-full flex items-center cursor-default transition-colors">
                    <svg viewBox="0 0 16 16" className="w-[14px] h-[14px] fill-black/80" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.152 8.9c-.012-1.295 1.059-1.92 1.109-1.95-.602-.879-1.537-.999-1.871-1.013-.797-.081-1.558.47-1.962.47-.404 0-1.018-.459-1.684-.446-.879.013-1.691.512-2.144 1.297-.914 1.577-.234 3.913.654 5.196.435.627.952 1.33 1.632 1.305.654-.025.901-.423 1.691-.423.79 0 1.013.423 1.699.41.701-.013 1.155-.64 1.587-1.269.499-.731.705-1.44.717-1.477-.013-.006-1.381-.53-1.396-2.11zM10.154 4.195c.358-.435.6-.1.737-.899.137-.799-.059-1.583-.059-1.583s-.664.027-1.282.748c-.411.481-.722 1.139-.623 1.831.099.692.651.83.651.83l.576-.927z" />
                    </svg>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center h-full">
                {/* Left menus — slide in from left */}
                <div className="flex items-center h-full">
                    {leftMenus.map((menu, i) => (
                        <div
                            key={menu}
                            className={`transition-all duration-200 ${
                                menuExpanded
                                    ? "opacity-100 max-w-[80px] translate-x-0"
                                    : "opacity-0 max-w-0 translate-x-4 overflow-hidden"
                            }`}
                            style={{ transitionDelay: `${i * 30}ms` }}
                        >
                            <div className="h-full flex items-center relative">
                                {renderMenuItem(menu)}
                                {activeMenu === menu && renderDropdown(menu)}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Magic Pro toggle button */}
                <div
                    onClick={() => {
                        if (menuExpanded) {
                            setMenuExpanded(false);
                            setActiveMenu(null);
                        } else {
                            setMenuExpanded(true);
                            setActiveMenu(null);
                        }
                    }}
                    onMouseEnter={() => !menuExpanded && activeMenu && setActiveMenu("logic")}
                    className={`px-3 h-full flex items-center cursor-default transition-colors tracking-tight font-bold shrink-0 relative ${
                        menuExpanded || activeMenu === "logic" ? "bg-[#0058d8] text-white" : "hover:bg-black/10"
                    }`}
                >
                    Magic Pro

                    {!menuExpanded && activeMenu === "logic" && renderDropdown("logic")}
                </div>

                {/* Right menus — slide in from right */}
                <div className="flex items-center h-full">
                    {rightMenus.map((menu, i) => (
                        <div
                            key={menu}
                            className={`transition-all duration-200 ${
                                menuExpanded
                                    ? "opacity-100 max-w-[80px] translate-x-0"
                                    : "opacity-0 max-w-0 -translate-x-4 overflow-hidden"
                            }`}
                            style={{ transitionDelay: `${i * 30}ms` }}
                        >
                            <div className="h-full flex items-center relative">
                                {renderMenuItem(menu)}
                                {activeMenu === menu && renderDropdown(menu)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center h-full gap-3 px-4 overflow-hidden">
                {/* WiFi icon */}
                <div className="relative w-3.5 h-3.5" title={isOnline ? 'Connected' : 'Offline'}>
                    <svg viewBox="0 0 24 24" className={`w-full h-full ${isOnline ? 'fill-black/70' : 'fill-black/30'}`}>
                        <path d="M12 18a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
                        <path d="M12 13.5a5.5 5.5 0 0 0-3.89 1.61l1.42 1.42a3.5 3.5 0 0 1 4.94 0l1.42-1.42A5.5 5.5 0 0 0 12 13.5z" opacity={isOnline ? 0.8 : 0.3} />
                        <path d="M12 9a9.5 9.5 0 0 0-6.72 2.78l1.42 1.42a7.5 7.5 0 0 1 10.6 0l1.42-1.42A9.5 9.5 0 0 0 12 9z" opacity={isOnline ? 0.6 : 0.2} />
                    </svg>
                    {!isOnline && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-full h-[1px] bg-black/50 rotate-45" />
                        </div>
                    )}
                </div>

                {/* Battery icon */}
                <div className="flex items-center gap-1" title={`${Math.round(batteryLevel * 100)}%${batteryCharging ? ' (charging)' : ''}`}>
                    <div className="w-5 h-3 border border-black/40 rounded-[2px] relative flex items-center p-[1px]">
                        <div
                            className={`h-full rounded-[1px] transition-all duration-500 ${
                                batteryLevel > 0.5 ? 'bg-black/60' : batteryLevel > 0.2 ? 'bg-amber-500/80' : 'bg-red-500/80'
                            }`}
                            style={{ width: `${batteryLevel * 100}%` }}
                        />
                        {batteryCharging && (
                            <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full p-[2px] fill-black/70">
                                <path d="M13 4h-2l-4 10h3l-2 6h2l4-10h-3z" />
                            </svg>
                        )}
                        <div className="absolute -right-[2px] top-1/2 -translate-y-1/2 w-[1.5px] h-2 bg-black/40 rounded-r-sm" />
                    </div>
                </div>

                {/* Live clock */}
                <div className="text-[11px] font-semibold text-black/80 whitespace-nowrap tabular-nums">
                    {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                    {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </div>
            </div>
        </div>
    )
}
