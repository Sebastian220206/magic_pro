/* ═══════════════════════════════════════════════════════════
   Mixer Panel — Right-side vertical mixer (horizontal strips)
   ═══════════════════════════════════════════════════════════ */

const MixerController = (() => {
  let mixerScroll;
  let vuData = {};
  let vuFrame;

  function init() {
    mixerScroll = document.getElementById('mixer-scroll');
    render();
    DAWStore.subscribe(onStateChange);
    startVU();
  }

  function render() {
    mixerScroll.innerHTML = '';
    DAWStore.state.tracks.forEach(t => mixerScroll.appendChild(createStrip(t)));
    mixerScroll.appendChild(createMaster());
  }

  function createStrip(track) {
    const el = document.createElement('div');
    el.className = 'ch-strip';
    el.dataset.trackId = track.id;
    vuData[track.id] = { l: 0, r: 0, pL: 0, pR: 0, pd: 0 };

    const insHTML = track.inserts.slice(0, 3).map((fx, i) =>
      `<span class="ch-ins ${fx ? 'active' : ''}">${fx || '—'}</span>`
    ).join('');

    el.innerHTML = `
      <div class="ch-color" style="background:${track.color};box-shadow:0 0 4px ${hexA(track.color, 0.3)}"></div>
      <div class="ch-name">${track.name}</div>
      <div class="ch-inserts">${insHTML}</div>
      <div class="ch-knob" data-param="pan" data-track="${track.id}"><canvas width="44" height="44"></canvas></div>
      <div class="ch-fader" data-track="${track.id}">
        <div class="ch-fader-track">
          <div class="ch-fader-fill" style="height:${track.volume * 100}%;background:${track.color}"></div>
          <div class="ch-fader-thumb" style="bottom:${track.volume * 100}%"></div>
        </div>
      </div>
      <span class="ch-db">${volDb(track.volume)}</span>
      <div class="ch-vu" data-track="${track.id}">
        <div class="ch-vu-ch"><div class="ch-vu-fill" data-ch="l"></div><div class="ch-vu-peak" data-ch="pl"></div></div>
        <div class="ch-vu-ch"><div class="ch-vu-fill" data-ch="r"></div><div class="ch-vu-peak" data-ch="pr"></div></div>
      </div>
      <div class="ch-btns">
        <button class="ch-btn ${track.muted ? 'm-active' : ''}" data-a="m" data-t="${track.id}">M</button>
        <button class="ch-btn ${track.solo ? 's-active' : ''}" data-a="s" data-t="${track.id}">S</button>
      </div>
    `;

    el.querySelectorAll('.ch-btn').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.a === 'm') DAWStore.toggleTrackMute(b.dataset.t);
      else DAWStore.toggleTrackSolo(b.dataset.t);
    }));

    setupFader(el.querySelector('.ch-fader-track'), track);

    setTimeout(() => {
      renderKnob(el.querySelector('[data-param="pan"]'), track.pan, -1, 1, track.color);
    }, 0);

    return el;
  }

  function createMaster() {
    const el = document.createElement('div');
    el.className = 'ch-strip master';
    vuData['master'] = { l: 0, r: 0, pL: 0, pR: 0, pd: 0 };

    el.innerHTML = `
      <div class="ch-color" style="background:linear-gradient(180deg,#7C3AED,#00E5FF)"></div>
      <div class="ch-name" style="color:#B266FF">MASTER</div>
      <span class="ch-ins active">Limiter</span>
      <div class="ch-knob" data-param="m-width"><canvas width="44" height="44"></canvas></div>
      <div class="ch-fader" data-track="master">
        <div class="ch-fader-track">
          <div class="ch-fader-fill" style="height:80%;background:linear-gradient(0deg,#7C3AED,#00E5FF)"></div>
          <div class="ch-fader-thumb" style="bottom:80%"></div>
        </div>
      </div>
      <span class="ch-db">0.0</span>
      <div class="ch-vu" data-track="master">
        <div class="ch-vu-ch"><div class="ch-vu-fill" data-ch="l"></div><div class="ch-vu-peak" data-ch="pl"></div></div>
        <div class="ch-vu-ch"><div class="ch-vu-fill" data-ch="r"></div><div class="ch-vu-peak" data-ch="pr"></div></div>
      </div>
    `;

    setTimeout(() => {
      renderKnob(el.querySelector('[data-param="m-width"]'), 1, 0, 1, '#7C3AED');
    }, 0);

    return el;
  }

  function setupFader(trackEl, track) {
    let dragging = false;
    const onMove = e => {
      if (!dragging) return;
      const r = trackEl.getBoundingClientRect();
      const vol = Math.max(0, Math.min(1, 1 - ((e.clientY - r.top) / r.height)));
      DAWStore.setTrackVolume(track.id, vol);
      trackEl.querySelector('.ch-fader-fill').style.height = (vol * 100) + '%';
      trackEl.querySelector('.ch-fader-thumb').style.bottom = (vol * 100) + '%';
      trackEl.closest('.ch-strip').querySelector('.ch-db').textContent = volDb(vol);
    };
    trackEl.addEventListener('mousedown', e => {
      dragging = true; onMove(e);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', () => { dragging = false; document.removeEventListener('mousemove', onMove); }, { once: true });
    });
  }

  function renderKnob(knobEl, val, min, max, color) {
    if (!knobEl) return;
    const c = knobEl.querySelector('canvas');
    const ctx = c.getContext('2d');
    const s = c.width, cn = s / 2, r = s / 2 - 6;
    const norm = (val - min) / (max - min);
    const sA = 0.75 * Math.PI, eA = 2.25 * Math.PI;
    const a = sA + norm * (eA - sA);
    ctx.clearRect(0, 0, s, s);
    ctx.beginPath(); ctx.arc(cn, cn, r, sA, eA); ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cn, cn, r, sA, a); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.shadowColor = color; ctx.shadowBlur = 5; ctx.stroke(); ctx.shadowBlur = 0;
    const px = cn + Math.cos(a) * (r - 3), py = cn + Math.sin(a) * (r - 3);
    ctx.beginPath(); ctx.moveTo(cn, cn); ctx.lineTo(px, py); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  }

  function startVU() {
    function tick() {
      const playing = DAWStore.state.isPlaying;
      DAWStore.state.tracks.forEach(t => {
        const v = vuData[t.id]; if (!v) return;
        if (playing && !t.muted) {
          const b = t.volume * 0.7;
          v.l = Math.min(1, b + Math.random() * 0.3);
          v.r = Math.min(1, b + Math.random() * 0.3);
          if (v.l > v.pL) { v.pL = v.l; v.pd = 30; }
          if (v.r > v.pR) v.pR = v.r;
        } else { v.l *= 0.85; v.r *= 0.85; }
        if (v.pd > 0) v.pd--; else { v.pL *= 0.95; v.pR *= 0.95; }
        setVU(t.id, v);
      });
      const mv = vuData['master'];
      if (mv) {
        if (playing) {
          const avg = DAWStore.state.tracks.reduce((s, t) => s + (t.muted ? 0 : t.volume * 0.3), 0);
          mv.l = Math.min(1, avg + Math.random() * 0.15); mv.r = Math.min(1, avg + Math.random() * 0.15);
          if (mv.l > mv.pL) { mv.pL = mv.l; mv.pd = 30; } if (mv.r > mv.pR) mv.pR = mv.r;
        } else { mv.l *= 0.85; mv.r *= 0.85; }
        if (mv.pd > 0) mv.pd--; else { mv.pL *= 0.95; mv.pR *= 0.95; }
        setVU('master', mv);
      }
      vuFrame = requestAnimationFrame(tick);
    }
    vuFrame = requestAnimationFrame(tick);
  }

  function setVU(id, v) {
    const m = document.querySelector(`.ch-vu[data-track="${id}"]`);
    if (!m) return;
    const fL = m.querySelector('[data-ch="l"]'), fR = m.querySelector('[data-ch="r"]');
    const pL = m.querySelector('[data-ch="pl"]'), pR = m.querySelector('[data-ch="pr"]');
    if (fL) fL.style.height = (v.l * 100) + '%';
    if (fR) fR.style.height = (v.r * 100) + '%';
    if (pL) pL.style.bottom = (v.pL * 100) + '%';
    if (pR) pR.style.bottom = (v.pR * 100) + '%';
  }

  function volDb(v) { return v <= 0 ? '-∞' : (20 * Math.log10(v)).toFixed(1); }
  function hexA(h, a) { return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`; }

  function onStateChange(state, changed) {
    if (changed === 'tracks') {
      document.querySelectorAll('.ch-strip').forEach(s => {
        const tid = s.dataset.trackId; if (!tid) return;
        const t = state.tracks.find(tr => tr.id === tid); if (!t) return;
        const mb = s.querySelector('[data-a="m"]'), sb = s.querySelector('[data-a="s"]');
        if (mb) mb.classList.toggle('m-active', t.muted);
        if (sb) sb.classList.toggle('s-active', t.solo);
      });
    }
  }

  return { init };
})();
