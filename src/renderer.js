// DOM Elements
const preview = document.getElementById('preview');
const sourceList = document.getElementById('sourceList');
const sourceTabs = document.querySelectorAll('.source-tab');
const recordBtn = document.getElementById('recordBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const snipBtn = document.getElementById('snipBtn');
const gifBtn = document.getElementById('gifBtn');
const folderBtn = document.getElementById('folderBtn');
const quickActions = document.getElementById('quickActions');
const recordingControls = document.getElementById('recordingControls');
const recTime = document.getElementById('recTime');
const stopBtn = document.getElementById('stopBtn');
const pauseBtn = document.getElementById('pauseBtn');
const systemAudio = document.getElementById('systemAudio');
const micAudio = document.getElementById('micAudio');
const countdownSelect = document.getElementById('countdownSelect');
const cursorHighlight = document.getElementById('cursorHighlight');
const previewBadge = document.getElementById('previewBadge');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const toastContainer = document.getElementById('toastContainer');
const screenshotResult = document.getElementById('screenshotResult');
const screenshotImg = document.getElementById('screenshotImg');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModal = document.getElementById('closeModal');
const cancelSettings = document.getElementById('cancelSettings');
const saveSettingsBtn = document.getElementById('saveSettings');
const savePath = document.getElementById('savePath');
const browsePath = document.getElementById('browsePath');
const videoQuality = document.getElementById('videoQuality');
const fps = document.getElementById('fps');
const gifFps = document.getElementById('gifFps');
const refreshSources = document.getElementById('refreshSources');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');
const panelTabs = document.querySelectorAll('.panel-tab');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNumber = document.getElementById('countdownNumber');
const recentCaptures = document.getElementById('recentCaptures');
const webcamToggle = document.getElementById('webcamToggle');
const webcamOverlay = document.getElementById('webcamOverlay');
const webcamPreview = document.getElementById('webcamPreview');
const webcamPosButtons = document.querySelectorAll('.webcam-pos-btn');
const autoStopSelect = document.getElementById('autoStopSelect');
const clickEffects = document.getElementById('clickEffects');
const keyboardOverlay = document.getElementById('keyboardOverlay');
const systemLevelEl = document.getElementById('systemLevel');
const micLevelEl = document.getElementById('micLevel');
const audioBtn = document.getElementById('audioBtn');
const colorPickerBtn = document.getElementById('colorPickerBtn');
const outputFormat = document.getElementById('outputFormat');
const watermarkText = document.getElementById('watermarkText');
const scheduleTime = document.getElementById('scheduleTime');
const scheduleBtn = document.getElementById('scheduleBtn');
const scheduleStatus = document.getElementById('scheduleStatus');
const showTimerOverlay = document.getElementById('showTimerOverlay');
const annotationBtn = document.getElementById('annotationBtn');

// State
let selectedSource = null;
let allSources = [];
let currentFilter = 'screen';
let mediaRecorder = null;
let recordedChunks = [];
let mediaStream = null;
let isRecording = false;
let isPaused = false;
let isGifMode = false;
let timerInterval = null;
let recordingStartTime = null;
let pausedTime = 0;
let lastScreenshotPath = null;
let recentFiles = [];
let webcamStream = null;
let webcamEnabled = false;
let autoStopTimeout = null;
let isAudioOnlyMode = false;
let audioAnalyserSystem = null;
let audioAnalyserMic = null;
let audioContext = null;
let scheduledRecordingTimeout = null;
let clickEffectsEnabled = false;
let keyboardOverlayEnabled = false;
let keyboardOverlayEl = null;
let pressedKeys = [];

// Initialize
async function init() {
  await loadSettings();
  await loadSources();
  await loadRecentCaptures();
  setupEventListeners();
  setupIPCListeners();
}

// Show toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success'
        ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
        : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
    </svg>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Set status
function setStatus(text, recording = false) {
  statusText.textContent = text;
  if (recording) {
    statusDot.classList.add('recording');
  } else {
    statusDot.classList.remove('recording');
  }
}

// Load sources
async function loadSources() {
  try {
    allSources = await window.electronAPI.getSources();
    filterAndDisplaySources();

    // Auto-select first screen
    const screens = allSources.filter(s => s.id.startsWith('screen:'));
    if (screens.length > 0 && !selectedSource) {
      selectSource(screens[0]);
    }
  } catch (error) {
    console.error('Error loading sources:', error);
    showToast('Error loading sources', 'error');
  }
}

// Filter and display sources
function filterAndDisplaySources() {
  sourceList.innerHTML = '';
  const filtered = allSources.filter(s =>
    currentFilter === 'screen' ? s.id.startsWith('screen:') : s.id.startsWith('window:')
  );

  filtered.forEach(source => {
    const item = document.createElement('div');
    item.className = `source-item ${selectedSource?.id === source.id ? 'selected' : ''}`;
    item.innerHTML = `
      <img src="${source.thumbnail}" alt="${source.name}">
      <span title="${source.name}">${source.name}</span>
    `;
    item.addEventListener('click', () => selectSource(source));
    sourceList.appendChild(item);
  });
}

// Select source
async function selectSource(source) {
  selectedSource = source;
  filterAndDisplaySources();
  await startPreview();
}

// Start preview
async function startPreview() {
  if (!selectedSource) return;

  try {
    if (mediaStream && !isRecording) {
      mediaStream.getTracks().forEach(track => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: selectedSource.id
        }
      }
    });

    if (!isRecording) {
      preview.srcObject = stream;
      mediaStream = stream;
    }
    setStatus('Ready');
  } catch (error) {
    console.error('Error starting preview:', error);
    setStatus('Preview error');
  }
}

// Get recording stream with high quality settings
async function getRecordingStream() {
  const qualitySetting = videoQuality?.value || 'high';
  const fpsSetting = parseInt(fps?.value) || 30;

  // Resolution based on quality setting
  let maxWidth, maxHeight;
  switch (qualitySetting) {
    case 'high':
      maxWidth = 1920;
      maxHeight = 1080;
      break;
    case 'medium':
      maxWidth = 1280;
      maxHeight = 720;
      break;
    case 'low':
      maxWidth = 854;
      maxHeight = 480;
      break;
    default:
      maxWidth = 1920;
      maxHeight = 1080;
  }

  const constraints = {
    audio: systemAudio.checked ? {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: selectedSource.id
      }
    } : false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: selectedSource.id,
        minWidth: 640,
        minHeight: 480,
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        minFrameRate: fpsSetting,
        maxFrameRate: fpsSetting
      }
    }
  };

  const desktopStream = await navigator.mediaDevices.getUserMedia(constraints);

  if (micAudio.checked) {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      if (systemAudio.checked && desktopStream.getAudioTracks().length > 0) {
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        const desktopSource = audioContext.createMediaStreamSource(desktopStream);
        desktopSource.connect(destination);
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);

        return new MediaStream([
          ...desktopStream.getVideoTracks(),
          ...destination.stream.getAudioTracks()
        ]);
      } else {
        desktopStream.addTrack(micStream.getAudioTracks()[0]);
      }
    } catch (error) {
      console.log('Microphone not available:', error);
    }
  }

  return desktopStream;
}

// Webcam functions
async function startWebcam() {
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 30 }
      },
      audio: false
    });
    webcamPreview.srcObject = webcamStream;

    // Ensure video plays
    webcamPreview.onloadedmetadata = () => {
      webcamPreview.play().catch(e => console.log('Webcam play error:', e));
    };

    webcamOverlay.classList.add('active');
    webcamEnabled = true;
    showToast('Webcam enabled');
  } catch (error) {
    console.error('Error accessing webcam:', error);
    showToast('Could not access webcam', 'error');
    webcamToggle.checked = false;
  }
}

function stopWebcam() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
  webcamPreview.srcObject = null;
  webcamOverlay.classList.remove('active');
  webcamEnabled = false;
}

function setWebcamPosition(position) {
  webcamOverlay.classList.remove('top-left', 'top-right', 'bottom-left', 'bottom-right');
  webcamOverlay.classList.add(position);
  webcamPosButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pos === position);
  });
}

// Get current webcam position
function getWebcamPosition() {
  if (webcamOverlay.classList.contains('top-left')) return 'top-left';
  if (webcamOverlay.classList.contains('top-right')) return 'top-right';
  if (webcamOverlay.classList.contains('bottom-left')) return 'bottom-left';
  return 'bottom-right'; // default
}

// Composite webcam onto screen recording using canvas
let compositeCanvas = null;
let compositeCtx = null;
let compositeIntervalId = null;

// Live zoom during recording
let liveZoomEnabled = false;
let liveZoomLevel = 1;
let liveZoomX = 0.5; // 0-1 position
let liveZoomY = 0.5;
let zoomKeyPressed = false;

function createCompositedStream(screenStream, webcamStream, fps = 30) {
  // Get video track settings
  const videoTrack = screenStream.getVideoTracks()[0];
  const settings = videoTrack.getSettings();
  const width = settings.width || 1920;
  const height = settings.height || 1080;

  // Create canvas for compositing
  compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = width;
  compositeCanvas.height = height;
  compositeCtx = compositeCanvas.getContext('2d', { alpha: false });

  // Create video elements for drawing
  const screenVideo = document.createElement('video');
  screenVideo.srcObject = screenStream;
  screenVideo.muted = true;
  screenVideo.play();

  let webcamVideo = null;
  if (webcamStream) {
    webcamVideo = document.createElement('video');
    webcamVideo.srcObject = webcamStream;
    webcamVideo.muted = true;
    webcamVideo.play();
  }

  // Webcam size (proportional to screen)
  const webcamWidth = Math.round(width * 0.15); // 15% of screen width (smaller = less processing)
  const webcamHeight = Math.round(webcamWidth * 0.75); // 4:3 aspect ratio
  const padding = 20;
  const radius = 8;

  // Pre-calculate positions
  const positions = {
    'top-left': { x: padding, y: padding },
    'top-right': { x: width - webcamWidth - padding, y: padding },
    'bottom-left': { x: padding, y: height - webcamHeight - padding },
    'bottom-right': { x: width - webcamWidth - padding, y: height - webcamHeight - padding }
  };

  // Draw function - optimized
  function drawFrame() {
    if (!compositeCtx) return;

    // Apply live zoom if enabled
    if (liveZoomEnabled && liveZoomLevel > 1) {
      // Calculate zoom area
      const zoomW = width / liveZoomLevel;
      const zoomH = height / liveZoomLevel;

      // Center zoom on mouse position
      let srcX = (liveZoomX * width) - (zoomW / 2);
      let srcY = (liveZoomY * height) - (zoomH / 2);

      // Clamp to bounds
      srcX = Math.max(0, Math.min(srcX, width - zoomW));
      srcY = Math.max(0, Math.min(srcY, height - zoomH));

      // Draw zoomed portion
      compositeCtx.drawImage(screenVideo, srcX, srcY, zoomW, zoomH, 0, 0, width, height);
    } else {
      // Draw screen normally
      compositeCtx.drawImage(screenVideo, 0, 0, width, height);
    }

    // Draw webcam if enabled
    if (webcamEnabled && webcamVideo && webcamStream) {
      const pos = positions[getWebcamPosition()] || positions['bottom-right'];
      const x = pos.x;
      const y = pos.y;

      // Simple rounded clip and draw
      compositeCtx.save();
      compositeCtx.beginPath();
      compositeCtx.roundRect(x, y, webcamWidth, webcamHeight, radius);
      compositeCtx.clip();
      compositeCtx.drawImage(webcamVideo, x, y, webcamWidth, webcamHeight);
      compositeCtx.restore();

      // Simple border
      compositeCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      compositeCtx.lineWidth = 2;
      compositeCtx.beginPath();
      compositeCtx.roundRect(x, y, webcamWidth, webcamHeight, radius);
      compositeCtx.stroke();
    }
  }

  // Use setInterval instead of requestAnimationFrame for consistent frame rate
  // This reduces CPU usage by not trying to render at 60fps
  const frameInterval = Math.round(1000 / fps);

  // Start drawing when videos are ready
  let started = false;
  function startDrawing() {
    if (started) return;
    started = true;
    compositeIntervalId = setInterval(drawFrame, frameInterval);
  }

  screenVideo.onloadedmetadata = () => {
    screenVideo.oncanplay = startDrawing;
    if (screenVideo.readyState >= 3) startDrawing();
  };

  // Get canvas stream
  const canvasStream = compositeCanvas.captureStream(fps);

  // Add audio tracks from screen stream
  screenStream.getAudioTracks().forEach(track => {
    canvasStream.addTrack(track);
  });

  return canvasStream;
}

function stopCompositing() {
  if (compositeIntervalId) {
    clearInterval(compositeIntervalId);
    compositeIntervalId = null;
  }
  compositeCanvas = null;
  compositeCtx = null;
}

// Countdown before recording
function showCountdown() {
  return new Promise((resolve) => {
    const seconds = parseInt(countdownSelect.value);
    if (seconds === 0) {
      resolve();
      return;
    }

    let remaining = seconds;
    countdownNumber.textContent = remaining;
    countdownOverlay.classList.add('active');

    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        countdownOverlay.classList.remove('active');
        resolve();
      } else {
        countdownNumber.textContent = remaining;
      }
    }, 1000);
  });
}

// Start recording
async function startRecording() {
  if (!selectedSource) {
    showToast('Please select a source first', 'error');
    return;
  }

  // Show countdown first
  await showCountdown();

  try {
    let stream = await getRecordingStream();
    const fpsSetting = parseInt(fps?.value) || 30;

    // Always use composited stream for live zoom feature (and webcam if enabled)
    stream = createCompositedStream(stream, webcamEnabled ? webcamStream : null, fpsSetting);

    // Use higher bitrate for better quality
    const qualitySetting = videoQuality?.value || 'high';
    let videoBitsPerSecond;
    switch (qualitySetting) {
      case 'high':
        videoBitsPerSecond = 8000000; // 8 Mbps for 1080p
        break;
      case 'medium':
        videoBitsPerSecond = 4000000; // 4 Mbps for 720p
        break;
      case 'low':
        videoBitsPerSecond = 2000000; // 2 Mbps for 480p
        break;
      default:
        videoBitsPerSecond = 8000000;
    }

    // Use VP8 codec - much less CPU-intensive than VP9, reduces lag
    let mimeType = 'video/webm; codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm'; // Fallback
    }

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: videoBitsPerSecond
    });
    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      if (isGifMode) {
        await saveGif();
      } else {
        await saveRecording();
      }
    };

    mediaRecorder.start(1000);
    isRecording = true;
    isPaused = false;
    recordingStartTime = Date.now();
    pausedTime = 0;

    // Update UI
    quickActions.style.display = 'none';
    recordingControls.classList.add('active');
    previewBadge.textContent = isGifMode ? 'GIF' : 'REC';
    previewBadge.classList.add('live');
    recordBtn.classList.add('recording');

    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();

    // Show timer overlay if enabled
    if (showTimerOverlay?.checked) {
      window.electronAPI.createTimerOverlay?.();
    }

    window.electronAPI.setRecordingStatus(true);
    setStatus(isGifMode ? 'Recording GIF...' : 'Recording...', true);
    showToast(isGifMode ? 'GIF recording started' : 'Recording started');
  } catch (error) {
    console.error('Error starting recording:', error);
    showToast('Error starting recording', 'error');
  }
}

// Stop recording
function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    isPaused = false;

    // Reset live zoom
    liveZoomEnabled = false;
    liveZoomLevel = 1;
    zoomKeyPressed = false;

    // Stop webcam compositing if active
    stopCompositing();

    // Close timer overlay
    window.electronAPI.closeTimerOverlay?.();

    mediaRecorder.stream.getTracks().forEach(track => track.stop());

    // Update UI
    quickActions.style.display = 'grid';
    recordingControls.classList.remove('active');
    previewBadge.textContent = 'Ready';
    previewBadge.classList.remove('live');
    recordBtn.classList.remove('recording');
    pauseBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;

    clearInterval(timerInterval);
    recTime.textContent = '00:00:00';

    window.electronAPI.setRecordingStatus(false);
    setStatus('Ready');
    isGifMode = false;
    startPreview();
  }
}

// Pause/Resume recording
function togglePause() {
  if (!mediaRecorder || !isRecording) return;

  if (isPaused) {
    mediaRecorder.resume();
    isPaused = false;
    pauseBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;
    recordingStartTime = Date.now() - pausedTime;
    timerInterval = setInterval(updateTimer, 1000);
    setStatus('Recording...', true);
  } else {
    mediaRecorder.pause();
    isPaused = true;
    pauseBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume`;
    pausedTime = Date.now() - recordingStartTime;
    clearInterval(timerInterval);
    setStatus('Paused', true);
  }
}

// Update timer
function updateTimer() {
  const elapsed = Date.now() - recordingStartTime;
  const seconds = Math.floor(elapsed / 1000) % 60;
  const minutes = Math.floor(elapsed / 60000) % 60;
  const hours = Math.floor(elapsed / 3600000);
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  recTime.textContent = timeStr;

  // Update timer overlay
  window.electronAPI.updateTimer?.({ time: timeStr, paused: isPaused });
}

// Save recording
async function saveRecording() {
  try {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const buffer = await blob.arrayBuffer();
    const filePath = await window.electronAPI.saveFile({
      buffer: Array.from(new Uint8Array(buffer)),
      type: 'recording'
    });
    addToRecentCaptures(filePath, 'video');
    showToast('Recording saved!');
    setStatus('Saved: ' + filePath.split('\\').pop());
  } catch (error) {
    console.error('Error saving recording:', error);
    showToast('Error saving recording', 'error');
  }
}

// Save GIF
async function saveGif() {
  try {
    setStatus('Converting to GIF...');
    showToast('Converting to GIF (this may take a moment)...');

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const buffer = await blob.arrayBuffer();
    const filePath = await window.electronAPI.saveFile({
      buffer: Array.from(new Uint8Array(buffer)),
      type: 'gif'
    });
    addToRecentCaptures(filePath, 'gif');
    showToast('GIF saved!');
    setStatus('Saved: ' + filePath.split('\\').pop());
  } catch (error) {
    console.error('Error saving GIF:', error);
    showToast('Error saving GIF', 'error');
  }
}

// Take screenshot
async function takeScreenshot() {
  try {
    setStatus('Capturing...');

    const source = selectedSource || (await window.electronAPI.getSources())[0];

    // Get highest quality stream for screenshot
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
          minWidth: 1920,
          minHeight: 1080,
          maxWidth: 3840,
          maxHeight: 2160
        }
      }
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    await new Promise(resolve => setTimeout(resolve, 100));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    stream.getTracks().forEach(track => track.stop());

    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const filePath = await window.electronAPI.saveFile({
      buffer: Array.from(buffer),
      type: 'screenshot'
    });

    lastScreenshotPath = filePath;
    screenshotImg.src = dataUrl;
    screenshotResult.classList.add('active');

    addToRecentCaptures(filePath, 'image', dataUrl);
    showToast('Screenshot saved!');
    setStatus('Saved: ' + filePath.split('\\').pop());
  } catch (error) {
    console.error('Error taking screenshot:', error);
    showToast('Error taking screenshot', 'error');
    setStatus('Screenshot error');
  }
}

// Recent captures management
function addToRecentCaptures(filePath, type, thumbnail = null) {
  const capture = {
    path: filePath,
    type: type,
    thumbnail: thumbnail,
    name: filePath.split('\\').pop(),
    date: new Date().toLocaleString()
  };

  recentFiles.unshift(capture);
  if (recentFiles.length > 20) recentFiles.pop();

  renderRecentCaptures();
}

async function loadRecentCaptures() {
  // Load from localStorage
  try {
    const saved = localStorage.getItem('recentCaptures');
    if (saved) {
      recentFiles = JSON.parse(saved);
      renderRecentCaptures();
    }
  } catch (e) {
    // No recent captures found
  }
}

function renderRecentCaptures() {
  if (!recentCaptures) return;

  // Save to localStorage
  try {
    localStorage.setItem('recentCaptures', JSON.stringify(recentFiles));
  } catch {
    // Could not save recent captures
  }

  if (recentFiles.length === 0) {
    recentCaptures.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <p>No recent captures<br>Start recording or take a screenshot</p>
      </div>
    `;
    return;
  }

  recentCaptures.innerHTML = recentFiles.map(file => `
    <div class="capture-item" data-path="${file.path}">
      <div class="capture-thumb">
        ${file.type === 'image' && file.thumbnail
          ? `<img src="${file.thumbnail}" alt="${file.name}">`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${file.type === 'video'
                ? '<polygon points="5 3 19 12 5 21 5 3"/>'
                : '<rect x="2" y="2" width="20" height="20" rx="2"/><text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor" stroke="none">GIF</text>'}
            </svg>`
        }
      </div>
      <div class="capture-info">
        <span class="capture-name" title="${file.name}">${file.name}</span>
        <span class="capture-date">${file.date}</span>
      </div>
    </div>
  `).join('');

  // Add click handlers
  recentCaptures.querySelectorAll('.capture-item').forEach(item => {
    item.addEventListener('click', () => {
      const path = item.dataset.path;
      showToast('Opening file...');
    });
  });
}

// Load settings
async function loadSettings() {
  try {
    const settings = await window.electronAPI.getSettings();
    savePath.value = settings.savePath || '';
    videoQuality.value = settings.videoQuality || 'high';
    fps.value = settings.fps || 30;
    if (gifFps) gifFps.value = settings.gifFps || 10;
    systemAudio.checked = settings.recordAudio !== false;
    micAudio.checked = settings.recordMic !== false;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings
async function saveSettings() {
  try {
    await window.electronAPI.saveSettings({
      savePath: savePath.value,
      videoQuality: videoQuality.value,
      fps: parseInt(fps.value),
      gifFps: gifFps ? parseInt(gifFps.value) : 10,
      recordAudio: systemAudio.checked,
      recordMic: micAudio.checked
    });
    settingsModal.classList.remove('active');
    showToast('Settings saved');
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Error saving settings', 'error');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Source tabs
  sourceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sourceTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.type;
      filterAndDisplaySources();
    });
  });

  // Panel tabs (Preview/Recent)
  panelTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      panelTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tabName}-tab`)?.classList.add('active');
    });
  });

  // Quick actions
  recordBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      isGifMode = false;
      startRecording();
    }
  });

  screenshotBtn.addEventListener('click', takeScreenshot);

  // Snip button
  snipBtn?.addEventListener('click', () => {
    window.electronAPI.openSnippingTool?.();
  });

  // GIF button
  gifBtn?.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      isGifMode = true;
      startRecording();
    }
  });

  // Webcam toggle
  webcamToggle?.addEventListener('change', () => {
    if (webcamToggle.checked) {
      startWebcam();
    } else {
      stopWebcam();
    }
  });

  // Webcam position buttons
  webcamPosButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setWebcamPosition(btn.dataset.pos);
    });
  });

  folderBtn.addEventListener('click', async () => {
    await window.electronAPI.openFolder?.();
  });

  // Annotation button
  annotationBtn?.addEventListener('click', () => {
    window.electronAPI.openAnnotation?.();
    showToast('Draw on screen enabled - Press ESC to close');
  });

  // Recording controls
  stopBtn.addEventListener('click', stopRecording);
  pauseBtn.addEventListener('click', togglePause);

  // Refresh sources
  refreshSources.addEventListener('click', loadSources);

  // Settings
  settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
  closeModal.addEventListener('click', () => settingsModal.classList.remove('active'));
  cancelSettings.addEventListener('click', () => settingsModal.classList.remove('active'));
  saveSettingsBtn.addEventListener('click', saveSettings);

  browsePath.addEventListener('click', async () => {
    const path = await window.electronAPI.selectSavePath();
    if (path) savePath.value = path;
  });

  // Modal outside click
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
  });

  // Screenshot result - copy to clipboard
  document.getElementById('copyScreenshot')?.addEventListener('click', async () => {
    if (screenshotImg.src) {
      try {
        // Convert data URL to base64 and copy via IPC
        await window.electronAPI.copyToClipboard(screenshotImg.src);
        showToast('Copied to clipboard');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        showToast('Failed to copy', 'error');
      }
    }
  });

  document.getElementById('closeResult')?.addEventListener('click', () => {
    screenshotResult.classList.remove('active');
  });

  document.getElementById('openFolder')?.addEventListener('click', async () => {
    await window.electronAPI.openFolder?.();
    screenshotResult.classList.remove('active');
  });

  // Window controls
  minimizeBtn?.addEventListener('click', () => {
    window.electronAPI?.minimize?.();
  });

  closeBtn?.addEventListener('click', () => {
    window.electronAPI?.close?.();
  });
}

// IPC listeners
function setupIPCListeners() {
  window.electronAPI.onTakeScreenshot(() => takeScreenshot());

  window.electronAPI.onToggleRecording(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  window.electronAPI.onStopRecording?.(() => {
    if (isRecording) {
      stopRecording();
    }
  });

  window.electronAPI.onAreaSelect(() => takeScreenshot());

  // Snipping tool notifications
  window.electronAPI.onSnipSaved?.((filePath) => {
    const fileName = filePath.split('\\').pop();
    showToast(`Snip saved: ${fileName}`);
    addToRecentCaptures(filePath, 'image');
  });

  window.electronAPI.onSnipCopied?.(() => {
    showToast('Snip copied to clipboard!');
  });

  // Video conversion status
  window.electronAPI.onConversionStatus?.((status) => {
    if (status === 'done') {
      setStatus('Conversion complete');
    } else if (status === 'failed') {
      showToast('Video conversion failed, saved as WebM', 'error');
    } else {
      setStatus(status);
    }
  });
}

// ============== NEW FEATURES ==============

// Auto-stop timer
function setupAutoStop() {
  if (autoStopTimeout) {
    clearTimeout(autoStopTimeout);
    autoStopTimeout = null;
  }

  const minutes = parseInt(autoStopSelect?.value || 0);
  if (minutes > 0 && isRecording) {
    autoStopTimeout = setTimeout(() => {
      if (isRecording) {
        showToast(`Auto-stopping after ${minutes} minute(s)`);
        stopRecording();
      }
    }, minutes * 60 * 1000);
  }
}

// Audio Level Meters
function setupAudioLevelMeters(stream) {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    // System audio meter
    const systemTracks = stream.getAudioTracks().filter(t => t.label.includes('System') || !t.label.includes('Microphone'));
    if (systemTracks.length > 0) {
      const systemSource = audioContext.createMediaStreamSource(new MediaStream([systemTracks[0]]));
      audioAnalyserSystem = audioContext.createAnalyser();
      audioAnalyserSystem.fftSize = 256;
      systemSource.connect(audioAnalyserSystem);
    }

    updateAudioLevels();
  } catch (e) {
    console.log('Audio level meters not available:', e);
  }
}

function updateAudioLevels() {
  if (!isRecording) return;

  if (audioAnalyserSystem && systemLevelEl) {
    const dataArray = new Uint8Array(audioAnalyserSystem.frequencyBinCount);
    audioAnalyserSystem.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const level = Math.min(100, (average / 128) * 100);
    systemLevelEl.style.width = level + '%';
  }

  if (audioAnalyserMic && micLevelEl) {
    const dataArray = new Uint8Array(audioAnalyserMic.frequencyBinCount);
    audioAnalyserMic.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const level = Math.min(100, (average / 128) * 100);
    micLevelEl.style.width = level + '%';
  }

  requestAnimationFrame(updateAudioLevels);
}

// Setup microphone level meter
async function setupMicLevelMeter() {
  try {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    const micSource = audioContext.createMediaStreamSource(micStream);
    audioAnalyserMic = audioContext.createAnalyser();
    audioAnalyserMic.fftSize = 256;
    micSource.connect(audioAnalyserMic);
  } catch (e) {
    console.log('Mic level meter not available:', e);
  }
}

// Audio-only recording
async function startAudioRecording() {
  try {
    await showCountdown();

    const constraints = { audio: true, video: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    recordedChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      await saveAudioRecording();
    };

    mediaRecorder.start(1000);
    isRecording = true;
    isAudioOnlyMode = true;
    recordingStartTime = Date.now();

    quickActions.style.display = 'none';
    recordingControls.classList.add('active');
    previewBadge.textContent = 'AUDIO';
    previewBadge.classList.add('live');

    timerInterval = setInterval(updateTimer, 1000);
    window.electronAPI.setRecordingStatus(true);
    setStatus('Recording audio...', true);
    showToast('Audio recording started');

    setupAutoStop();
  } catch (error) {
    console.error('Error starting audio recording:', error);
    showToast('Error starting audio recording', 'error');
  }
}

async function saveAudioRecording() {
  try {
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    const buffer = await blob.arrayBuffer();
    const filePath = await window.electronAPI.saveFile({
      buffer: Array.from(new Uint8Array(buffer)),
      type: 'audio'
    });
    addToRecentCaptures(filePath, 'audio');
    showToast('Audio recording saved!');
    setStatus('Saved: ' + filePath.split('\\').pop());
  } catch (error) {
    console.error('Error saving audio:', error);
    showToast('Error saving audio', 'error');
  }
  isAudioOnlyMode = false;
}

// Color Picker - captures actual screen colors
async function startColorPicker() {
  try {
    // Get screen sources to capture the screen
    const sources = await window.electronAPI.getSources();
    const screenSource = sources.find(s => s.id.startsWith('screen:')) || sources[0];

    if (!screenSource) {
      showToast('Could not access screen', 'error');
      return;
    }

    // Get screen stream
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screenSource.id
        }
      }
    });

    // Create video element to capture frame
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();

    // Wait a frame for video to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create canvas and capture frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Stop the stream
    stream.getTracks().forEach(track => track.stop());

    // Create overlay with captured screenshot
    const overlay = document.createElement('div');
    overlay.className = 'color-picker-overlay active';
    overlay.innerHTML = `
      <img id="colorPickerBg" src="${canvas.toDataURL()}" style="position:fixed;top:0;left:0;width:100vw;height:100vh;object-fit:cover;pointer-events:none;">
      <div class="color-info">
        <div class="color-preview" id="colorPreview"></div>
        <div class="color-values">
          <div id="hexValue">HEX: #000000</div>
          <div id="rgbValue">RGB: 0, 0, 0</div>
        </div>
      </div>
      <div class="color-magnifier" id="colorMagnifier"></div>
    `;
    document.body.appendChild(overlay);

    const colorPreview = document.getElementById('colorPreview');
    const hexValue = document.getElementById('hexValue');
    const rgbValue = document.getElementById('rgbValue');
    const magnifier = document.getElementById('colorMagnifier');

    let currentHex = '#000000';
    let currentRgb = { r: 0, g: 0, b: 0 };

    overlay.addEventListener('mousemove', (e) => {
      // Calculate position on the captured image
      const scaleX = canvas.width / window.innerWidth;
      const scaleY = canvas.height / window.innerHeight;
      const x = Math.floor(e.clientX * scaleX);
      const y = Math.floor(e.clientY * scaleY);

      // Get pixel color
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];

      currentRgb = { r, g, b };
      currentHex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

      colorPreview.style.background = currentHex;
      hexValue.textContent = `HEX: ${currentHex.toUpperCase()}`;
      rgbValue.textContent = `RGB: ${r}, ${g}, ${b}`;

      // Position magnifier near cursor
      magnifier.style.left = (e.clientX + 20) + 'px';
      magnifier.style.top = (e.clientY + 20) + 'px';
      magnifier.style.background = currentHex;
      magnifier.style.display = 'block';
    });

    overlay.addEventListener('click', (e) => {
      navigator.clipboard.writeText(currentHex.toUpperCase());
      showToast(`Color copied: ${currentHex.toUpperCase()}`);
      overlay.remove();
    });

    overlay.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      overlay.remove();
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

  } catch (error) {
    console.error('Color picker error:', error);
    showToast('Could not start color picker', 'error');
  }
}

// Cursor Highlight, Click Effects, Keyboard Overlay - using transparent overlay window
let cursorHighlightEnabled = false;
let effectsOverlayActive = false;

// Initialize global mouse/keyboard tracking for effects overlay
function initEffectsTracking() {
  // Mouse tracking would require native hooks for global tracking
  // The effects overlay handles this when recording starts
}

// Start effects overlay when recording
async function startEffectsOverlay() {
  if (!cursorHighlightEnabled && !clickEffectsEnabled && !keyboardOverlayEnabled) {
    return;
  }

  try {
    await window.electronAPI.createEffectsOverlay();
    effectsOverlayActive = true;

    // Send initial settings
    window.electronAPI.sendEffectsEvent({
      type: 'settings',
      cursorHighlight: cursorHighlightEnabled,
      clickEffects: clickEffectsEnabled,
      keyboardOverlay: keyboardOverlayEnabled
    });

    // Set up global keyboard tracking
    setupGlobalKeyboardTracking();

    showToast('Effects overlay enabled');
  } catch (e) {
    console.error('Failed to create effects overlay:', e);
  }
}

// Stop effects overlay
async function stopEffectsOverlay() {
  if (effectsOverlayActive) {
    window.electronAPI.sendEffectsEvent({ type: 'stop' });
    await window.electronAPI.closeEffectsOverlay();
    effectsOverlayActive = false;
  }
}

// Track keyboard globally
function setupGlobalKeyboardTracking() {
  // Note: This only works when app window is focused
  // For global tracking, we'd need native keyboard hooks
}

function getKeyName(e) {
  const special = {
    'Control': 'Ctrl',
    'Meta': 'Win',
    ' ': 'Space',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Escape': 'Esc',
    'Backspace': '⌫',
    'Enter': '↵',
    'Tab': '⇥',
    'Shift': 'Shift',
    'Alt': 'Alt',
    'Delete': 'Del',
    'Home': 'Home',
    'End': 'End',
    'PageUp': 'PgUp',
    'PageDown': 'PgDn'
  };
  return special[e.key] || e.key.toUpperCase();
}

// Global key event listeners for the overlay
document.addEventListener('keydown', (e) => {
  if (!effectsOverlayActive || !keyboardOverlayEnabled || !isRecording) return;

  const key = getKeyName(e);
  window.electronAPI.sendEffectsEvent({
    type: 'keydown',
    key: key
  });
});

document.addEventListener('keyup', (e) => {
  if (!effectsOverlayActive || !keyboardOverlayEnabled || !isRecording) return;

  const key = getKeyName(e);
  window.electronAPI.sendEffectsEvent({
    type: 'keyup',
    key: key
  });
});

// Placeholder functions for compatibility
function initClickEffects() {}
function initKeyboardOverlay() {}

// Scheduled Recording
function scheduleRecording() {
  const timeValue = scheduleTime?.value;
  if (!timeValue) {
    showToast('Please select a time', 'error');
    return;
  }

  const [hours, minutes] = timeValue.split(':').map(Number);
  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(hours, minutes, 0, 0);

  // If time is in the past, schedule for tomorrow
  if (scheduled <= now) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  const delay = scheduled - now;

  if (scheduledRecordingTimeout) {
    clearTimeout(scheduledRecordingTimeout);
  }

  scheduledRecordingTimeout = setTimeout(() => {
    showToast('Starting scheduled recording...');
    startRecording();
    scheduleStatus.textContent = '';
    scheduleBtn.textContent = 'Schedule';
    scheduleBtn.classList.remove('active');
  }, delay);

  const timeStr = scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  scheduleStatus.textContent = `Recording scheduled for ${timeStr}`;
  scheduleBtn.textContent = 'Cancel';
  scheduleBtn.classList.add('active');
  showToast(`Recording scheduled for ${timeStr}`);
}

function cancelScheduledRecording() {
  if (scheduledRecordingTimeout) {
    clearTimeout(scheduledRecordingTimeout);
    scheduledRecordingTimeout = null;
  }
  scheduleStatus.textContent = '';
  scheduleBtn.textContent = 'Schedule';
  scheduleBtn.classList.remove('active');
  showToast('Scheduled recording cancelled');
}

// Recording Profiles
const recordingProfiles = {
  gaming: {
    name: 'Gaming',
    videoQuality: 'high',
    fps: 60,
    systemAudio: true,
    micAudio: false,
    webcam: false
  },
  tutorial: {
    name: 'Tutorial',
    videoQuality: 'high',
    fps: 30,
    systemAudio: true,
    micAudio: true,
    webcam: false
  },
  meeting: {
    name: 'Meeting',
    videoQuality: 'medium',
    fps: 30,
    systemAudio: false,
    micAudio: true,
    webcam: true
  },
  quick: {
    name: 'Quick',
    videoQuality: 'medium',
    fps: 30,
    systemAudio: false,
    micAudio: false,
    webcam: false
  }
};

function applyProfile(profileName) {
  const profile = recordingProfiles[profileName];
  if (!profile) return;

  // Apply settings
  if (videoQuality) videoQuality.value = profile.videoQuality;
  if (fps) fps.value = profile.fps.toString();
  if (systemAudio) systemAudio.checked = profile.systemAudio;
  if (micAudio) micAudio.checked = profile.micAudio;

  // Handle webcam
  if (webcamToggle) {
    if (profile.webcam && !webcamEnabled) {
      webcamToggle.checked = true;
      startWebcam();
    } else if (!profile.webcam && webcamEnabled) {
      webcamToggle.checked = false;
      stopWebcam();
    }
  }

  // Update profile button states
  document.querySelectorAll('.profile-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.profile === profileName);
  });

  showToast(`${profile.name} profile applied`);
}

function initProfileButtons() {
  document.querySelectorAll('.profile-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const profileName = btn.dataset.profile;
      if (profileName) {
        applyProfile(profileName);
      }
    });
  });
}

// Initialize new features
function initNewFeatures() {
  // Initialize profile buttons
  initProfileButtons();

  // Audio button
  audioBtn?.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startAudioRecording();
    }
  });

  // Color picker button
  colorPickerBtn?.addEventListener('click', startColorPicker);

  // Zoom button
  const zoomBtn = document.getElementById('zoomBtn');
  zoomBtn?.addEventListener('click', () => {
    window.electronAPI.openZoom?.();
    showToast('Zoom tool enabled - Click to zoom, ESC to close');
  });

  // Cursor highlight toggle
  const cursorHighlightEl = document.getElementById('cursorHighlight');
  cursorHighlightEl?.addEventListener('change', () => {
    cursorHighlightEnabled = cursorHighlightEl.checked;
  });

  // Click effects toggle
  clickEffects?.addEventListener('change', () => {
    clickEffectsEnabled = clickEffects.checked;
  });

  // Keyboard overlay toggle
  keyboardOverlay?.addEventListener('change', () => {
    keyboardOverlayEnabled = keyboardOverlay.checked;
  });

  // Schedule button
  scheduleBtn?.addEventListener('click', () => {
    if (scheduledRecordingTimeout) {
      cancelScheduledRecording();
    } else {
      scheduleRecording();
    }
  });

  // Auto-stop change
  autoStopSelect?.addEventListener('change', () => {
    if (isRecording) {
      setupAutoStop();
    }
  });

  // Initialize effects tracking
  initEffectsTracking();
  initClickEffects();
  initKeyboardOverlay();

  // Setup mic level meter on load
  if (micAudio?.checked) {
    setupMicLevelMeter();
  }

  micAudio?.addEventListener('change', () => {
    if (micAudio.checked) {
      setupMicLevelMeter();
    }
  });
}

// Modify original startRecording to include new features
const originalStartRecording = startRecording;
startRecording = async function() {
  await originalStartRecording.call(this);
  if (isRecording) {
    setupAutoStop();
    if (mediaRecorder?.stream) {
      setupAudioLevelMeters(mediaRecorder.stream);
    }
    // Start effects overlay for cursor highlight, click effects, keyboard overlay
    if (cursorHighlightEnabled || clickEffectsEnabled || keyboardOverlayEnabled) {
      await startEffectsOverlay();
    }
  }
};

// Modify original stopRecording to stop effects overlay
const originalStopRecording = stopRecording;
stopRecording = function() {
  // Stop effects overlay first
  stopEffectsOverlay();
  originalStopRecording.call(this);
};

// Live Zoom Controls - Hold Z + Scroll to zoom during recording
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'z' && !e.repeat) {
    zoomKeyPressed = true;
    if (isRecording) {
      document.body.style.cursor = 'zoom-in';
    }
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === 'z') {
    zoomKeyPressed = false;
    document.body.style.cursor = '';
    // Smoothly reset zoom when Z is released
    if (liveZoomLevel > 1) {
      liveZoomEnabled = false;
      liveZoomLevel = 1;
      showToast('Zoom reset');
    }
  }
});

// Mouse wheel for zoom level
document.addEventListener('wheel', (e) => {
  if (!zoomKeyPressed || !isRecording) return;

  e.preventDefault();

  // Update mouse position for zoom center
  liveZoomX = e.clientX / window.innerWidth;
  liveZoomY = e.clientY / window.innerHeight;

  // Adjust zoom level with scroll
  if (e.deltaY < 0) {
    // Scroll up = zoom in
    liveZoomLevel = Math.min(5, liveZoomLevel + 0.25);
  } else {
    // Scroll down = zoom out
    liveZoomLevel = Math.max(1, liveZoomLevel - 0.25);
  }

  liveZoomEnabled = liveZoomLevel > 1;

  if (liveZoomEnabled) {
    showToast(`Zoom: ${liveZoomLevel.toFixed(1)}x`);
  }
}, { passive: false });

// Track mouse position for zoom center
document.addEventListener('mousemove', (e) => {
  if (zoomKeyPressed && isRecording && liveZoomEnabled) {
    liveZoomX = e.clientX / window.innerWidth;
    liveZoomY = e.clientY / window.innerHeight;
  }
});

// Initialize
initNewFeatures();
init();
