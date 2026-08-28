"use client"
import React, { useState, useEffect, useRef } from "react"
import { useProjectStore } from "@/store/projectStore"
import { ProjectManager } from "./ProjectManager"

export function AppMenuBar() {
    const { setShowSettingsDialog } = useProjectStore();
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





    return (
        <div ref={menuRef} className="h-[24px] bg-gradient-to-b from-studio-raised to-studio-control border-b border-studio-line-strong flex items-center px-2 shrink-0 z-[110] select-none text-[12px] font-sans text-studio-text shadow-sm relative">
            <div className="flex items-center h-full">
                <div className="px-3 hover:bg-black/10 h-full flex items-center cursor-default transition-colors">
                    <svg viewBox="0 0 16 16" className="w-[14px] h-[14px] fill-studio-text" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.152 8.9c-.012-1.295 1.059-1.92 1.109-1.95-.602-.879-1.537-.999-1.871-1.013-.797-.081-1.558.47-1.962.47-.404 0-1.018-.459-1.684-.446-.879.013-1.691.512-2.144 1.297-.914 1.577-.234 3.913.654 5.196.435.627.952 1.33 1.632 1.305.654-.025.901-.423 1.691-.423.79 0 1.013.423 1.699.41.701-.013 1.155-.64 1.587-1.269.499-.731.705-1.44.717-1.477-.013-.006-1.381-.53-1.396-2.11zM10.154 4.195c.358-.435.6-.1.737-.899.137-.799-.059-1.583-.059-1.583s-.664.027-1.282.748c-.411.481-.722 1.139-.623 1.831.099.692.651.83.651.83l.576-.927z" />
                    </svg>
                </div>
            </div>

            {/*
              * The project menu. It used to live inside the transport LCD; that
              * display now shows only position, tempo, signature and key. This
              * is still the only path to Save a Copy As, Save as Template,
              * Export as WAV, Import Project Settings, Project Information,
              * Revert and the alternatives list.
              */}
            <ProjectManager compact />

            {/*
                The menus used to be a row of names across here — File, Edit,
                Track … Help — collapsed to zero width until the "Magic Pro"
                title was clicked. On load the bar looked empty, and the only
                way in was pressing a word that did not read as a control.
                They are one dropdown off the M button in the transport bar
                now; this bar keeps what belongs to the window itself.
            */}
            <div className="flex-1" />

            <div className="flex items-center h-full gap-3 px-4 overflow-hidden">
                {/* WiFi icon */}
                <div className="relative w-3.5 h-3.5" title={isOnline ? 'Connected' : 'Offline'}>
                    <svg viewBox="0 0 24 24" className={`w-full h-full ${isOnline ? 'fill-studio-text' : 'fill-studio-text-dim'}`}>
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
                            <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full p-[2px] fill-studio-text">
                                <path d="M13 4h-2l-4 10h3l-2 6h2l4-10h-3z" />
                            </svg>
                        )}
                        <div className="absolute -right-[2px] top-1/2 -translate-y-1/2 w-[1.5px] h-2 bg-black/40 rounded-r-sm" />
                    </div>
                </div>

                {/* Live clock */}
                <div className="text-[11px] font-semibold text-studio-text-dim whitespace-nowrap tabular-nums">
                    {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                    {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </div>
            </div>
        </div>
    )
}
