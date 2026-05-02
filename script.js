/* ==========================================================
   Tampa Bay Saxophone Collective — site script
   ========================================================== */

// ---------- Nav ----------
const nav = document.getElementById('nav');
const navLinks = document.getElementById('navLinks');
const navToggle = document.getElementById('navToggle');

window.addEventListener('scroll', () => {
  if (window.scrollY > 40) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
});

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

/* ==========================================================
   Audio player + reactive waveform (Web Audio API)
   ----------------------------------------------------------
   The waveform bars react in real time to the audio's
   frequency data. Click a track to switch; click play to
   start. If the browser blocks autoplay or the file is
   missing, we fall back gracefully.
   ========================================================== */

const audio = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const trackTitleEl = document.getElementById('trackTitle');
const trackSubEl = document.getElementById('trackSub');
const trackList = document.getElementById('trackList');
const trackItems = trackList ? trackList.querySelectorAll('li') : [];
const waveform = document.getElementById('waveform');

const NUM_BARS = 64;

// Build the visual bars with a baseline shape
const bars = [];
for (let i = 0; i < NUM_BARS; i++) {
  const t = i / NUM_BARS;
  const envelope = Math.sin(t * Math.PI) * 0.6 + 0.4;
  const noise = Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
  const baseHeight = Math.max(8, Math.min(40, envelope * 30 + noise * 15));

  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.style.height = baseHeight + '%';
  bar.dataset.base = baseHeight;
  waveform.appendChild(bar);
  bars.push(bar);
}

// Web Audio API setup — created lazily on first user interaction
// (browsers require a user gesture before AudioContext can run)
let audioCtx = null;
let analyser = null;
let dataArray = null;
let sourceNode = null;
let rafId = null;

function setupAudioContext() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return; // very old browser — fallback to fake animation
  audioCtx = new AC();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128; // gives us 64 frequency bins, matches NUM_BARS
  analyser.smoothingTimeConstant = 0.75;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  sourceNode = audioCtx.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function formatTime(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
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
    // Map frequency value (0-255) to a height percentage (5-100)
    const value = dataArray[i] || 0;
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

// Track switching
function loadTrack(li) {
  if (!li) return;
  const src = li.dataset.src;
  const title = li.dataset.title;
  const sub = li.dataset.sub || '';

  if (trackTitleEl) trackTitleEl.textContent = title;
  if (trackSubEl) trackSubEl.textContent = sub;
  if (playBtn) playBtn.setAttribute('aria-label', `Play ${title}`);

  audio.src = src;
  audio.load();

  trackItems.forEach((item) => item.classList.remove('active'));
  li.classList.add('active');
}

trackItems.forEach((li) => {
  li.addEventListener('click', () => {
    const wasActive = li.classList.contains('active');
    loadTrack(li);
    // If the user clicks the active track, restart it; otherwise start playing
    if (wasActive) {
      audio.currentTime = 0;
    }
    audio.play().catch(() => {
      // play might fail if file is missing — just reset UI
      setPlayIcon(false);
      resetWaveform();
    });
  });

  // Keyboard support — Enter / Space activates the track
  li.tabIndex = 0;
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      li.click();
    }
  });
});

// Load the first track on page load so duration is shown
window.addEventListener('DOMContentLoaded', () => {
  const first = trackList?.querySelector('li.active') || trackList?.querySelector('li');
  if (first) loadTrack(first);
});

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

  // Update the track-length display in the list for the current track
  const active = trackList?.querySelector('li.active');
  if (active) {
    const lengthEl = active.querySelector('.track-length');
    if (lengthEl && isFinite(audio.duration)) {
      lengthEl.textContent = formatTime(audio.duration);
    }
  }
});

audio.addEventListener('error', () => {
  // file missing or unloadable — leave waveform in resting state
  resetWaveform();
  setPlayIcon(false);
});

/* ==========================================================
   Booking form — Netlify submission
   ========================================================== */

function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const originalHtml = btn.innerHTML;

  btn.innerHTML = 'Sending...';
  btn.disabled = true;
  btn.style.opacity = '0.7';

  const formData = new FormData(form);
  const body = new URLSearchParams(formData).toString();

  // Submit to the form's own action URL — Netlify intercepts POSTs to any path
  // and routes them to the form handler based on the hidden form-name field
  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body,
  })
    .then((response) => {
      if (!response.ok) throw new Error('Submission failed: ' + response.status);
      // Redirect to the thank-you page
      window.location.href = '/thanks';
    })
    .catch((err) => {
      console.error('Form submission error:', err);
      btn.innerHTML = 'Something Went Wrong · Try Again';
      btn.style.background = '#a04040';
      btn.style.color = '#faf9f3';
      btn.style.borderColor = '#a04040';
      btn.style.opacity = '1';

      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }, 4000);
    });
}