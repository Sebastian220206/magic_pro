/* ═══════════════════════════════════════════════════════════
   Arrangement Timeline — Premium Canvas Renderer
   ═══════════════════════════════════════════════════════════ */

const TimelineController = (() => {
    let rulerCanvas, rulerCtx;
    let mainCanvas, mainCtx;
    let scrollContainer;
    let trackHeadersContainer;
    let playheadEl, loopRegionEl;
    let totalBeats = 128;
    let dpr = 1;

    function init() {
        rulerCanvas = document.getElementById('timeline-ruler');
        mainCanvas = document.getElementById('timeline-canvas');
        scrollContainer = document.getElementById('timeline-scroll');
        trackHeadersContainer = document.getElementById('track-headers');
        playheadEl = document.getElementById('playhead');
        loopRegionEl = document.getElementById('loop-region');

        dpr = window.devicePixelRatio || 1;

        renderTrackHeaders();
        resizeCanvases();
        drawRuler();
        drawTimeline();
        updatePlayhead();
        updateLoopRegion();

        window.addEventListener('resize', () => {
            resizeCanvases(); drawRuler(); drawTimeline();
        });

        scrollContainer.addEventListener('wheel', onWheel, { passive: false });
        rulerCanvas.addEventListener('click', onRulerClick);
        scrollContainer.addEventListener('scroll', () => {
            trackHeadersContainer.scrollTop = scrollContainer.scrollTop;
            drawRuler();
        });

        DAWStore.subscribe(onStateChange);
        startPlaybackLoop();
    }

    function resizeCanvases() {
        const zoom = DAWStore.state.zoom;
        const trackCount = DAWStore.state.tracks.length;
        const trackHeight = 56;
        const timelineWidth = totalBeats * zoom;
        const timelineHeight = trackCount * trackHeight;
        const containerWidth = scrollContainer.clientWidth;

        rulerCanvas.width = containerWidth * dpr;
        rulerCanvas.height = 26 * dpr;
        rulerCanvas.style.width = containerWidth + 'px';
        rulerCanvas.style.height = '26px';
        rulerCtx = rulerCanvas.getContext('2d');
        rulerCtx.scale(dpr, dpr);

        const canvasW = Math.max(timelineWidth, containerWidth);
        const canvasH = Math.max(timelineHeight, scrollContainer.clientHeight);
        mainCanvas.width = canvasW * dpr;
        mainCanvas.height = canvasH * dpr;
        mainCanvas.style.width = canvasW + 'px';
        mainCanvas.style.height = canvasH + 'px';
        mainCtx = mainCanvas.getContext('2d');
        mainCtx.scale(dpr, dpr);
    }

    /* ── Ruler — subtle graphite ── */
    function drawRuler() {
        const ctx = rulerCtx;
        const width = rulerCanvas.width / dpr;
        const height = 26;
        const zoom = DAWStore.state.zoom;
        const scrollX = scrollContainer.scrollLeft;
        const [beatsPerBar] = DAWStore.state.timeSignature.split('/').map(Number);

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, width, height);

        const startBeat = Math.floor(scrollX / zoom);
        const endBeat = Math.ceil((scrollX + width) / zoom) + 1;

        for (let beat = startBeat; beat <= endBeat && beat <= totalBeats; beat++) {
            const x = beat * zoom - scrollX;
            if (beat % beatsPerBar === 0) {
                ctx.strokeStyle = 'rgba(255,255,255,0.08)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();

                const barNum = Math.floor(beat / beatsPerBar) + 1;
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.font = '500 9px Inter, sans-serif';
                ctx.fillText(barNum, x + 4, 11);
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.03)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(x, 18); ctx.lineTo(x, height); ctx.stroke();
            }
        }
    }

    /* ── Main timeline — graphite + neon clips ── */
    function drawTimeline() {
        const ctx = mainCtx;
        const width = mainCanvas.width / dpr;
        const height = mainCanvas.height / dpr;
        const zoom = DAWStore.state.zoom;
        const tracks = DAWStore.state.tracks;
        const trackHeight = 56;
        const [beatsPerBar] = DAWStore.state.timeSignature.split('/').map(Number);

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#2C2C2C';
        ctx.fillRect(0, 0, width, height);

        /* Subtle grid */
        for (let beat = 0; beat <= totalBeats; beat++) {
            const x = beat * zoom;
            if (beat % beatsPerBar === 0) {
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.018)';
                ctx.lineWidth = 0.5;
            }
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }

        /* Track lanes */
        tracks.forEach((track, i) => {
            const y = i * trackHeight;

            /* Selected track subtle highlight */
            if (DAWStore.state.selectedTrackId === track.id) {
                ctx.fillStyle = 'rgba(91,127,255,0.04)';
                ctx.fillRect(0, y, width, trackHeight);
            }

            /* Lane separator — very subtle */
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, y + trackHeight); ctx.lineTo(width, y + trackHeight); ctx.stroke();

            /* Clips */
            track.clips.forEach(clip => drawClip(ctx, clip, track, y, trackHeight, zoom));
        });
    }

    /* ── Premium clip rendering with neon glow ── */
    function drawClip(ctx, clip, track, trackY, trackHeight, zoom) {
        const x = clip.startBeat * zoom;
        const w = clip.durationBeats * zoom;
        const y = trackY + 2;
        const h = trackHeight - 4;
        const radius = 2;
        const color = clip.color || track.color;
        const isMuted = track.muted;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.clip();

        /* Solid saturated fill — Logic Pro style */
        ctx.fillStyle = hexToRgba(color, isMuted ? 0.15 : 0.55);
        ctx.fillRect(x, y, w, h);

        /* Slightly darker bottom half */
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, 'rgba(255,255,255,0.06)');
        grad.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, h);

        /* Top bright edge */
        ctx.fillStyle = hexToRgba(color, isMuted ? 0.2 : 0.75);
        ctx.fillRect(x, y, w, 1);

        /* Waveform or MIDI preview */
        if (clip.type === 'audio' && clip.waveform) {
            WaveformUtil.drawWaveform(ctx, clip.waveform, x + 2, y + 14, w - 4, h - 16, '#fff', isMuted ? 0.15 : 0.35);
        } else if (clip.type === 'midi' && clip.notes) {
            WaveformUtil.drawMidiPreview(ctx, clip.notes, clip.startBeat, clip.durationBeats, x + 2, y + 14, w - 4, h - 16, '#fff');
        }

        ctx.restore();

        /* Border */
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.strokeStyle = hexToRgba(color, isMuted ? 0.10 : 0.35);
        ctx.lineWidth = 0.5;
        ctx.stroke();

        /* Clip name — white on colored background */
        if (w > 30) {
            ctx.fillStyle = isMuted ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.85)';
            ctx.font = '600 8px Inter, sans-serif';
            ctx.fillText(clip.name, x + 4, y + 10, w - 8);
        }
    }

    /* ── Track headers — Logic Pro X Style ── */
    function getTrackIcon(track) {
        if (track.type === 'midi') {
            // Piano / keys icon
            return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="4" width="20" height="16" rx="1.5" fill="currentColor" opacity="0.9"/>
              <rect x="2" y="4" width="20" height="10" rx="1.5" fill="currentColor" opacity="0.15"/>
              <rect x="5.5" y="4" width="2.5" height="9" rx="1" fill="black" opacity="0.85"/>
              <rect x="10" y="4" width="2.5" height="9" rx="1" fill="black" opacity="0.85"/>
              <rect x="15.5" y="4" width="2.5" height="9" rx="1" fill="black" opacity="0.85"/>
            </svg>`;
        }
        // Waveform icon for audio
        return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 12h1.5M6 7v10M9.5 4v16M13 8v8M16.5 5v14M20 9v6M22.5 12H24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>`;
    }

    function renderTrackHeaders() {
        const container = trackHeadersContainer;
        // Preserve the ruler row
        const ruler = container.querySelector('.th-ruler');
        container.innerHTML = '';
        if (ruler) container.appendChild(ruler);

        DAWStore.state.tracks.forEach((track, idx) => {
            const header = document.createElement('div');
            header.className = `track-header ${DAWStore.state.selectedTrackId === track.id ? 'selected' : ''}`;
            header.dataset.trackId = track.id;
            const trackNum = idx + 1;
            const volPct = Math.round(track.volume * 100);
            // Pan degrees: -135deg (full left) to +135deg (full right), 0 = center
            const panDeg = track.pan * 135;

            header.innerHTML = `
              <div class="trk-avatar" style="background: linear-gradient(145deg, ${track.color}40, ${track.color}18); border-color: ${track.color}55;" title="${track.name}">
                <div class="trk-avatar-icon" style="color:${track.color};">
                  ${getTrackIcon(track)}
                </div>
                <div class="trk-avatar-badge" style="background:${track.color};">${trackNum}</div>
              </div>

              <div class="trk-info">
                <div class="trk-name-row">
                  <span class="track-name">${track.name}</span>
                  <span class="trk-type-badge">${track.type === 'midi' ? 'M' : 'A'}</span>
                </div>
                <div class="track-ctrls">
                  <button class="tc-ibtn${track.muted ? ' mute-on' : ''}" data-action="mute" data-track="${track.id}" title="Mute">
                    <svg viewBox="0 0 16 16"><path d="M2 5h3l4-3v12l-4-3H2V5z"/><path d="M11 5.5c.8.6 1.3 1.5 1.3 2.5s-.5 1.9-1.3 2.5" stroke-width="1.2" stroke-linecap="round"/></svg>
                  </button>
                  <button class="tc-ibtn${track.solo ? ' solo-on' : ''}" data-action="solo" data-track="${track.id}" title="Solo">
                    <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill="currentColor" opacity="0.4"/><circle cx="8" cy="8" r="2"/></svg>
                  </button>
                  <button class="tc-ibtn" data-action="monitor" data-track="${track.id}" title="Monitor">
                    <svg viewBox="0 0 16 16"><path d="M3 7a5 5 0 1 0 10 0A5 5 0 0 0 3 7z" stroke-width="1.2"/><path d="M2 13c.5-1.5 2-2.5 6-2.5s5.5 1 6 2.5" stroke-width="1.2" stroke-linecap="round"/></svg>
                  </button>
                  <button class="tc-ibtn${track.recArmed ? ' rec-on' : ''}" data-action="rec" data-track="${track.id}" title="Arm Recording">
                    <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill="currentColor"/></svg>
                  </button>
                </div>

                <div class="trk-vol-row">
                  <div class="tv-box">
                    <div class="tv-track">
                      <div class="tv-fill" style="width:${volPct}%"></div>
                      <input type="range" class="tv-slider" min="0" max="1" step="0.01" value="${track.volume}" data-track="${track.id}" aria-label="Volume">
                    </div>
                    <canvas class="pan-knob" width="22" height="22" data-track="${track.id}" data-pan="${track.pan}" title="Pan: ${track.pan >= 0 ? 'R' : 'L'}${Math.round(Math.abs(track.pan * 100))}"></canvas>
                  </div>
                </div>
              </div>
            `;

            // Select track on click
            header.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('input') || e.target.closest('canvas')) return;
                DAWStore.selectTrack(track.id);
            });

            // Icon button actions
            header.querySelectorAll('.tc-ibtn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const tid = btn.dataset.track;
                    if (action === 'mute') DAWStore.toggleTrackMute(tid);
                    else if (action === 'solo') DAWStore.toggleTrackSolo(tid);
                    else if (action === 'rec') DAWStore.toggleTrackRec(tid);
                });
            });

            // Volume slider with live fill
            const slider = header.querySelector('.tv-slider');
            const fill = header.querySelector('.tv-fill');
            slider.addEventListener('input', (e) => {
                e.stopPropagation();
                const vol = parseFloat(e.target.value);
                fill.style.width = Math.round(vol * 100) + '%';
                DAWStore.setTrackVolume(track.id, vol);
            });

            container.appendChild(header);
        });

        // Draw all pan knobs
        container.querySelectorAll('.pan-knob').forEach(canvas => {
            drawPanKnob(canvas, parseFloat(canvas.dataset.pan || '0'));
            initPanDrag(canvas);
        });
    }

    /* ── Pan knob canvas drawing ── */
    function drawPanKnob(canvas, pan) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        const r = w / 2 - 2;

        ctx.clearRect(0, 0, w, h);

        // Outer ring
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#2A2A2A';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Track arc (dark)
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2, Math.PI * 0.75, Math.PI * 2.25);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Value arc (colored)
        const startAngle = Math.PI * 1.5; // 12 o'clock
        const endAngle = startAngle + pan * (Math.PI * 0.75);
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
        ctx.strokeStyle = pan === 0 ? 'rgba(255,255,255,0.2)' : (pan > 0 ? '#5FE062' : '#5B9FFF');
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Inner highlight
        const grad = ctx.createRadialGradient(cx - 1, cy - 1.5, 0, cx, cy, r - 3);
        grad.addColorStop(0, 'rgba(120,120,120,0.6)');
        grad.addColorStop(1, 'rgba(30,30,30,0.8)');
        ctx.beginPath();
        ctx.arc(cx, cy, r - 3.5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Indicator dot
        const angle = startAngle + pan * (Math.PI * 0.75);
        const dotR = r - 6;
        const dotX = cx + dotR * Math.cos(angle);
        const dotY = cy + dotR * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
    }

    /* ── Pan drag interaction ── */
    function initPanDrag(canvas) {
        let startY, startPan;
        canvas.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startY = e.clientY;
            startPan = parseFloat(canvas.dataset.pan || '0');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';

            const onMove = (e) => {
                const delta = (startY - e.clientY) / 80;
                const newPan = Math.max(-1, Math.min(1, startPan + delta));
                canvas.dataset.pan = newPan;
                drawPanKnob(canvas, newPan);
                DAWStore.setTrackPan(canvas.dataset.track, newPan);
            };
            const onUp = () => {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // Double-click to reset
        canvas.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            canvas.dataset.pan = '0';
            drawPanKnob(canvas, 0);
            DAWStore.setTrackPan(canvas.dataset.track, 0);
        });
    }

    function updatePlayhead() {
        const zoom = DAWStore.state.zoom;
        playheadEl.style.left = (DAWStore.state.currentBeat * zoom) + 'px';
    }

    function updateLoopRegion() {
        const zoom = DAWStore.state.zoom;
        const { loopStart, loopEnd, loopEnabled } = DAWStore.state;
        if (loopEnabled) {
            loopRegionEl.classList.add('visible');
            loopRegionEl.style.left = (loopStart * zoom) + 'px';
            loopRegionEl.style.width = ((loopEnd - loopStart) * zoom) + 'px';
        } else {
            loopRegionEl.classList.remove('visible');
        }
    }

    function onWheel(e) {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 5 : -5;
            const newZoom = Math.max(10, Math.min(120, DAWStore.state.zoom + delta));
            DAWStore.set('zoom', newZoom);
            resizeCanvases(); drawRuler(); drawTimeline(); updatePlayhead(); updateLoopRegion();
        }
    }

    function onRulerClick(e) {
        const rect = rulerCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollContainer.scrollLeft;
        DAWStore.set('currentBeat', Math.max(0, x / DAWStore.state.zoom));
        updatePlayhead();
    }

    function onStateChange(state, changed) {
        if (changed === 'tracks' || changed === 'selectedTrackId') {
            renderTrackHeaders(); drawTimeline();
        }
        if (changed === 'currentBeat') updatePlayhead();
        if (changed === 'loopEnabled') updateLoopRegion();
        if (changed === 'zoom') {
            resizeCanvases(); drawRuler(); drawTimeline(); updatePlayhead(); updateLoopRegion();
        }
    }

    /* ── Smooth playback loop ── */
    function startPlaybackLoop() {
        let lastTs = 0;
        function tick(ts) {
            if (DAWStore.state.isPlaying) {
                if (lastTs === 0) lastTs = ts;
                const elapsed = (ts - lastTs) / 1000;
                lastTs = ts;

                const beatsPerSecond = DAWStore.state.bpm / 60;
                let newBeat = DAWStore.state.currentBeat + elapsed * beatsPerSecond;

                if (DAWStore.state.loopEnabled && newBeat >= DAWStore.state.loopEnd) {
                    newBeat = DAWStore.state.loopStart;
                }
                if (newBeat >= totalBeats) newBeat = 0;

                DAWStore.state.currentBeat = newBeat;
                updatePlayhead();
                DAWStore.set('currentBeat', newBeat);

                /* Auto-scroll */
                const px = newBeat * DAWStore.state.zoom;
                const vw = scrollContainer.clientWidth;
                if (px > scrollContainer.scrollLeft + vw - 80 || px < scrollContainer.scrollLeft) {
                    scrollContainer.scrollLeft = px - 80;
                    drawRuler();
                }
            } else {
                lastTs = 0;
            }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    return { init };
})();
