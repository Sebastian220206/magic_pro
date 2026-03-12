/* ═══════════════════════════════════════════════════════════
   Piano Roll — Premium Canvas Renderer
   ═══════════════════════════════════════════════════════════ */

const PianoRollController = (() => {
    let keysCanvas, keysCtx;
    let gridCanvas, gridCtx;
    let velCanvas, velCtx;
    let gridWrapper;
    let dpr = 1;

    const NOTE_HEIGHT = 12;
    const TOTAL_NOTES = 88;
    const MIN_PITCH = 21;
    const MAX_PITCH = 108;
    const BEATS_VISIBLE = 32;

    function init() {
        keysCanvas = document.getElementById('piano-keys');
        gridCanvas = document.getElementById('piano-roll-canvas');
        velCanvas = document.getElementById('velocity-canvas');
        gridWrapper = document.querySelector('.pr-grid-wrap');

        dpr = window.devicePixelRatio || 1;

        resizeCanvases(); drawKeys(); drawGrid(); drawVelocity();
        bindEvents();
        DAWStore.subscribe(onStateChange);
        window.addEventListener('resize', () => { resizeCanvases(); drawKeys(); drawGrid(); drawVelocity(); });
    }

    function resizeCanvases() {
        const zoom = DAWStore.state.zoom;
        const gridWidth = Math.max(BEATS_VISIBLE * zoom, gridWrapper.clientWidth);
        const gridHeight = TOTAL_NOTES * NOTE_HEIGHT;

        keysCanvas.width = 48 * dpr; keysCanvas.height = gridHeight * dpr;
        keysCanvas.style.width = '48px'; keysCanvas.style.height = gridHeight + 'px';
        keysCtx = keysCanvas.getContext('2d'); keysCtx.scale(dpr, dpr);

        gridCanvas.width = gridWidth * dpr; gridCanvas.height = gridHeight * dpr;
        gridCanvas.style.width = gridWidth + 'px'; gridCanvas.style.height = gridHeight + 'px';
        gridCtx = gridCanvas.getContext('2d'); gridCtx.scale(dpr, dpr);

        const velW = gridWrapper.clientWidth || 600;
        velCanvas.width = velW * dpr; velCanvas.height = 48 * dpr;
        velCanvas.style.width = velW + 'px'; velCanvas.style.height = '48px';
        velCtx = velCanvas.getContext('2d'); velCtx.scale(dpr, dpr);
    }

    /* ── Premium piano keys ── */
    function drawKeys() {
        const ctx = keysCtx;
        const w = 48;
        const scale = DAWStore.SCALES[DAWStore.state.scale] || DAWStore.SCALES.chromatic;
        const root = DAWStore.state.rootNote;

        ctx.clearRect(0, 0, w, TOTAL_NOTES * NOTE_HEIGHT);

        for (let i = 0; i < TOTAL_NOTES; i++) {
            const pitch = MAX_PITCH - i;
            const noteName = pitch % 12;
            const octave = Math.floor(pitch / 12) - 1;
            const y = i * NOTE_HEIGHT;
            const isBlack = [1, 3, 6, 8, 10].includes(noteName);
            const isInScale = scale.includes((noteName - root + 12) % 12);
            const isRoot = noteName === root;

            if (isRoot) {
                ctx.fillStyle = 'rgba(124,58,237,0.18)';
            } else if (isBlack) {
                ctx.fillStyle = '#181818';
            } else {
                ctx.fillStyle = '#222222';
            }
            ctx.fillRect(0, y, w, NOTE_HEIGHT);

            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(0, y + NOTE_HEIGHT); ctx.lineTo(w, y + NOTE_HEIGHT); ctx.stroke();

            if (noteName === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.32)';
                ctx.font = '500 8px Inter, sans-serif';
                ctx.fillText(`C${octave}`, 4, y + NOTE_HEIGHT - 2);
            }

            if (isInScale && !isRoot) {
                ctx.fillStyle = 'rgba(0,229,255,0.35)';
                ctx.beginPath(); ctx.arc(w - 6, y + NOTE_HEIGHT / 2, 1.5, 0, Math.PI * 2); ctx.fill();
            }
            if (isRoot) {
                ctx.fillStyle = '#7C3AED';
                ctx.beginPath(); ctx.arc(w - 6, y + NOTE_HEIGHT / 2, 2, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    /* ── Premium note grid ── */
    function drawGrid() {
        const ctx = gridCtx;
        const zoom = DAWStore.state.zoom;
        const width = gridCanvas.width / dpr;
        const height = TOTAL_NOTES * NOTE_HEIGHT;
        const scale = DAWStore.SCALES[DAWStore.state.scale] || DAWStore.SCALES.chromatic;
        const root = DAWStore.state.rootNote;
        const [beatsPerBar] = DAWStore.state.timeSignature.split('/').map(Number);

        ctx.clearRect(0, 0, width, height);

        /* Row backgrounds */
        for (let i = 0; i < TOTAL_NOTES; i++) {
            const pitch = MAX_PITCH - i;
            const noteName = pitch % 12;
            const y = i * NOTE_HEIGHT;
            const isBlack = [1, 3, 6, 8, 10].includes(noteName);
            const isInScale = scale.includes((noteName - root + 12) % 12);

            if (noteName === root) {
                ctx.fillStyle = 'rgba(124,58,237,0.05)';
            } else if (isInScale) {
                ctx.fillStyle = isBlack ? 'rgba(255,255,255,0.008)' : 'rgba(255,255,255,0.018)';
            } else {
                ctx.fillStyle = isBlack ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.10)';
            }
            ctx.fillRect(0, y, width, NOTE_HEIGHT);

            /* Very subtle row borders */
            ctx.strokeStyle = 'rgba(255,255,255,0.02)';
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(0, y + NOTE_HEIGHT); ctx.lineTo(width, y + NOTE_HEIGHT); ctx.stroke();
        }

        /* Vertical grid — ultra-subtle */
        const quantize = parseFloat(DAWStore.state.quantize) || 0.25;
        for (let beat = 0; beat <= BEATS_VISIBLE; beat += quantize) {
            const x = beat * zoom;
            const isBarLine = Math.abs(beat % beatsPerBar) < 0.01;
            const isBeatLine = Math.abs(beat % 1) < 0.01;

            if (isBarLine) {
                ctx.strokeStyle = 'rgba(255,255,255,0.07)';
                ctx.lineWidth = 1;
            } else if (isBeatLine) {
                ctx.strokeStyle = 'rgba(255,255,255,0.03)';
                ctx.lineWidth = 0.5;
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.015)';
                ctx.lineWidth = 0.5;
            }
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }

        /* Ghost notes */
        const selectedTrackId = DAWStore.state.selectedTrackId;
        DAWStore.state.tracks.forEach(track => {
            if (track.id === selectedTrackId || track.type !== 'midi') return;
            track.clips.forEach(clip => {
                if (!clip.notes) return;
                clip.notes.forEach(note => {
                    const nx = note.startBeat * zoom;
                    const nw = note.duration * zoom;
                    const row = MAX_PITCH - note.pitch;
                    const ny = row * NOTE_HEIGHT;
                    ctx.fillStyle = 'rgba(255,255,255,0.03)';
                    ctx.fillRect(nx + 1, ny + 1, Math.max(2, nw - 2), NOTE_HEIGHT - 2);
                });
            });
        });

        /* Active notes — neon blocks */
        const notes = DAWStore.state.notes;
        notes.forEach(note => {
            const x = note.startBeat * zoom;
            const w = note.duration * zoom;
            const row = MAX_PITCH - note.pitch;
            const y = row * NOTE_HEIGHT;
            const color = note.color || '#B266FF';

            /* Note body with neon glow */
            const noteGrad = ctx.createLinearGradient(x, y, x, y + NOTE_HEIGHT);
            noteGrad.addColorStop(0, hexToRgba(color, 0.75));
            noteGrad.addColorStop(1, hexToRgba(color, 0.45));
            ctx.fillStyle = noteGrad;
            ctx.beginPath();
            ctx.roundRect(x + 0.5, y + 0.5, Math.max(4, w - 1), NOTE_HEIGHT - 1, 1.5);
            ctx.fill();

            /* Top highlight */
            ctx.fillStyle = `rgba(255,255,255,${0.1 + (note.velocity / 127) * 0.2})`;
            ctx.fillRect(x + 1, y + 1, Math.max(2, w - 2), 1);

            /* Subtle neon border */
            ctx.strokeStyle = hexToRgba(color, 0.3);
            ctx.lineWidth = 0.5;
            ctx.stroke();
        });

        /* Playhead — glowing cyan */
        const playX = DAWStore.state.currentBeat * zoom;
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(0,229,255,0.6)';
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(playX, 0); ctx.lineTo(playX, height); ctx.stroke();
        ctx.shadowBlur = 0;
    }

    /* ── Velocity lane ── */
    function drawVelocity() {
        const ctx = velCtx;
        const width = velCanvas.width / dpr;
        const height = 48;
        const zoom = DAWStore.state.zoom;
        const notes = DAWStore.state.notes;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(0, 0, width, height);

        /* Grid lines */
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 3]);
        [0.25, 0.5, 0.75].forEach(frac => {
            ctx.beginPath(); ctx.moveTo(0, height * frac); ctx.lineTo(width, height * frac); ctx.stroke();
        });
        ctx.setLineDash([]);

        /* Velocity bars with neon gradient */
        notes.forEach(note => {
            const x = note.startBeat * zoom;
            const barH = (note.velocity / 127) * (height - 4);
            const barW = Math.max(3, note.duration * zoom - 2);
            const color = note.color || '#B266FF';

            const grad = ctx.createLinearGradient(0, height - barH, 0, height);
            grad.addColorStop(0, hexToRgba(color, 0.85));
            grad.addColorStop(1, hexToRgba(color, 0.25));
            ctx.fillStyle = grad;
            ctx.fillRect(x + 1, height - barH - 2, barW, barH);

            /* Neon top cap */
            ctx.fillStyle = color;
            ctx.fillRect(x + 1, height - barH - 2, barW, 1.5);
        });
    }

    function bindEvents() {
        document.querySelectorAll('.pr-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pr-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                DAWStore.set('selectedTool', btn.dataset.tool);
            });
        });

        document.getElementById('quantize-select').addEventListener('change', (e) => {
            DAWStore.set('quantize', parseFloat(e.target.value) || 0.25);
            resizeCanvases(); drawGrid();
        });
        document.getElementById('scale-select').addEventListener('change', (e) => {
            DAWStore.set('scale', e.target.value); drawKeys(); drawGrid();
        });
        document.getElementById('root-select').addEventListener('change', (e) => {
            DAWStore.set('rootNote', parseInt(e.target.value)); drawKeys(); drawGrid();
        });
        document.getElementById('snap-to-scale').addEventListener('change', (e) => {
            DAWStore.set('snapToScale', e.target.checked);
        });

        gridCanvas.addEventListener('mousedown', onGridClick);

        document.getElementById('btn-chord-gen').addEventListener('click', () => {
            document.getElementById('chord-modal').classList.remove('hidden');
        });
        document.getElementById('chord-modal-close').addEventListener('click', () => {
            document.getElementById('chord-modal').classList.add('hidden');
        });
        document.getElementById('chord-generate').addEventListener('click', () => {
            const root = parseInt(document.getElementById('chord-root').value);
            const type = document.getElementById('chord-type').value;
            const octave = parseInt(document.getElementById('chord-octave').value);
            DAWStore.generateChord(root, type, octave, DAWStore.state.currentBeat);
            document.getElementById('chord-modal').classList.add('hidden');
            drawGrid(); drawVelocity();
        });
        document.getElementById('btn-melody-gen').addEventListener('click', () => {
            DAWStore.generateMelody(12); drawGrid(); drawVelocity();
        });
        document.getElementById('btn-humanize').addEventListener('click', () => {
            DAWStore.humanizeNotes(); drawGrid(); drawVelocity();
        });

        gridWrapper.addEventListener('scroll', () => {
            keysCanvas.style.marginTop = -gridWrapper.scrollTop + 'px';
        });
    }

    function onGridClick(e) {
        const rect = gridCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left + gridWrapper.scrollLeft;
        const y = e.clientY - rect.top + gridWrapper.scrollTop;
        const zoom = DAWStore.state.zoom;
        const tool = DAWStore.state.selectedTool;
        const pitch = MAX_PITCH - Math.floor(y / NOTE_HEIGHT);
        const quantize = parseFloat(DAWStore.state.quantize) || 0.25;
        const beat = Math.floor(x / zoom / quantize) * quantize;

        if (tool === 'draw') {
            if (DAWStore.state.snapToScale) {
                const sc = DAWStore.SCALES[DAWStore.state.scale];
                const noteInOctave = ((pitch % 12) - DAWStore.state.rootNote + 12) % 12;
                if (!sc.includes(noteInOctave)) return;
            }
            const track = DAWStore.state.tracks.find(t => t.id === DAWStore.state.selectedTrackId);
            DAWStore.addNote({
                id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                pitch, startBeat: beat, duration: quantize, velocity: 90,
                color: track ? track.color : '#B266FF'
            });
            drawGrid(); drawVelocity();
        } else if (tool === 'erase') {
            const found = DAWStore.state.notes.find(n => {
                const nx = n.startBeat * zoom;
                const nw = n.duration * zoom;
                const ny = (MAX_PITCH - n.pitch) * NOTE_HEIGHT;
                return x >= nx && x <= nx + nw && y >= ny && y <= ny + NOTE_HEIGHT;
            });
            if (found) { DAWStore.removeNote(found.id); drawGrid(); drawVelocity(); }
        }
    }

    function onStateChange(state, changed) {
        if (changed === 'notes' || changed === 'selectedTrackId') { drawGrid(); drawVelocity(); }
        if (changed === 'currentBeat' && state.isPlaying) drawGrid();
    }

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    return { init };
})();
