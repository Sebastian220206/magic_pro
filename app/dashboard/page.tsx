"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, User, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { ProjectChooser } from "@/components/ProjectChooser";
import { useProjectStore } from "@/store/projectStore";

export default function Dashboard() {
    const sessionData = useSession() || {};
    const session = sessionData.data;
    const status = sessionData.status || "unauthenticated";
    const router = useRouter();
    const [showProjectChooser, setShowProjectChooser] = useState(false);
    const { initializeProject, openProject } = useProjectStore();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    const handleNewProject = () => {
        setShowProjectChooser(true);
    }

    const handleChooseProject = (settings: any) => {
        const isValidTempo = Number.isFinite(settings.tempo) && settings.tempo >= 20 && settings.tempo <= 300;
        const validFormats = ['stereo', 'surround', 'dolby-atmos'];
        const validSpatial = ['Off', 'Dolby Atmos'];

        if (!isValidTempo || !settings.keySignature || !settings.timeSignature || !validFormats.includes(settings.projectFormat) || !validSpatial.includes(settings.spatialAudioMode)) {
            alert('Please complete all required project settings (tempo, key signature, time signature, format, spatial audio).');
            return;
        }

        console.log('Creating project with settings:', settings);
        initializeProject({
            tempo: Number(settings.tempo),
            keySignature: settings.keySignature,
            timeSignature: settings.timeSignature,
            projectFormat: settings.projectFormat,
            surroundFormat: settings.surroundFormat,
            spatialAudioMode: settings.spatialAudioMode
        });

        setShowProjectChooser(false);
        // Redirect to a dynamically generated project ID
        router.push('/project/new-project');
    }

    const handleOpenProject = async (id: string) => {
        console.log("Opening project:", id);
        await openProject(id);
        setShowProjectChooser(false);
        router.push(`/project/${id}`);
    }

    if (status === "loading" || !session) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-daw-bg text-gray-400">
                Loading...
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 max-w-6xl mx-auto overflow-y-auto">
            {showProjectChooser && (
                <ProjectChooser
                    onClose={() => setShowProjectChooser(false)}
                    onChoose={handleChooseProject}
                    onOpenProject={handleOpenProject}
                />
            )}

            <header className="flex justify-between items-center mb-12 py-4 border-b border-daw-border">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-daw-surface flex items-center justify-center">
                        <User className="text-gray-300 w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white leading-tight">{session.user?.name}</h1>
                        <p className="text-xs text-gray-500">{session.user?.email}</p>
                    </div>
                </div>
                <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="text-gray-400 hover:text-white transition flex items-center gap-2 text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </header>

            <div className="flex justify-between items-end mb-8">
                <h2 className="text-2xl font-bold text-white">Recent Projects</h2>
                <button
                    onClick={handleNewProject}
                    className="bg-daw-primary px-5 py-2.5 rounded-lg text-white font-medium hover:bg-blue-600 transition flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" />
                    New Project
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Mock Project */}
                <Link href="/project/demo-1" className="block p-5 rounded-xl bg-daw-panel border border-daw-border hover:border-gray-500 transition cursor-pointer group shadow-sm">
                    <div className="h-40 rounded-lg bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-daw-border mb-4 flex items-center justify-center object-cover group-hover:brightness-110 transition overflow-hidden relative">
                        {/* Abstract preview graphic */}
                        <div className="absolute inset-x-0 bottom-0 h-16 flex items-end gap-1 px-4 opacity-50">
                            {[...Array(12)].map((_, i) => (
                                <div key={i} className="flex-1 bg-daw-primary rounded-t-sm" style={{ height: `${Math.random() * 80 + 20}%` }}></div>
                            ))}
                        </div>
                    </div>
                    <h3 className="text-lg text-white font-semibold group-hover:text-daw-primary transition">Neon Sunset</h3>
                    <p className="text-gray-400 text-xs mt-1">Edited 2 hours ago</p>
                </Link>

                {/* Mock Project 2 */}
                <Link href="/project/demo-2" className="block p-5 rounded-xl bg-daw-panel border border-daw-border hover:border-gray-500 transition cursor-pointer group shadow-sm">
                    <div className="h-40 rounded-lg bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-daw-border mb-4 flex items-center justify-center object-cover group-hover:brightness-110 transition overflow-hidden relative">
                        <div className="absolute inset-x-0 top-1/2 flex items-center px-4 opacity-50 space-x-1">
                            <div className="w-full h-px bg-emerald-500"></div>
                        </div>
                    </div>
                    <h3 className="text-lg text-white font-semibold group-hover:text-daw-primary transition">Acoustic Idea</h3>
                    <p className="text-gray-400 text-xs mt-1">Edited yesterday</p>
                </Link>
            </div>
        </div>
    )
}
