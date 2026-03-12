/* ═══════════════════════════════════════════════════════════
   App Init — Logic Pro X Style
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    console.log('%c🎵 SoundForge Studio', 'color:#5B7FFF;font-size:18px;font-weight:bold');
    console.log('%cLogic Pro X Layout', 'color:#8BC34A;font-size:11px');

    DAWStore.initDemoData();
    TransportController.init();
    TimelineController.init();
    PianoRollController.init();
    MixerController.init();
    initToolbar();
    initEditorTabs();
    initResizeHandle();
    initInspector();
    initKeyboardShortcuts();

    console.log('%c✅ SoundForge Studio initialized', 'color:#5FE062;font-size:11px');
});

/* ── Toolbar ── */
function initToolbar() {
    const btnMixer = document.getElementById('btn-show-mixer');
    const btnEditor = document.getElementById('btn-show-editor');
    const mixerOverlay = document.getElementById('mixer-overlay');
    const editorPanel = document.getElementById('editor-panel');
    const mixerClose = document.getElementById('mixer-close');

    btnMixer.addEventListener('click', () => {
        mixerOverlay.classList.toggle('hidden');
        btnMixer.classList.toggle('active');
    });
    if (mixerClose) mixerClose.addEventListener('click', () => {
        mixerOverlay.classList.add('hidden');
        btnMixer.classList.remove('active');
    });

    btnEditor.addEventListener('click', () => {
        editorPanel.classList.toggle('editor-collapsed');
        editorPanel.classList.toggle('editor-open');
        btnEditor.classList.toggle('active');
        setTimeout(() => window.dispatchEvent(new Event('resize')), 220);
    });
}

/* ── Editor Tabs ── */
function initEditorTabs() {
    const tabs = document.querySelectorAll('.ed-tab');
    const panels = document.querySelectorAll('.ed-panel');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById(tab.dataset.panel + '-panel');
            if (panel) panel.classList.add('active');
        });
    });
}

/* ── Resize Handle ── */
function initResizeHandle() {
    const handle = document.getElementById('h-resize');
    const arrangement = document.getElementById('arrangement-area');
    const editor = document.getElementById('editor-panel');
    let resizing = false;

    handle.addEventListener('mousedown', e => {
        resizing = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        const startY = e.clientY;
        const startAH = arrangement.offsetHeight;
        const startEH = editor.offsetHeight;

        const onMove = e => {
            if (!resizing) return;
            const delta = e.clientY - startY;
            arrangement.style.flex = 'none';
            arrangement.style.height = Math.max(140, startAH + delta) + 'px';
            editor.style.height = Math.max(150, startEH - delta) + 'px';
        };
        const onUp = () => {
            resizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            window.dispatchEvent(new Event('resize'));
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

/* ── Inspector ── */
function initInspector() {
    DAWStore.subscribe((state, changed) => {
        if (changed === 'selectedTrackId' || changed === 'tracks') {
            updateInspector(state);
        }
    });
    updateInspector(DAWStore.state);

    document.getElementById('insp-mute').addEventListener('click', () => {
        const tid = DAWStore.state.selectedTrackId;
        if (tid) DAWStore.toggleTrackMute(tid);
    });
    document.getElementById('insp-solo').addEventListener('click', () => {
        const tid = DAWStore.state.selectedTrackId;
        if (tid) DAWStore.toggleTrackSolo(tid);
    });
}

function updateInspector(state) {
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    const nameEl = document.getElementById('insp-track-name');
    const volEl = document.getElementById('insp-vol');
    const panEl = document.getElementById('insp-pan');
    const muteBtn = document.getElementById('insp-mute');
    const soloBtn = document.getElementById('insp-solo');

    if (track) {
        nameEl.textContent = 'Track: ' + track.name;
        volEl.textContent = (20 * Math.log10(track.volume || 0.001)).toFixed(1);
        panEl.textContent = track.pan.toFixed(1);
        muteBtn.classList.toggle('m-on', track.muted);
        soloBtn.classList.toggle('s-on', track.solo);
    } else {
        nameEl.textContent = 'Track: —';
        volEl.textContent = '0.0';
        panEl.textContent = '0.0';
        muteBtn.classList.remove('m-on');
        soloBtn.classList.remove('s-on');
    }
}

/* ── Keyboard Shortcuts ── */
function initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        switch (e.code) {
            case 'Space': e.preventDefault(); DAWStore.togglePlay(); break;
            case 'Enter': DAWStore.stop(); break;
            case 'KeyR': if (!e.ctrlKey && !e.metaKey) DAWStore.toggleRecord(); break;
            case 'KeyL': DAWStore.toggleLoop(); break;
            case 'KeyM': DAWStore.toggleMetronome(); break;
            case 'Home': DAWStore.rewind(); break;
        }
    });
}
