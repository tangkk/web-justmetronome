const STORAGE_KEY = 'just-metronome-web-v2';
const BPM_MIN = 10;
const BPM_MAX = 360;
const BEATS_MIN = 1;
const BEATS_MAX = 32;

const metSoundList = [
  { key: 'just-click', label: 'Just Click', file: 'assets/just-click.wav' },
  { key: 'hollow-click', label: 'Hollow Click', file: 'assets/hollow-click.wav' },
  { key: 'drum-stick', label: 'Drum Stick', file: 'assets/drum-stick.wav' },
  { key: 'practice-pad', label: 'Practice Pad', file: 'assets/practice-pad.wav' },
  { key: 'met-quartz', label: 'Met Quartz', file: 'assets/met-quartz.wav' },
  { key: 'perc-snap', label: 'Perc Snap', file: 'assets/perc-snap.wav' },
  { key: 'silent', label: 'Silent', file: null },
];

const defaultState = {
  bpm: 120,
  numBeats: 4,
  beatMask: [0, 2],
  firstBeatState: 0,
  playState: 0,
  volume: 1,
};

const state = {
  ...loadState(),
  isPlaying: false,
  currentBeat: 0,
  tapSequence: [],
  schedulerId: null,
  nextBeatTime: 0,
  dragActive: false,
  dragStartY: 0,
  dragInitialBpm: 120,
  focusTimerSeconds: 25 * 60,
  focusTimerRunning: false,
  focusTimerIntervalId: null,
  focusTimerDing: null,
  focusTimerDragActive: false,
  focusTimerDragStartY: 0,
  focusTimerDragInitialMinutes: 25,
  audioUnlocked: false,
};

const els = {
  app: document.querySelector('.app'),
  focusTimerBox: document.getElementById('focusTimerBox'),
  focusTimerDisplay: document.getElementById('focusTimerDisplay'),
  playStateBtn: document.getElementById('playStateBtn'),
  prefsResetBtn: document.getElementById('prefsResetBtn'),
  tempoButton: document.getElementById('tempoButton'),
  tempoField: document.getElementById('tempoField'),
  ringProgress: document.getElementById('ringProgress'),
  beatsMinusBtn: document.getElementById('beatsMinusBtn'),
  beatsPlusBtn: document.getElementById('beatsPlusBtn'),
  beatStack: document.getElementById('beatStack'),
  beatOptStack: document.getElementById('beatOptStack'),
  volumeSlider: document.getElementById('volumeSlider'),
  playHint: document.getElementById('playHint'),
};

class WebMetronome {
  constructor() {
    this.audioCtx = null;
    this.lookaheadMs = 25;
    this.scheduleAhead = 0.1;
    this.buffers = new Map();
    this.htmlAudio = new Map();
  }

  async ensureAudio() {
    if (!this.audioCtx) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextCtor();
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    await this.preloadCurrentBuffer();
  }

  async preloadCurrentBuffer() {
    const sound = metSoundList[state.playState];
    if (!sound || !sound.file) return;

    if (!this.htmlAudio.has(sound.file)) {
      const audio = new Audio(sound.file);
      audio.preload = 'auto';
      audio.playsInline = true;
      this.htmlAudio.set(sound.file, audio);
    }

    if (this.buffers.has(sound.file)) return;
    const res = await fetch(sound.file);
    const arr = await res.arrayBuffer();
    const buffer = await this.audioCtx.decodeAudioData(arr.slice(0));
    this.buffers.set(sound.file, buffer);
  }

  async start() {
    await this.ensureAudio();
    state.isPlaying = true;
    state.currentBeat = 0;
    state.nextBeatTime = this.audioCtx.currentTime + 0.05;
    this.scheduler();
    state.schedulerId = window.setInterval(() => this.scheduler(), this.lookaheadMs);
  }

  stop() {
    state.isPlaying = false;
    if (state.schedulerId) {
      clearInterval(state.schedulerId);
      state.schedulerId = null;
    }
    clearCurrentBeat();
  }

  restartIfPlaying() {
    if (!state.isPlaying) return;
    this.stop();
    this.start();
  }

  scheduler() {
    while (state.nextBeatTime < this.audioCtx.currentTime + this.scheduleAhead) {
      this.scheduleBeat(state.currentBeat, state.nextBeatTime);
      state.nextBeatTime += 60 / state.bpm;
      state.currentBeat = (state.currentBeat + 1) % state.numBeats;
    }
  }

  scheduleBeat(index, time) {
    const firstBeatMuted = index === 0 && state.firstBeatState === 0 && state.beatMask.includes(0);
    const normalMuted = index !== 0 && state.beatMask.includes(index);
    const mutedByMode = index === 0 && state.firstBeatState === 1;
    const shouldPlay = !(firstBeatMuted || normalMuted || mutedByMode);
    const isAccent = index === 0 && state.firstBeatState === 2;
    const delayMs = Math.max(0, (time - this.audioCtx.currentTime) * 1000);

    setTimeout(() => {
      highlightBeat(index);
    }, delayMs);

    if (shouldPlay && state.playState < metSoundList.length - 1) {
      this.click(time, isAccent);
    }
  }

  click(time, accent) {
    const ctx = this.audioCtx;
    const sound = metSoundList[state.playState];
    const buffer = sound?.file ? this.buffers.get(sound.file) : null;
    const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isAppleMobile && sound?.file) {
      const baseAudio = this.htmlAudio.get(sound.file);
      if (baseAudio) {
        const audio = baseAudio.cloneNode();
        audio.volume = Math.min(1, (accent ? 1.6 : 1) * state.volume);
        audio.playsInline = true;
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
    }

    if (buffer) {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime((accent ? 6.4 : 4) * state.volume, time);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(time);
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const profiles = {
      0: { type: 'square', freq: accent ? 2200 : 1800, decay: 0.02, q: 8 },
      1: { type: 'triangle', freq: accent ? 1600 : 1250, decay: 0.028, q: 4 },
      2: { type: 'square', freq: accent ? 900 : 760, decay: 0.016, q: 14 },
      3: { type: 'sawtooth', freq: accent ? 700 : 540, decay: 0.024, q: 7 },
      4: { type: 'square', freq: accent ? 2600 : 2100, decay: 0.011, q: 18 },
      5: { type: 'triangle', freq: accent ? 3200 : 2750, decay: 0.01, q: 22 },
    };

    const p = profiles[state.playState] || profiles[0];
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.freq, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(p.freq, time);
    filter.Q.setValueAtTime(p.q, time);

    const peak = (accent ? 1.4 : 1) * state.volume * 0.22;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + p.decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + Math.max(0.04, p.decay + 0.01));
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
      beatMask: Array.isArray(parsed.beatMask) ? parsed.beatMask.filter((n) => Number.isInteger(n)) : defaultState.beatMask,
      firstBeatState: [0, 1, 2].includes(parsed.firstBeatState) ? parsed.firstBeatState : 0,
      playState: Number.isInteger(parsed.playState) ? clamp(parsed.playState, 0, metSoundList.length - 1) : 0,
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(2, parsed.volume)) : defaultState.volume,
    };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      bpm: state.bpm,
      numBeats: state.numBeats,
      beatMask: [...state.beatMask].sort((a, b) => a - b),
      firstBeatState: state.firstBeatState,
      playState: state.playState,
      volume: state.volume,
    })
  );
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function render() {
  els.tempoField.textContent = String(state.bpm);
  els.playStateBtn.style.transform = `rotate(${state.playState * 60}deg)`;
  els.volumeSlider.value = String(state.volume);
  els.playHint.textContent = '';
  els.app.classList.toggle('is-playing', state.isPlaying);
  renderFocusTimer();
  renderBeats();
}

function renderFocusTimer() {
  const min = Math.floor(state.focusTimerSeconds / 60);
  const sec = state.focusTimerSeconds % 60;
  els.focusTimerDisplay.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function setFocusTimerMinutes(nextMinutes) {
  const minutes = Math.max(1, Math.min(180, Math.round(nextMinutes)));
  state.focusTimerSeconds = minutes * 60;
  renderFocusTimer();
}

function renderBeats() {
  els.beatStack.innerHTML = '';
  els.beatOptStack.innerHTML = '';

  for (let i = 0; i < state.numBeats; i += 1) {
    const btn = document.createElement('button');
    btn.className = 'beat-btn';
    btn.dataset.index = String(i);

    if (i === 0) {
      if (state.firstBeatState === 2) {
        btn.textContent = '◼️';
      } else if (state.firstBeatState === 1) {
        btn.textContent = '◽️';
      } else {
        btn.textContent = state.beatMask.includes(0) ? '◽️' : '◾️';
      }
    } else {
      btn.textContent = state.beatMask.includes(i) ? '◽️' : '◾️';
    }

    btn.addEventListener('click', () => onBeatTap(i));

    if (i < 8) {
      els.beatStack.appendChild(btn);
    } else {
      els.beatOptStack.appendChild(btn);
    }
  }
}

function onBeatTap(index) {
  if (index === 0) {
    cycleFirstBeatTap();
    return;
  }
  toggleBeatMask(index);
}

function cycleFirstBeatTap() {
  if (state.firstBeatState === 0) {
    state.firstBeatState = 2;
  } else if (state.firstBeatState === 2) {
    state.firstBeatState = 1;
  } else {
    state.firstBeatState = 0;
  }
  saveState();
  render();
  metronome.restartIfPlaying();
}

function toggleBeatMask(index) {
  if (state.beatMask.includes(index)) {
    state.beatMask = state.beatMask.filter((x) => x !== index);
  } else {
    state.beatMask.push(index);
  }
  saveState();
  render();
  metronome.restartIfPlaying();
}

function setBpm(next) {
  const bpm = clamp(next, BPM_MIN, BPM_MAX);
  if (bpm === state.bpm) return;
  state.bpm = bpm;
  els.tempoField.textContent = String(state.bpm);
  saveState();
  metronome.restartIfPlaying();
}

function adjustBeats(delta) {
  const next = clamp(state.numBeats + delta, BEATS_MIN, BEATS_MAX);
  if (next === state.numBeats) return;
  state.numBeats = next;
  state.beatMask = state.beatMask.filter((i) => i < state.numBeats);
  saveState();
  render();
  metronome.restartIfPlaying();
}

async function togglePlay() {
  await unlockAudio();
  if (state.isPlaying) {
    metronome.stop();
    render();
  } else {
    await metronome.start();
    render();
  }
}

function changeSound() {
  state.playState += 1;
  if (state.playState >= metSoundList.length) state.playState = 0;
  saveState();
  render();
  metronome.restartIfPlaying();
}

function resetPrefs() {
  state.bpm = 120;
  state.numBeats = 4;
  state.beatMask = [0, 2];
  state.playState = 0;
  state.firstBeatState = 0;
  saveState();
  render();
  metronome.restartIfPlaying();
}

function doTapTempo() {
  const now = performance.now();
  if (state.tapSequence.length && now - state.tapSequence[state.tapSequence.length - 1] > 2000) {
    state.tapSequence = [];
  }
  if (state.tapSequence.length > 10) {
    state.tapSequence.shift();
  }
  state.tapSequence.push(now);

  if (state.tapSequence.length >= 3) {
    let sum = 0;
    for (let i = 0; i < state.tapSequence.length - 1; i += 1) {
      sum += state.tapSequence[i + 1] - state.tapSequence[i];
    }
    setBpm(60000 / (sum / (state.tapSequence.length - 1)));
  }
}

function highlightBeat(index) {
  clearCurrentBeat();
  const btn = document.querySelector(`.beat-btn[data-index="${index}"]`);
  if (btn) btn.classList.add('current');
}

function clearCurrentBeat() {
  document.querySelectorAll('.beat-btn.current').forEach((el) => el.classList.remove('current'));
}

function startFocusTimer() {
  if (state.focusTimerRunning) return;
  state.focusTimerRunning = true;
  state.focusTimerIntervalId = window.setInterval(() => {
    if (state.focusTimerSeconds > 0) {
      state.focusTimerSeconds -= 1;
      renderFocusTimer();
      if (state.focusTimerSeconds === 0) {
        pauseFocusTimer();
        playFocusTimerDing();
      }
    } else {
      pauseFocusTimer();
    }
  }, 1000);
  renderFocusTimer();
}

function pauseFocusTimer() {
  state.focusTimerRunning = false;
  if (state.focusTimerIntervalId) {
    clearInterval(state.focusTimerIntervalId);
    state.focusTimerIntervalId = null;
  }
  renderFocusTimer();
}

function resetFocusTimer() {
  pauseFocusTimer();
  state.focusTimerSeconds = 25 * 60;
  renderFocusTimer();
}

function toggleFocusTimer() {
  if (state.focusTimerRunning) {
    pauseFocusTimer();
  } else {
    startFocusTimer();
  }
}

function playFocusTimerDing() {
  if (!state.focusTimerDing) {
    state.focusTimerDing = new Audio('assets/focus-ding.mp3');
    state.focusTimerDing.preload = 'auto';
    state.focusTimerDing.playsInline = true;
  }
  state.focusTimerDing.currentTime = 0;
  state.focusTimerDing.play().catch(() => {});
}

async function unlockAudio() {
  if (state.audioUnlocked) return;
  state.audioUnlocked = true;
  try {
    await metronome.ensureAudio();
    if (!state.focusTimerDing) {
      state.focusTimerDing = new Audio('assets/focus-ding.mp3');
      state.focusTimerDing.preload = 'auto';
      state.focusTimerDing.playsInline = true;
    }
    state.focusTimerDing.muted = true;
    await state.focusTimerDing.play().catch(() => {});
    state.focusTimerDing.pause();
    state.focusTimerDing.currentTime = 0;
    state.focusTimerDing.muted = false;
  } catch {}
}


function attachEvents() {
  const primeAudio = () => unlockAudio();
  window.addEventListener('touchstart', primeAudio, { passive: true, once: true });
  window.addEventListener('pointerdown', primeAudio, { passive: true, once: true });
  window.addEventListener('click', primeAudio, { passive: true, once: true });

  els.playStateBtn.addEventListener('click', changeSound);
  els.prefsResetBtn.addEventListener('click', resetPrefs);
  let focusTimerDragMoved = false;
  els.focusTimerBox.addEventListener('pointerdown', (e) => {
    els.focusTimerBox.setPointerCapture(e.pointerId);
    focusTimerDragMoved = false;
    state.focusTimerDragActive = true;
    state.focusTimerDragStartY = e.clientY;
    state.focusTimerDragInitialMinutes = Math.max(1, Math.round(state.focusTimerSeconds / 60));
  });
  els.focusTimerBox.addEventListener('pointermove', (e) => {
    if (!state.focusTimerDragActive) return;
    const deltaY = state.focusTimerDragStartY - e.clientY;
    if (Math.abs(deltaY) > 4) focusTimerDragMoved = true;
    const minuteDelta = deltaY / 20;
    setFocusTimerMinutes(state.focusTimerDragInitialMinutes + minuteDelta);
  });
  els.focusTimerBox.addEventListener('pointerup', () => {
    const wasDragging = focusTimerDragMoved;
    state.focusTimerDragActive = false;
    if (!wasDragging) toggleFocusTimer();
  });
  els.focusTimerBox.addEventListener('pointercancel', () => {
    state.focusTimerDragActive = false;
  });
  els.focusTimerBox.addEventListener('dblclick', (e) => {
    e.preventDefault();
    resetFocusTimer();
  });
  els.tempoButton.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
  });
  els.volumeSlider.addEventListener('input', (e) => {
    state.volume = Number(e.target.value);
    saveState();
  });
  els.beatsMinusBtn.addEventListener('click', () => adjustBeats(-1));
  els.beatsPlusBtn.addEventListener('click', () => adjustBeats(1));

  const beginDrag = (y) => {
    state.dragActive = true;
    state.dragStartY = y;
    state.dragInitialBpm = state.bpm;
  };
  const moveDrag = (y) => {
    if (!state.dragActive) return;
    const delta = (state.dragStartY - y) / 20;
    setBpm(state.dragInitialBpm + delta);
  };
  const endDrag = () => {
    state.dragActive = false;
  };

  els.tempoStage = document.querySelector('.tempo-stage');
  let dragMoved = false;
  els.tempoStage.addEventListener('pointerdown', (e) => {
    els.tempoStage.setPointerCapture(e.pointerId);
    dragMoved = false;
    beginDrag(e.clientY);
  });
  els.tempoStage.addEventListener('pointermove', (e) => {
    if (state.dragActive && Math.abs(e.clientY - state.dragStartY) > 4) dragMoved = true;
    moveDrag(e.clientY);
  });
  els.tempoStage.addEventListener('pointerup', () => {
    const wasDragging = dragMoved;
    endDrag();
    if (!wasDragging) togglePlay();
  });
  els.tempoStage.addEventListener('pointercancel', endDrag);

  els.app.addEventListener('click', (e) => {
    const interactive = e.target.closest('button, input, label, .tempo-stage, .stepper-row, .beat-stack');
    if (!interactive) doTapTempo();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowUp') {
      setBpm(state.bpm + 1);
    } else if (e.key === 'ArrowDown') {
      setBpm(state.bpm - 1);
    } else if (e.key === '[') {
      adjustBeats(-1);
    } else if (e.key === ']') {
      adjustBeats(1);
    } else if (e.key.toLowerCase() === 't') {
      doTapTempo();
    }
  });
}

render();
attachEvents();
