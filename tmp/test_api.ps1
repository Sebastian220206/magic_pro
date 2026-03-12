$projectData = @{
    id = "test-clip-save"
    userId = "user-1"
    name = "Clip Save Test"
    tempo = 120
    tracks = @(
        @{
            id = "track-midi"
            name = "MIDI 1"
            type = "midi"
            volume = 0.8
            pan = 0
            muted = $false
            soloed = $false
            color = "#888"
            orderIndex = 0
            clips = @(
                @{
                    id = "clip-123"
                    name = "Midi Region"
                    type = "midi"
                    start = 0
                    duration = 4
                    color = "#55aa55"
                    notes = @(
                        @{ pitch = 60; velocity = 100; start = 0; duration = 1 },
                        @{ pitch = 64; velocity = 90; start = 1; duration = 1 }
                    )
                }
            )
        }
    )
}
$json = $projectData | ConvertTo-Json -Depth 10
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/project/save" -Method Post -Body $json -ContentType "application/json"
    $loaded = Invoke-RestMethod -Uri "http://localhost:3000/api/project/$($response.id)" -Method Get
    Write-Host "Tracks: $($loaded.tracks.Count)"
    Write-Host "Clips on Track 1: $($loaded.tracks[0].clips.Count)"
    Write-Host "Notes on Clip 1: $($loaded.tracks[0].clips[0].notes.Count)"
} catch {
    Write-Error $_.Exception.Message
}
