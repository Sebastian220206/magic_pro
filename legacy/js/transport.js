/* ═══════════════════════════════════════════════════════════
   Transport Bar Controller
   ═══════════════════════════════════════════════════════════ */

const TransportController = (() => {
    let els = {};

    function init() {
        els = {
            play: document.getElementById('btn-play'),
            stop: document.getElementById('btn-stop'),
            record: document.getElementById('btn-record'),
            loop: document.getElementById('btn-loop'),
            rewind: document.getElementById('btn-rewind'),
            metronome: document.getElementById('btn-metronome'),
            bpmInput: document.getElementById('bpm-input'),
            timesig: document.getElementById('timesig-select'),
            snap: document.getElementById('snap-select'),
            posBar: document.querySelector('.pos-bar'),
            posBeat: document.querySelector('.pos-beat'),
            posTick: document.querySelector('.pos-tick'),
            cpuBar: document.getElementById('cpu-bar'),
            cpuValue: document.getElementById('cpu-value'),
        };

        bindEvents();
        DAWStore.subscribe(onStateChange);
        startCpuSimulation();
    }

    function bindEvents() {
        els.play.addEventListener('click', () => DAWStore.togglePlay());
        els.stop.addEventListener('click', () => DAWStore.stop());
        els.record.addEventListener('click', () => DAWStore.toggleRecord());
        els.loop.addEventListener('click', () => DAWStore.toggleLoop());
        els.rewind.addEventListener('click', () => DAWStore.rewind());
        els.metronome.addEventListener('click', () => DAWStore.toggleMetronome());

        els.bpmInput.addEventListener('change', (e) => {
            const val = Math.min(300, Math.max(20, parseInt(e.target.value) || 120));
            e.target.value = val;
            DAWStore.set('bpm', val);
        });

        els.bpmInput.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1 : -1;
            const newVal = Math.min(300, Math.max(20, DAWStore.state.bpm + delta));
            DAWStore.set('bpm', newVal);
            els.bpmInput.value = newVal;
        });

        els.timesig.addEventListener('change', (e) => {
            DAWStore.set('timeSignature', e.target.value);
        });

        els.snap.addEventListener('change', (e) => {
            DAWStore.set('snapValue', parseFloat(e.target.value));
        });
    }

    function onStateChange(state, changed) {
        // Play button
        els.play.classList.toggle('active', state.isPlaying);

        // Record button
        els.record.classList.toggle('active', state.isRecording);

        // Loop button
        els.loop.classList.toggle('active', state.loopEnabled);

        // Metronome button
        els.metronome.classList.toggle('active', state.metronomeEnabled);

        // Position display
        if (changed === 'currentBeat' || changed === 'isPlaying') {
            updatePositionDisplay(state.currentBeat, state.timeSignature);
        }
    }

    function updatePositionDisplay(beat, timeSig) {
        const [beatsPerBar] = timeSig.split('/').map(Number);
        const bar = Math.floor(beat / beatsPerBar) + 1;
        const beatInBar = Math.floor(beat % beatsPerBar) + 1;
        const tick = Math.floor((beat % 1) * 960);

        els.posBar.textContent = String(bar).padStart(3, '0');
        els.posBeat.textContent = String(beatInBar);
        els.posTick.textContent = String(tick).padStart(3, '0');
    }

    function startCpuSimulation() {
        setInterval(() => {
            const cpu = 8 + Math.random() * 18 + (DAWStore.state.isPlaying ? 15 : 0);
            const pct = Math.min(100, Math.round(cpu));
            els.cpuBar.style.width = pct + '%';
            els.cpuValue.textContent = pct + '%';

            els.cpuBar.classList.remove('medium', 'high');
            if (pct > 60) els.cpuBar.classList.add('high');
            else if (pct > 35) els.cpuBar.classList.add('medium');
        }, 800);
    }

    return { init };
})();
