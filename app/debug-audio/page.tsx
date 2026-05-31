"use client"
import React, { useState, useEffect } from 'react'
import { Activity, ShieldCheck, ShieldAlert, RefreshCw, HardDrive, Mic, Speaker, AlertCircle } from 'lucide-react'

export default function AudioDebugPage() {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
    const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking')
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const checkDevices = async () => {
        setIsRefreshing(true)
        setError(null)
        try {
            // Check current permission state if supported
            if (navigator.permissions && (navigator.permissions as any).query) {
                try {
                    const status = await (navigator.permissions as any).query({ name: 'microphone' });
                    setPermissionStatus(status.state);
                } catch (e) {
                    console.log("Permissions API not fully supported for mic");
                }
            }

            // Attempt to trigger permission if needed
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop());
                setPermissionStatus('granted');
            } catch (e: any) {
                console.warn("UserMedia failed:", e);
                if (e.name === 'NotAllowedError') setPermissionStatus('denied');
                else setError(`UserMedia Error: ${e.message}`);
            }

            const allDevices = await navigator.mediaDevices.enumerateDevices();
            setDevices(allDevices);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsRefreshing(false)
        }
    }

    useEffect(() => {
        checkDevices();
        navigator.mediaDevices.addEventListener('devicechange', checkDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', checkDevices);
    }, [])

    const interfaces = devices.filter(d => 
        (d.label.toLowerCase().includes('audio') || 
         d.label.toLowerCase().includes('interface') ||
         d.label.toUpperCase().includes('AI-04')) &&
        d.deviceId !== 'default' && d.deviceId !== 'communications'
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-gray-200 p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Activity className="text-sky-500 w-8 h-8" />
                            Audio Device Diagnostics
                        </h1>
                        <p className="text-gray-500 mt-1">Checking system-level visibility for your Audio Interface</p>
                    </div>
                    <button 
                        onClick={checkDevices}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Re-Scan Hardware
                    </button>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 shadow-xl">
                        <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">
                            <ShieldCheck className="w-4 h-4" />
                            Browser Permission
                        </div>
                        <div className="flex items-center gap-3">
                            {permissionStatus === 'granted' ? (
                                <div className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" /> Granted
                                </div>
                            ) : permissionStatus === 'denied' ? (
                                <div className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                                    <ShieldAlert className="w-3 h-3" /> Denied
                                </div>
                            ) : (
                                <div className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-sm font-bold">
                                    Checking...
                                </div>
                            )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
                            If denied, click the lock icon in your address bar to reset permissions.
                        </p>
                    </div>

                    <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 shadow-xl md:col-span-2">
                        <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">
                            <HardDrive className="w-4 h-4" />
                            Identified Interfaces
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {interfaces.length > 0 ? (
                                interfaces.map((inf, i) => (
                                    <div key={i} className="bg-sky-500 text-white px-4 py-2 rounded-xl text-sm font-black shadow-lg shadow-sky-500/20 animate-in zoom-in-95">
                                        {inf.label}
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center gap-2 text-orange-500 bg-orange-500/10 px-4 py-2 rounded-xl text-sm font-bold">
                                    <AlertCircle className="w-4 h-4" />
                                    No "Interface" type labels found
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-400 text-sm flex items-center gap-3">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {/* Full Device List */}
                <div className="bg-[#111] rounded-3xl overflow-hidden border border-white/5">
                    <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-400">RAW SYSTEM DEVICE LIST ({devices.length})</span>
                    </div>
                    <div className="divide-y divide-white/5">
                        {devices.map((device, i) => (
                            <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center gap-4">
                                    {device.kind === 'audioinput' ? (
                                        <div className="bg-sky-500/10 p-2 rounded-lg"><Mic className="w-4 h-4 text-sky-500" /></div>
                                    ) : (
                                        <div className="bg-purple-500/10 p-2 rounded-lg"><Speaker className="w-4 h-4 text-purple-500" /></div>
                                    )}
                                    <div>
                                        <div className="text-sm font-bold text-white">
                                            {device.label || <span className="text-gray-600 italic">No Label (Permission Required)</span>}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate max-w-xs">{device.deviceId}</div>
                                    </div>
                                </div>
                                <div className="text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded bg-white/5 text-gray-500">
                                    {device.kind.replace('audio', '')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-center p-8 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded-3xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-2">Device Not Showing?</h3>
                    <ul className="text-sm text-gray-500 space-y-2 max-w-md mx-auto">
                        <li>1. Ensure drivers are installed for your **AI-04**.</li>
                        <li>2. Check if the device is enabled in Windows Sound Settings.</li>
                        <li>3. Try a different USB port or cable.</li>
                        <li>4. Some browsers require **HTTPS** to expose device names.</li>
                    </ul>
                </div>

            </div>
        </div>
    )
}
