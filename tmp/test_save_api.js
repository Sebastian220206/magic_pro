const fetch = require('node-fetch');

async function testSave() {
    const projectData = {
        id: "test-project-1",
        userId: "user-1",
        name: "Test Project from Script",
        tempo: 125,
        tracks: [
            {
                id: "track-1",
                name: "Drum Track",
                type: "midi",
                volume: 0.9,
                pan: 0,
                muted: false,
                soloed: false,
                color: "#ff0000",
                orderIndex: 0,
                clips: [
                    {
                        id: "clip-1",
                        name: "Main Beat",
                        type: "midi",
                        start: 0,
                        duration: 4,
                        color: "#00ff00",
                        notes: [
                            { pitch: 36, velocity: 100, start: 0, duration: 0.25 },
                            { pitch: 42, velocity: 80, start: 1, duration: 0.25 }
                        ]
                    }
                ]
            }
        ]
    };

    try {
        const response = await fetch("http://localhost:3000/api/project/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(projectData)
        });

        const result = await response.json();
        console.log("Save status:", response.status);
        console.log("Result:", JSON.stringify(result, null, 2));

        if (response.ok) {
            const loadResponse = await fetch(`http://localhost:3000/api/project/${result.id}`);
            const loaded = await loadResponse.json();
            console.log("Loaded status:", loadResponse.status);
            console.log("Loaded counts:", {
                tracks: loaded.tracks.length,
                clips: loaded.tracks[0].clips.length,
                notes: loaded.tracks[0].clips[0].notes.length
            });
        }
    } catch (error) {
        console.error("Test failed:", error);
    }
}

testSave();
