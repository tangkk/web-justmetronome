const STORAGE_KEY = 'just-metronome-web-v1';
const BPM_MIN = 10;
const BPM_MAX = 360;
const BEATS_MIN = 1;
const BEATS_MAX = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * 92;

const soundOptions = [
  { key: 'just-click', label: 'Just Click', type: 'click' },
  { key: 'hollow-click', label: 'Hollow Click', type: 'click' },
  { key: 'drum-stick', label: 'Drum Stick', type: 'click' },
  { key: 'practice-pad', label: 'Practice Pad', type: 'click' },
  { key: 'met-quartz', label: 'Met Quartz', type: 'click' },
  { key: 'perc-snap', label: 'Perc Snap', type: 'click' },
  { key: 'silent', label: 'Silent / Visual Only', type: 'silent' },
];

const defaultState = {
  bpm: 120,
  numBeats: 4,
  beatMask: [0, 2],
  firstBeatState: 0, // 0 normal, 1 muted, 2 accent
  sound: 'just-click',
  volume: 0.7,
};

const state = {
  ...loadState(),
  isPlaying: false,
  currentBeat: 0,
  schedulerId: null,
  nextBeatTime: 0,
  tapSequence: [],
  audioReady: false,
  draggingTempo: false,
  dragStartY: 0,
  dragStartBpm: 120,
};

const els = {
  tempoValue: document.getElementById('tempoValue'),
  ringProgress: document.getElementById('ringProgress'),
  tempoRing: document.getElementById('tempoRing'),
  minusBtn: document.getElementById('minusBtn'),
  plusBtn: document.getElementById('plusBtn'),
  tapBtn: document.getElementById('tapBtn'),
  playBtn: document.getElementById('playBtn'),
  resetBtn: document.getElementById('resetBtn'),
  soundSelect: document.getElementById('soundSelect'),
  volumeSlider: document.getElementById('volumeSlider'),
  beatsValue: document.getElementById('beatsValue'),
  beatsMinusBtn: document.getElementById('beatsMinusBtn'),
  beatsPlusBtn: document.getElementById('beatsPlusBtn'),
  beatsGrid: document.getElementById('beatsGrid'),
  firstBeatModeBtn: document.getElementById('firstBeatModeBtn'),
  statusBox: document.getElementById('statusBox'),
};

class WebMetronome {
  constructor() {
    this.audioCtx = null;
    this.lookaheadMs = 25;
    this.scheduleAheadSeconds = 0.1;
    this.startedAt = 0;
  }

  ensureAudio() {
    if (!this.audioCtx) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextCtor();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    state.audioReady = true;
  }

  start() {
    this.ensureAudio();
    state.isPlaying = true;
    state.currentBeat = 0;
    this.startedAt = this.audioCtx.currentTime + 0.06;
    state.nextBeatTime = this.startedAt;
    this.scheduler();
    state.schedulerId = window.setInterval(() => this.scheduler(), this.lookaheadMs);
  }

  stop() {
    state.isPlaying = false;
    if (state.schedulerId) {
      window.clearInterval(state.schedulerId);
      state.schedulerId = null;
    }
    clearCurrentBeat();
    setRingProgress(0);
  }

  restartIfNeeded() {
    if (!state.isPlaying) return;
    this.stop();
    this.start();
  }

  scheduler() {
    while (state.nextBeatTime < this.audioCtx.currentTime + this.scheduleAheadSeconds) {
      this.scheduleBeat(state.currentBeat, state.nextBeatTime);
      const secondsPerBeat = 60 / state.bpm;
      state.nextBeatTime += secondsPerBeat;
      state.currentBeat = (state.currentBeat + 1) % state.numBeats;
    }
  }

  scheduleBeat(beatIndex, time) {
    const isMuted = isBeatMuted(beatIndex);
    const isFirst = beatIndex === 0;
    const accentState = state.firstBeatState;
    const shouldPlay = !(isMuted || (isFirst && accentState === 1));
    const isAccent = isFirst && accentState === 2;

    const delayMs = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
    window.setTimeout(() => {
      highlightBeat(beatIndex);
      pulseTempo();
      updateStatus(
        `Playing · ${state.bpm} BPM · ${state.numBeats}/4 · beat ${beatIndex + 1}${shouldPlay ? '' : ' (muted)'}`
      );
    }, delayMs);

    animateRingToBeat(time);

    if (shouldPlay && state.sound !== 'silent') {
      this.triggerClick(time, isAccent);
    }
  }

  triggerClick(time, accent = false) {
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const soundProfiles = {
      'just-click': { type: 'square', freq: accent ? 2200 : 1800, decay: 0.02, q: 8 },
      'hollow-click': { type: 'triangle', freq: accent ? 1600 : 1200, decay: 0.03, q: 3 },
      'drum-stick': { type: 'square', freq: accent ? 950 : 780, decay: 0.018, q: 12 },
      'practice-pad': { type: 'sawtooth', freq: accent ? 720 : 560, decay: 0.028, q: 6 },
      'met-quartz': { type: 'square', freq: accent ? 2600 : 2100, decay: 0.012, q: 16 },
      'perc-snap': { type: 'triangle', freq: accent ? 3200 : 2700, decay: 0.01, q: 20 },
    };

    const profile = soundProfiles[state.sound] || soundProfiles['just-click'];
    osc.type = profile.type;
    osc.frequency.setValueAtTime(profile.freq, time);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(profile.freq, time);
    filter.Q.setValueAtTime(profile.q, time);

    const volume = Math.max(0, Math.min(1, state.volume));
    const peak = (accent ? 1.25 : 1) * volume * 0.22;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + profile.decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + Math.max(0.04, profile.decay + 0.01));
  }
}

const metronome = new WebMetronome();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      bpm: clamp(parsed.bpm ?? defaultState.bpm, BPM_MIN, BPM_MAX),
      numBeats: clamp(parsed.numBeats ?? defaultState.numBeats, BEATS_MIN, BEATS_MAX),
      beatMask: Array.isArray(parsed.beatMask) ? parsed.beatMask.filter(Number.isInteger) : defaultState.beatMask,
      firstBeatState: [0, 1, 2].includes(parsed.firstBeatState) ? parsed.firstBeatState : 0,
      sound: soundOptions.some((s) => s.key === parsed.sound) ? parsed.sound : defaultState.sound,
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : defaultState.volume,
    };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  const persisted = {
    bpm: state.bpm,
    numBeats: state.numBeats,
    beatMask: [...state.beatMask].sort((a, b) => a - b),
    firstBeatState: state.firstBeatState,
    sound: state.sound,
    volume: state.volume,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isBeatMuted(index) {
  return state.beatMask.includes(index);
}

function setBpm(nextBpm, source = 'manual') {
  const bpm = clamp(Math.round(nextBpm), BPM_MIN, BPM_MAX);
  if (bpm === state.bpm) return;
  state.bpm = bpm;
  els.tempoValue.textContent = String(bpm);
  saveState();
  updateStatus(`Tempo set to ${bpm} BPM${source === 'tap' ? ' via tap tempo' : ''}.`);
  metronome.restartIfNeeded();
}

function setNumBeats(nextBeats) {
  const beats = clamp(Math.round(nextBeats), BEATS_MIN, BEATS_MAX);
  if (beats === state.numBeats) return;
  state.numBeats = beats;
  state.beatMask = state.beatMask.filter((i) => i < beats);
  els.beatsValue.textContent = String(beats);
  renderBeatGrid();
  saveState();
  updateStatus(`Pattern length set to ${beats} beats.`);
  metronome.restartIfNeeded();
}

function cycleFirstBeatState() {
  state.firstBeatState = (state.firstBeatState + 1) % 3;
  renderFirstBeatMode();
  renderBeatGrid();
  saveState();
  metronome.restartIfNeeded();
}

function renderFirstBeatMode() {
  const labels = ['Normal', 'Muted', 'Accented'];
  els.firstBeatModeBtn.textContent = labels[state.firstBeatState];
}

function renderSoundOptions() {
  els.soundSelect.innerHTML = soundOptions
    .map((item) => `<option value="${item.key}">${item.label}</option>`)
    .join('');
  els.soundSelect.value = state.sound;
}

function renderBeatGrid() {
  els.beatsGrid.innerHTML = '';
  for (let i = 0; i < state.numBeats; i += 1) {
    const btn = document.createElement('button');
    btn.className = 'beat-btn';
    const muted = isBeatMuted(i) || (i === 0 && state.firstBeatState === 1);
    btn.classList.toggle('active', !muted);
    btn.classList.toggle('muted', muted);
    btn.classList.toggle('first-accent', i === 0 && state.firstBeatState === 2);
    btn.dataset.index = String(i);
    btn.textContent = i === 0 ? `1${state.firstBeatState === 2 ? ' ★' : ''}` : String(i + 1);
    btn.addEventListener('click', () => toggleBeat(i));
    els.beatsGrid.appendChild(btn);
  }
}

function toggleBeat(index) {
  if (index === 0 && state.firstBeatState !== 0) {
    updateStatus('First beat is controlled by the First beat mode. Switch it back to Normal if you want beat 1 toggled normally.');
    return;
  }

  if (isBeatMuted(index)) {
    state.beatMask = state.beatMask.filter((i) => i !== index);
  } else {
    state.beatMask = [...state.beatMask, index].sort((a, b) => a - b);
  }
  renderBeatGrid();
  saveState();
  metronome.restartIfNeeded();
}

function highlightBeat(index) {
  clearCurrentBeat();
  const btn = els.beatsGrid.querySelector(`[data-index="${index}"]`);
  btn?.classList.add('current');
}

function clearCurrentBeat() {
  els.beatsGrid.querySelectorAll('.beat-btn.current').forEach((el) => el.classList.remove('current'));
}

function pulseTempo() {
  els.tempoRing.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.01)' },
      { transform: 'scale(1)' },
    ],
    { duration: 140, easing: 'ease-out' }
  );
}

function setRingProgress(progress) {
  const normalized = Math.max(0, Math.min(1, progress));
  els.ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - normalized));
}

function animateRingToBeat(scheduledTime) {
  const beatDurationMs = (60 / state.bpm) * 1000;
  const startDelay = Math.max(0, (scheduledTime - (metronome.audioCtx?.currentTime ?? 0)) * 1000);
  const startedAt = performance.now() + startDelay;

  const step = (now) => {
    if (!state.isPlaying) {
      setRingProgress(0);
      return;
    }
    const progress = clamp((now - startedAt) / beatDurationMs, 0, 1);
    setRingProgress(progress);
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
}

function handleTapTempo() {
  const now = performance.now();
  if (state.tapSequence.length > 0 && now - state.tapSequence[state.tapSequence.length - 1] > 2000) {
    state.tapSequence = [];
  }
  if (state.tapSequence.length >= 6) {
    state.tapSequence.shift();
  }
  state.tapSequence.push(now);

  if (state.tapSequence.length >= 3) {
    let totalGap = 0;
    for (let i = 1; i < state.tapSequence.length; i += 1) {
      totalGap += state.tapSequence[i] - state.tapSequence[i - 1];
    }
    const avgGap = totalGap / (state.tapSequence.length - 1);
    const bpm = 60000 / avgGap;
    setBpm(bpm, 'tap');
  } else {
    updateStatus(`Tap ${3 - state.tapSequence.length} more time${state.tapSequence.length === 2 ? '' : 's'} to lock tempo.`);
  }
}

function togglePlay() {
  if (!state.audioReady) {
    try {
      metronome.ensureAudio();
    } catch (error) {
      updateStatus(`Audio init failed: ${error.message}`);
      return;
    }
  }

  if (state.isPlaying) {
    metronome.stop();
    els.playBtn.textContent = 'Start';
    els.playBtn.classList.remove('is-playing');
    updateStatus('Stopped.');
  } else {
    metronome.start();
    els.playBtn.textContent = 'Stop';
    els.playBtn.classList.add('is-playing');
    updateStatus(`Started at ${state.bpm} BPM.`);
  }
}

function resetAll() {
  Object.assign(state, {
    ...defaultState,
    isPlaying: false,
    currentBeat: 0,
    schedulerId: null,
    nextBeatTime: 0,
    tapSequence: [],
    audioReady: state.audioReady,
    draggingTempo: false,
    dragStartY: 0,
    dragStartBpm: defaultState.bpm,
  });
  metronome.stop();
  renderAll();
  saveState();
  updateStatus('Reset to defaults.');
}

function renderAll() {
  els.tempoValue.textContent = String(state.bpm);
  els.beatsValue.textContent = String(state.numBeats);
  els.volumeSlider.value = String(state.volume);
  renderSoundOptions();
  renderFirstBeatMode();
  renderBeatGrid();
  els.playBtn.textContent = state.isPlaying ? 'Stop' : 'Start';
  els.playBtn.classList.toggle('is-playing', state.isPlaying);
  setRingProgress(0);
}

function updateStatus(text) {
  els.statusBox.textContent = text;
}

function attachEvents() {
  els.minusBtn.addEventListener('click', () => setBpm(state.bpm - 1));
  els.plusBtn.addEventListener('click', () => setBpm(state.bpm + 1));
  els.tapBtn.addEventListener('click', handleTapTempo);
  els.playBtn.addEventListener('click', togglePlay);
  els.resetBtn.addEventListener('click', resetAll);
  els.beatsMinusBtn.addEventListener('click', () => setNumBeats(state.numBeats - 1));
  els.beatsPlusBtn.addEventListener('click', () => setNumBeats(state.numBeats + 1));
  els.firstBeatModeBtn.addEventListener('click', cycleFirstBeatState);

  els.soundSelect.addEventListener('change', (event) => {
    state.sound = event.target.value;
    saveState();
    updateStatus(`Sound changed to ${soundOptions.find((s) => s.key === state.sound)?.label ?? state.sound}.`);
  });

  els.volumeSlider.addEventListener('input', (event) => {
    state.volume = Number(event.target.value);
    saveState();
  });

  const startDrag = (clientY) => {
    state.draggingTempo = true;
    state.dragStartY = clientY;
    state.dragStartBpm = state.bpm;
  };

  const onDrag = (clientY) => {
    if (!state.draggingTempo) return;
    const delta = (state.dragStartY - clientY) / 20;
    setBpm(state.dragStartBpm + delta);
  };

  const endDrag = () => {
    state.draggingTempo = false;
  };

  els.tempoRing.addEventListener('pointerdown', (event) => {
    els.tempoRing.setPointerCapture(event.pointerId);
    startDrag(event.clientY);
  });
  els.tempoRing.addEventListener('pointermove', (event) => onDrag(event.clientY));
  els.tempoRing.addEventListener('pointerup', endDrag);
  els.tempoRing.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      togglePlay();
    } else if (event.key === 'ArrowUp') {
      setBpm(state.bpm + 1);
    } else if (event.key === 'ArrowDown') {
      setBpm(state.bpm - 1);
    } else if (event.key.toLowerCase() === 't') {
      handleTapTempo();
    }
  });
}

renderAll();
attachEvents();
updateStatus('Ready. Press Start, Space, or tap tempo.');
