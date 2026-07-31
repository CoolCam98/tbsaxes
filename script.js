/* ==========================================================
   Tampa Bay Saxophone Collective — site script
   ========================================================== */

/* ---------- Nav ---------- */

const nav       = document.getElementById('nav');
const navLinks  = document.getElementById('navLinks');
const navToggle = document.getElementById('navToggle');

// Scroll — passive so it never blocks scrolling performance
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
}, { passive: true });

// Toggle open/close — keeps aria-expanded in sync for screen readers
navToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

// Close nav when a link is clicked
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Close nav when clicking outside of it
document.addEventListener('click', (e) => {
  if (
    navLinks.classList.contains('open') &&
    !navLinks.contains(e.target) &&
    !navToggle.contains(e.target)
  ) {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }
});

// Close nav on Escape key — returns focus to toggle button
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navLinks.classList.contains('open')) {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.focus();
  }
});


/* ==========================================================
   Audio player + reactive waveform (Web Audio API)
   ----------------------------------------------------------
   Waveform bars react in real time to the audio's frequency
   data. Click a track to switch; click play to start.
   Falls back gracefully if autoplay is blocked or a file
   is missing.
   ========================================================== */

const audio        = document.getElementById('audioPlayer');
const playBtn      = document.getElementById('playBtn');
const playIcon     = document.getElementById('playIcon');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl  = document.getElementById('totalTime');
const trackTitleEl = document.getElementById('trackTitle');
const trackSubEl   = document.getElementById('trackSub');
const trackList    = document.getElementById('trackList');
const trackItems   = trackList ? trackList.querySelectorAll('li') : [];
const waveform     = document.getElementById('waveform');

const NUM_BARS = 64;

// Build visual bars with a baseline shape
const bars = [];
for (let i = 0; i < NUM_BARS; i++) {
  const t        = i / NUM_BARS;
  const envelope = Math.sin(t * Math.PI) * 0.6 + 0.4;
  const noise    = Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
  const baseHeight = Math.max(8, Math.min(40, envelope * 30 + noise * 15));

  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.style.height = baseHeight + '%';
  bar.dataset.base = baseHeight;
  waveform.appendChild(bar);
  bars.push(bar);
}

// Web Audio API — created lazily on first user interaction
// (browsers require a user gesture before AudioContext can run)
let audioCtx   = null;
let analyser   = null;
let dataArray  = null;
let sourceNode = null;
let rafId      = null;

function setupAudioContext() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return; // very old browser — falls back to static bars
  audioCtx = new AC();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128; // 64 frequency bins, matches NUM_BARS
  analyser.smoothingTimeConstant = 0.75;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  sourceNode = audioCtx.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

// Resume AudioContext if page is foregrounded after being backgrounded
// (iOS Safari silently suspends it)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && audioCtx?.state === 'suspended') {
    audioCtx.resume();
  }
});

function formatTime(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function setPlayIcon(playing) {
  if (playing) {
    playIcon.innerHTML = '<rect x="4" y="3" width="3" height="12"/><rect x="11" y="3" width="3" height="12"/>';
    playBtn.setAttribute('aria-pressed', 'true');
    playBtn.setAttribute('aria-label', 'Pause');
  } else {
    playIcon.innerHTML = '<path d="M4 2 L4 16 L15 9 Z"/>';
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.setAttribute('aria-label', 'Play');
  }
}

function animateWaveform() {
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);

  for (let i = 0; i < NUM_BARS; i++) {
    const value  = dataArray[i] || 0;
    const target = Math.max(5, (value / 255) * 100);
    bars[i].style.height = target + '%';
    bars[i].classList.add('active');
  }

  rafId = requestAnimationFrame(animateWaveform);
}

function resetWaveform() {
  cancelAnimationFrame(rafId);
  bars.forEach((bar) => {
    bar.style.height = bar.dataset.base + '%';
    bar.classList.remove('active');
  });
}

// Load a track — updates player UI, track list selection, and ARIA state
function loadTrack(li) {
  if (!li) return;
  const src   = li.dataset.src;
  const title = li.dataset.title;
  const sub   = li.dataset.sub || '';

  if (trackTitleEl) trackTitleEl.textContent = title;
  if (trackSubEl)   trackSubEl.textContent   = sub;
  if (playBtn)      playBtn.setAttribute('aria-label', `Play ${title}`);

  audio.src = src;
  audio.load();

  // Update active class and aria-selected on all tracks
  trackItems.forEach((item) => {
    item.classList.remove('active');
    item.setAttribute('aria-selected', 'false');
  });
  li.classList.add('active');
  li.setAttribute('aria-selected', 'true');
}

// Track list interaction — click and keyboard
trackItems.forEach((li) => {
  li.addEventListener('click', () => {
    const wasActive = li.classList.contains('active');
    loadTrack(li);
    if (wasActive) audio.currentTime = 0;
    audio.play().catch(() => {
      setPlayIcon(false);
      resetWaveform();
    });
  });

  // Enter / Space activates the track (tabindex already set in HTML)
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      li.click();
    }
  });
});

// Load the first track so duration shows on page load
// No DOMContentLoaded wrapper needed — script runs deferred, DOM is always ready
const firstTrack = trackList?.querySelector('li.active') || trackList?.querySelector('li');
if (firstTrack) loadTrack(firstTrack);

// Play / pause button
playBtn.addEventListener('click', () => {
  if (!audio.src) {
    const first = trackList?.querySelector('li');
    if (first) loadTrack(first);
  }

  if (audio.paused) {
    setupAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    audio.play().catch((err) => {
      console.warn('Audio play failed:', err);
      setPlayIcon(false);
    });
  } else {
    audio.pause();
  }
});

// Audio element events drive the UI
audio.addEventListener('play', () => {
  setPlayIcon(true);
  setupAudioContext();
  if (rafId) cancelAnimationFrame(rafId);
  animateWaveform();
});

audio.addEventListener('pause', () => {
  setPlayIcon(false);
  cancelAnimationFrame(rafId);
});

audio.addEventListener('ended', () => {
  setPlayIcon(false);
  resetWaveform();
  if (currentTimeEl) currentTimeEl.textContent = '0:00';
});

audio.addEventListener('timeupdate', () => {
  if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
});

audio.addEventListener('loadedmetadata', () => {
  if (totalTimeEl) totalTimeEl.textContent = formatTime(audio.duration);

  // Update the track-length display in the list for the active track
  const active = trackList?.querySelector('li.active');
  if (active) {
    const lengthEl = active.querySelector('.track-length');
    if (lengthEl && isFinite(audio.duration)) {
      lengthEl.textContent = formatTime(audio.duration);
    }
  }
});

audio.addEventListener('error', () => {
  // File missing or unloadable — reset to resting state
  resetWaveform();
  setPlayIcon(false);
});