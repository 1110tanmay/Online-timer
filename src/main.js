import './style.css';

// ─── Pexels API Config ────────────────────────────────────────────────────────
const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || '';

// ─── Timer State ─────────────────────────────────────────────────────────────
let remainingSeconds = 45 * 60;
let timerInterval = null;
let isPlaying = false;
let audioCtx = null;

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const playPauseBtn = document.getElementById('btn-play-pause');
const iconPlay     = document.getElementById('icon-play');
const iconPause    = document.getElementById('icon-pause');
const btnMinus     = document.getElementById('btn-minus');
const btnPlus      = document.getElementById('btn-plus');
const btnReset     = document.getElementById('btn-reset');
const nameInput    = document.getElementById('name-input');
const greetingDiv  = document.getElementById('greeting');
const bgVideo      = document.getElementById('bg-video');
const liveBg       = document.querySelector('.live-bg');
const pills        = document.querySelectorAll('.pill');

// ─── Name Greeting ────────────────────────────────────────────────────────────
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && nameInput.value.trim() !== '') {
    greetingDiv.textContent = `Hi ${nameInput.value.trim()}, you got this!`;
    nameInput.style.display = 'none';
    greetingDiv.style.display = 'block';
  }
});

// ─── Flip Clock ───────────────────────────────────────────────────────────────
function getDigits(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return {
    'm-tens':  Math.floor(m / 10),
    'm-units': m % 10,
    's-tens':  Math.floor(s / 10),
    's-units': s % 10
  };
}

const digitsState = { 'm-tens': -1, 'm-units': -1, 's-tens': -1, 's-units': -1 };

function updateDigit(id, newVal) {
  if (digitsState[id] === newVal) return;
  digitsState[id] = newVal;
  const el   = document.getElementById(id);
  const span = el.querySelector('.val');
  el.classList.add('flipping-out');
  setTimeout(() => {
    span.textContent = newVal;
    span.style.transition = 'none';
    span.style.transform  = 'rotateX(-90deg)';
    void span.offsetWidth;
    span.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
    el.classList.remove('flipping-out');
    span.style.transform  = 'rotateX(0deg)';
  }, 250);
}

function updateDisplay() {
  const d = getDigits(Math.max(0, remainingSeconds));
  Object.keys(d).forEach(id => updateDigit(id, d[id]));
}

// ─── Audio ───────────────────────────────────────────────────────────────────
function playSoothingSound() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;
  [261.63, 329.63, 392.00, 493.88].forEach((freq, i) => {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.1 + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 4 + i);
    osc.start(t); osc.stop(t + 5 + i);
  });
}

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// ─── Timer Controls ───────────────────────────────────────────────────────────
function stopTimer() {
  clearInterval(timerInterval); timerInterval = null; isPlaying = false;
  iconPlay.style.display = 'block'; iconPause.style.display = 'none';
}

function startTimer() {
  if (remainingSeconds <= 0) return;
  isPlaying = true;
  iconPlay.style.display = 'none'; iconPause.style.display = 'block';
  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateDisplay();
    if (remainingSeconds <= 0) { stopTimer(); playSoothingSound(); }
  }, 1000);
}

playPauseBtn.addEventListener('click', () => { initAudio(); if (isPlaying) stopTimer(); else startTimer(); });
btnPlus.addEventListener('click',  () => { initAudio(); remainingSeconds += 15 * 60; updateDisplay(); });
btnMinus.addEventListener('click', () => {
  initAudio();
  remainingSeconds = Math.max(0, remainingSeconds - 15 * 60);
  if (remainingSeconds === 0 && isPlaying) stopTimer();
  updateDisplay();
});
btnReset.addEventListener('click', () => { initAudio(); stopTimer(); remainingSeconds = 45 * 60; updateDisplay(); });

// ─── Pexels Video Background ──────────────────────────────────────────────────
async function loadPexelsVideo(query) {
  if (!PEXELS_API_KEY || PEXELS_API_KEY === 'your_pexels_api_key_here') {
    showApiMissingBanner();
    return;
  }

  liveBg.classList.add('loading');

  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape&size=large`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    if (!res.ok) throw new Error(`Pexels API error: ${res.status}`);
    const data = await res.json();

    if (!data.videos || data.videos.length === 0) {
      console.warn('No videos found for query:', query);
      liveBg.classList.remove('loading');
      return;
    }

    // Pick a random video from the results
    const video = data.videos[Math.floor(Math.random() * data.videos.length)];

    // Prefer UHD → HD → any MP4
    const file = video.video_files.find(f => f.quality === 'uhd' && f.file_type === 'video/mp4')
              || video.video_files.find(f => f.quality === 'hd'  && f.file_type === 'video/mp4')
              || video.video_files.find(f => f.file_type === 'video/mp4')
              || video.video_files[0];

    // Fade out, swap source, fade in
    bgVideo.classList.add('fading');
    bgVideo.classList.remove('visible');
    setTimeout(() => {
      bgVideo.src = file.link;
      bgVideo.load();
      bgVideo.play().catch(() => {});
      bgVideo.classList.remove('fading');
      // Reveal video once it actually has data
      bgVideo.addEventListener('canplay', () => {
        bgVideo.classList.add('visible');
      }, { once: true });
      liveBg.classList.remove('loading');
    }, 700);

  } catch (err) {
    console.error('Failed to load Pexels video:', err);
    liveBg.classList.remove('loading');
  }
}

function showApiMissingBanner() {
  if (document.getElementById('api-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'api-banner';
  banner.innerHTML = `
    ⚡ Live backgrounds need a free Pexels API key.
    <a href="https://www.pexels.com/api/" target="_blank">Get yours free at pexels.com/api</a>,
    then add it to a <code>.env</code> file as <code>VITE_PEXELS_API_KEY=your_key</code> and restart the server.
  `;
  document.body.appendChild(banner);
}

// ─── Category Pills ───────────────────────────────────────────────────────────
pills.forEach(pill => {
  pill.addEventListener('click', () => {
    pills.forEach(p => { p.classList.remove('active'); });
    pill.classList.add('active');
    pill.classList.add('loading-pill');
    const query = pill.dataset.query;
    loadPexelsVideo(query).finally(() => {
      pill.classList.remove('loading-pill');
    });
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
updateDisplay();
// Load default category on start
loadPexelsVideo('sea turtle ocean');
