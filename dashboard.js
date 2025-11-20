// dashboard.js - UI + lightweight zone drawing + per-feed localStorage
// Includes modal fix + dark/light theme toggle (persistent)

// Global state for processed video
let processedVideoUrl = null; // Store processed video URL for Analysis tab

// ---------------- TOKEN MANAGEMENT ----------------
function parseTokenExpiry(expiresIn) {
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn);
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token available');

  const res = await fetch(`${NODE_API}/api/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  if (!res.ok) throw new Error('Failed to refresh token');
  const data = await res.json();
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('tokenExpiry', new Date(Date.now() + parseTokenExpiry(data.expiresIn)).getTime());
  return data.accessToken;
}

async function fetchWithToken(url, options = {}) {
  const tokenExpiry = localStorage.getItem('tokenExpiry');
  let accessToken = localStorage.getItem('accessToken');
  if (!accessToken) { window.location.href = 'login.html'; return; }

  if (tokenExpiry && Date.now() > (parseInt(tokenExpiry) - 30000)) {
    try { accessToken = await refreshAccessToken(); }
    catch { window.location.href = 'login.html'; return; }
  }

  const headers = { ...options.headers, 'Authorization': `Bearer ${accessToken}` };
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    try {
      accessToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${accessToken}`;
      return fetch(url, { ...options, headers });
    } catch {
      window.location.href = 'login.html'; return;
    }
  }
  return response;
}

async function verifyAuth() {
  try {
    const tokens = {
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken'),
      tokenExpiry: localStorage.getItem('tokenExpiry')
    };
    
    console.log('🔐 Verifying authentication...', {
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
      tokenExpiry: tokens.tokenExpiry ? new Date(parseInt(tokens.tokenExpiry)).toISOString() : 'none'
    });
    
    if (!tokens.accessToken || !tokens.refreshToken) {
      console.log('❌ No tokens found - redirecting to login');
      return false;
    }

    const response = await fetchWithToken(`${NODE_API}/api/me`);
    if (!response) {
      console.log('❌ No response from /api/me - redirecting to login');
      return false;
    }
    
    const data = await response.json();
    console.log('✅ Auth response:', data);
    
    if (data.error) {
      console.log('❌ Auth error:', data.error);
      throw new Error(data.error);
    }

    const userName = data.user?.name || data.user?.username || 'User';
    document.getElementById('userName').textContent = userName;
    console.log('✅ Authentication successful for:', userName);
    return true;
  } catch (err) {
    console.error('❌ Auth verification failed:', err);
    return false;
  }
}

// logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (refreshToken) {
    await fetch(`${NODE_API}/api/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    }).catch(() => {});
  }
  localStorage.clear();
  window.location.href = 'login.html';
});

// ---------------- THEME (dark/light) ----------------
function applyTheme(theme) {
  if (theme === 'dark') document.body.classList.add('dark');
  else document.body.classList.remove('dark');

  const icon = document.getElementById('themeIcon');
  if (!icon) return;
  icon.classList.remove('fa-sun','fa-moon');
  icon.classList.add(theme === 'dark' ? 'fa-sun' : 'fa-moon'); // show sun in dark (to switch to light)
}

function initThemeToggle() {
  const saved = localStorage.getItem('cc_theme') || 'light';
  applyTheme(saved);

  const btn = document.getElementById('themeToggle');
  btn.addEventListener('click', () => {
    const current = document.body.classList.contains('dark') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('cc_theme', next);
  });
}

// ---------------- MAIN DASHBOARD ----------------
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📄 Dashboard page loaded - checking authentication...');
  
  // initialize theme toggle early (so UI doesn't flash)
  initThemeToggle();

  const isAuthenticated = await verifyAuth();
  if (!isAuthenticated) { 
    console.log('❌ Not authenticated - redirecting to login');
    window.location.href = '/login.html'; 
    return; 
  }
  
  console.log('✅ Dashboard initialized successfully');

  // elements
  const feedListEl = document.getElementById('feedList');
  const addFeedBtn = document.getElementById('addFeedBtn');
  const addFeedModal = document.getElementById('addFeedModal');
  const modalSave = document.getElementById('modalSave');
  const modalCancel = document.getElementById('modalCancel');
  const modalFeedName = document.getElementById('modalFeedName');
  const modalFeedType = document.getElementById('modalFeedType');

  const currentFeedName = document.getElementById('currentFeedName');
  const feedTitleInline = document.getElementById('feedTitleInline');

  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const uploadBtn = document.getElementById('uploadBtn');
  const previewPlaceholder = document.getElementById('previewPlaceholder');
  const mediaWrap = document.getElementById('mediaWrap');
  const imagePreview = document.getElementById('imagePreview');
  const videoPreview = document.getElementById('videoPreview');
  const zoneCanvas = document.getElementById('zoneCanvas');
  const zoneLabelInput = document.getElementById('zoneLabelInput');
  const startDrawBtn = document.getElementById('startDrawBtn');
  const saveZonesBtn = document.getElementById('saveZonesBtn');
  const clearZonesBtn = document.getElementById('clearZonesBtn');
  const zonesListEl = document.getElementById('zonesList');

  // state
  let feeds = JSON.parse(localStorage.getItem('feeds') || '[]');
  let selectedFeedId = feeds.length ? feeds[0].id : null;
  let zones = [];
  let drawing = false, drawMode = false;
  const ctx = zoneCanvas.getContext('2d');

  // helpers
  const saveFeeds = () => localStorage.setItem('feeds', JSON.stringify(feeds));
  const uid = () => 'f' + Math.random().toString(36).slice(2, 9);

  function renderFeeds() {
    feedListEl.innerHTML = '';
    feeds.forEach(f => {
      const li = document.createElement('li');
      li.className = 'feed-item' + (f.id === selectedFeedId ? ' active' : '');
      li.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-video"></i>
        <div>
          <div style="font-weight:700">${f.name}</div>
          <div style="font-size:12px;opacity:0.8">${f.type}</div>
        </div>
      </div>
      <div><button class="icon-btn" data-id="${f.id}" title="Delete feed">
        <i class="fa-solid fa-trash-can"></i></button></div>`;
      li.addEventListener('click', () => selectFeed(f.id));
      li.querySelector('.icon-btn').addEventListener('click', e => { e.stopPropagation(); deleteFeed(f.id); });
      feedListEl.appendChild(li);
    });
  }

  function addFeed(name, type) {
    const f = { id: uid(), name, type };
    feeds.unshift(f); saveFeeds(); renderFeeds(); selectFeed(f.id);
  }

  function deleteFeed(id) {
    feeds = feeds.filter(f => f.id !== id);
    saveFeeds(); selectedFeedId = feeds[0]?.id || null;
    renderFeeds(); loadSelectedFeed();
  }

  function selectFeed(id) {
    selectedFeedId = id;
    renderFeeds(); loadSelectedFeed();
  }

  function loadSelectedFeed() {
    const f = feeds.find(x => x.id === selectedFeedId);
    currentFeedName.textContent = f?.name || 'No Feed Selected';
    feedTitleInline.textContent = f?.name || '—';
    zones = JSON.parse(localStorage.getItem('zones_' + (f?.id || 'none')) || '[]');
    redrawZones();
    renderZonesList();
    // clear preview on feed change (safer)
    previewPlaceholder.style.display = 'flex';
    mediaWrap.hidden = true;
    imagePreview.style.display = 'none';
    videoPreview.style.display = 'none';
  }

  // ---------------- DRAWING ----------------
  function redrawZones(highlightIndex = -1) {
    ctx.clearRect(0, 0, zoneCanvas.width, zoneCanvas.height);
    ctx.lineWidth = 2;
    zones.forEach((z, i) => {
      ctx.strokeStyle = i === highlightIndex ? '#ff7a59' : '#31c48d';
      ctx.fillStyle = (i === highlightIndex) ? 'rgba(255,122,89,0.12)' : 'rgba(49,196,141,0.08)';
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.fillStyle = '#0b1220';
      ctx.font = '14px Poppins';
      ctx.fillText(z.label, z.x + 6, z.y + 18);
    });
  }

  let startX = 0, startY = 0;
  zoneCanvas.addEventListener('mousedown', e => {
    if (!drawMode) return;
    drawing = true;
    const rect = zoneCanvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
  });

  zoneCanvas.addEventListener('mousemove', e => {
    if (!drawing) return;
    const rect = zoneCanvas.getBoundingClientRect();
    const w = e.clientX - rect.left - startX;
    const h = e.clientY - rect.top - startY;
    redrawZones();
    ctx.strokeStyle = '#ffb020';
    ctx.strokeRect(startX, startY, w, h);
  });

  zoneCanvas.addEventListener('mouseup', e => {
    if (!drawing) return;
    drawing = false;
    const rect = zoneCanvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    const w = endX - startX, h = endY - startY;
    const label = zoneLabelInput.value.trim() || 'Zone ' + (zones.length + 1);
    zones.push({ x: Math.round(startX), y: Math.round(startY), w: Math.round(w), h: Math.round(h), label });
    redrawZones();
    drawMode = false;
    startDrawBtn.classList.remove('active');
    startDrawBtn.textContent = 'Start Drawing';
    renderZonesList();
  });

  startDrawBtn.addEventListener('click', () => {
  drawMode = !drawMode;
  startDrawBtn.classList.toggle('active');
  startDrawBtn.textContent = drawMode ? 'Drawing: Click & Drag' : 'Start Drawing';

  // ✅ Enable or disable drawing interaction on canvas
  zoneCanvas.style.pointerEvents = drawMode ? 'auto' : 'none';
});


  saveZonesBtn.addEventListener('click', () => {
    if (!selectedFeedId) return alert('Select a feed first');
    localStorage.setItem('zones_' + selectedFeedId, JSON.stringify(zones));
    alert('✅ Zones saved!');
    renderZonesList();
  });

  clearZonesBtn.addEventListener('click', () => {
    if (!confirm('Clear all zones?')) return;
    zones = []; redrawZones(); renderZonesList();
    alert('Zones cleared.');
  });

  // render zone list
  function renderZonesList() {
    zonesListEl.innerHTML = '';
    zones.forEach((z, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<div style="font-weight:600">${z.label}</div>`;
      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.gap = '8px';
      const viewBtn = document.createElement('button');
      viewBtn.className = 'icon-btn';
      viewBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
      viewBtn.addEventListener('click', (ev) => { ev.stopPropagation(); redrawZones(i); setTimeout(()=>redrawZones(),1500); });
      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn';
      delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
      delBtn.addEventListener('click', (ev) => { ev.stopPropagation(); zones.splice(i,1); redrawZones(); renderZonesList(); });
      controls.appendChild(viewBtn); controls.appendChild(delBtn);
      li.appendChild(controls);
      li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center';
      zonesListEl.appendChild(li);
    });
  }

  // ---------------- SERVER CONNECTION CHECK ---------------- 
  async function checkServerConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const res = await fetch(`${FLASK_API}/api/health`, {
        method: "GET",
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        return true;
      }
      return false;
    } catch (err) {
      console.error("Server connection check failed:", err);
      return false;
    }
  }

  // ---------------- FILE UPLOAD + YOLO INTEGRATION ---------------- 
  uploadBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) {
    alert("⚠️ Please select a file first.");
    return;
  }

  // Check server connection first
  const serverOnline = await checkServerConnection();
  if (!serverOnline) {
    alert("❌ Cannot connect to server!\n\nPlease ensure:\n• Flask server is running on port 3000\n• Check terminal/console for server status\n• Try restarting the server");
    return;
  }

  // Validate file size (e.g., max 500MB)
  const maxSize = 500 * 1024 * 1024; // 500MB
  if (file.size > maxSize) {
    alert("❌ File is too large! Maximum size is 500MB. Please choose a smaller file.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  const progress = document.getElementById("progress");
  const progressBar = progress.querySelector(".bar");
  progress.hidden = false;
  progressBar.style.width = "10%";

  // Show processing status next to zone buttons
  const processingStatus = document.getElementById("processingStatus");
  if (processingStatus) {
    processingStatus.style.display = "inline-block";
    processingStatus.textContent = "⏳ Processing...";
  }
  
  // Clear detection summary (keep it for results only)
  const detectionSummary = document.getElementById("detectionSummary");
  if (detectionSummary) {
    detectionSummary.textContent = "";
  }

  try {
    console.log("📤 Sending file:", file.name, "Size:", (file.size / 1024 / 1024).toFixed(2), "MB");
    progressBar.style.width = "30%";

    // Create fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    let res;
    try {
      res = await fetch(`${FLASK_API}/api/detect`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        throw new Error("Request timed out. The file might be too large or the server is taking too long to process.");
      } else if (fetchErr.message.includes('Failed to fetch') || fetchErr.message.includes('NetworkError')) {
        throw new Error("Cannot connect to server. Please ensure:\n• The Flask server is running on port 5000\n• Check your network connection\n• Try refreshing the page");
      } else {
        throw new Error(`Network error: ${fetchErr.message}`);
      }
    }

    console.log("📡 Response status:", res.status);
    progressBar.style.width = "60%";

    // Get response text
    let text;
    try {
      text = await res.text();
    } catch (textErr) {
      throw new Error("Failed to read server response. The server might have crashed during processing.");
    }
    
    console.log("📩 Raw response:", text.substring(0, 200));

    // Try parsing JSON safely
    let data;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
      console.error("⚠️ Failed to parse JSON:", jsonErr);
      console.error("Full response:", text);
      throw new Error("Server returned invalid response. The server might be experiencing issues. Please try again.");
    }

    progressBar.style.width = "80%";

    // Check if response contains an error
    if (!res.ok || data.error) {
      const errorMessage = data.error || `HTTP ${res.status}: Server error occurred`;
      console.error("❌ Server error:", errorMessage);
      throw new Error(errorMessage);
    }

    console.log("✅ Parsed response:", data);

    const annotatedPath = data.file_url;
    if (!annotatedPath || !annotatedPath.startsWith("/uploads/")) {
      throw new Error("Invalid file URL received from server. Please try uploading again.");
    }

    progressBar.style.width = "90%";

    const detectedUrl = `${FLASK_API}${annotatedPath}?t=${Date.now()}`;
    previewPlaceholder.style.display = "none";
    mediaWrap.hidden = false;

    // Check file extension from the path (before query params)
    const fileExtension = annotatedPath.match(/\.(jpg|jpeg|png|mp4|mov|mkv|avi)$/i);
    
    if (!fileExtension) {
      console.error("❌ Unknown file extension:", annotatedPath);
      throw new Error("Unsupported media format received from server.");
    }

    const ext = fileExtension[0].toLowerCase();
    console.log("📄 Detected file extension:", ext);

    if (/\.(jpg|jpeg|png)$/i.test(ext)) {
      // Image
      imagePreview.src = detectedUrl;
      imagePreview.style.display = "block";
      videoPreview.style.display = "none";
      console.log("🖼️ Displaying image:", detectedUrl);
    } else if (/\.(mp4|mov|mkv|avi)$/i.test(ext)) {
      // Video
      videoPreview.src = detectedUrl;
      videoPreview.style.display = "block";
      imagePreview.style.display = "none";
      videoPreview.load();
      videoPreview.muted = true;
      console.log("📹 Displaying video:", detectedUrl);
      videoPreview.play().catch(err => console.warn("⚠️ Autoplay blocked:", err));
    } else {
      throw new Error("Unsupported media format received from server.");
    }

    // Store processed video URL for Analysis tab
    if (data.file_url && /\.(mp4|mov|mkv|avi)$/i.test(data.file_url)) {
      processedVideoUrl = `${FLASK_API}${data.file_url}`;
      console.log("📹 Stored processed video URL for Analysis:", processedVideoUrl);
      console.log("📍 Full URL:", processedVideoUrl);
      console.log("📍 Flask API:", FLASK_API);
      console.log("📍 File URL:", data.file_url);
      
      // Test if URL is accessible
      fetch(processedVideoUrl, { method: 'HEAD' })
        .then(res => {
          console.log("✅ Video URL is accessible, status:", res.status);
          console.log("📄 Content-Type:", res.headers.get('Content-Type'));
        })
        .catch(err => console.error("❌ Video URL not accessible:", err));
    }

    progressBar.style.width = "100%";

    // Hide processing status
    if (processingStatus) {
      processingStatus.style.display = "none";
    }

    // Show success message or warning
    if (detectionSummary) {
      if (data.warning) {
        detectionSummary.textContent = "⚠️ " + data.message + " " + data.warning;
        detectionSummary.style.color = "#ffb020"; // Orange/yellow for warnings
      } else {
        detectionSummary.textContent = data.message || "✅ Detection complete!";
        detectionSummary.style.color = "#31c48d"; // Green for success
      }
    }

    // Small delay before hiding progress
    setTimeout(() => {
      progress.hidden = true;
      progressBar.style.width = "0%";
    }, 1000);

  } catch (err) {
    console.error("❌ Detect error:", err);
    
    // Hide progress immediately on error
    progress.hidden = true;
    progressBar.style.width = "0%";
    
    // Hide processing status
    if (processingStatus) {
      processingStatus.style.display = "none";
    }
    
    // Show error message in detection summary
    if (detectionSummary) {
      const errorMsg = err.message || "Detection failed. Please try again.";
      detectionSummary.textContent = "❌ " + errorMsg;
      detectionSummary.style.color = "#ef4444";
    }
    
    // Show user-friendly alert with specific error
    const errorMsg = err.message || "An unknown error occurred during detection.";
    alert("❌ Detection Failed\n\n" + errorMsg + "\n\nTroubleshooting:\n• Ensure Flask server is running on port 5000\n• Check file format (mp4, mov, mkv, jpg, png)\n• Verify file is not corrupted\n• Try a smaller file if it's very large");
  }
});

  // drag-drop & file input quick preview behavior
  ['dragenter','dragover'].forEach(ev => { dropzone.addEventListener(ev, (e)=>{ e.preventDefault(); dropzone.classList.add('drag'); }); });
  ['dragleave','drop'].forEach(ev => { dropzone.addEventListener(ev, (e)=>{ e.preventDefault(); dropzone.classList.remove('drag'); }); });
  dropzone.addEventListener('drop', (e) => { const file = e.dataTransfer.files[0]; fileInput.files = e.dataTransfer.files; showPreviewForFile(file); });
  fileInput.addEventListener('change', (e) => { const file = e.target.files[0]; showPreviewForFile(file); });

  function showPreviewForFile(file) {
  if (!file) {
    previewPlaceholder.style.display = 'flex';
    mediaWrap.hidden = true;
    return;
  }

  previewPlaceholder.style.display = 'none';
  mediaWrap.hidden = false;

  const url = URL.createObjectURL(file);

  if (file.type.startsWith('image/')) {
    imagePreview.src = url;
    imagePreview.style.display = 'block';
    videoPreview.style.display = 'none';
  } else {
    videoPreview.src = url;
    videoPreview.style.display = 'block';
    imagePreview.style.display = 'none';

    // ✅ Ensure autoplay and load
    videoPreview.load();
    videoPreview.muted = true;
    videoPreview.play().catch(err => console.warn('Autoplay blocked:', err));
  }

  // Ensure zones canvas fits the media
  setTimeout(resizeCanvasToMedia, 300);
}


  function resizeCanvasToMedia() {
  const media = videoPreview.style.display !== 'none' ? videoPreview : imagePreview;
  zoneCanvas.width = media.clientWidth;
  zoneCanvas.height = media.clientHeight;
  zoneCanvas.style.width = media.clientWidth + 'px';
  zoneCanvas.style.height = media.clientHeight + 'px';
  zoneCanvas.style.position = 'absolute';
  zoneCanvas.style.top = media.offsetTop + 'px';
  zoneCanvas.style.left = media.offsetLeft + 'px';
  zoneCanvas.style.pointerEvents = drawMode ? 'auto' : 'none';
}


  // ---------------- FEED MODAL (fixed behavior) ----------------
  // open modal only when add button is clicked
  addFeedBtn.addEventListener('click', () => {
    addFeedModal.hidden = false;
    addFeedModal.setAttribute('aria-hidden','false');
    // put focus to input
    setTimeout(()=> modalFeedName.focus(), 50);
  });

  // close handlers
  modalCancel.addEventListener('click', () => {
    addFeedModal.hidden = true;
    addFeedModal.setAttribute('aria-hidden','true');
  });

  modalSave.addEventListener('click', () => {
    const name = modalFeedName.value.trim();
    const type = modalFeedType.value;
    if (!name) { alert('Enter feed name'); modalFeedName.focus(); return; }
    addFeed(name, type);
    modalFeedName.value = '';
    addFeedModal.hidden = true;
    addFeedModal.setAttribute('aria-hidden','true');
  });

  // close when clicking outside modal-card
  addFeedModal.addEventListener('click', (e) => {
    if (e.target === addFeedModal) {
      addFeedModal.hidden = true;
      addFeedModal.setAttribute('aria-hidden','true');
    }
  });
  // close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !addFeedModal.hidden) {
      addFeedModal.hidden = true;
      addFeedModal.setAttribute('aria-hidden','true');
    }
  });

  // ---------------- TAB HANDLERS ----------------
  const tabDraw = document.getElementById("tabDraw");
  const tabPreview = document.getElementById("tabPreview");
  const tabAnalysis = document.getElementById("tabAnalysis");
  
  if (tabDraw) tabDraw.addEventListener("click", () => switchTab("draw"));
  if (tabPreview) tabPreview.addEventListener("click", () => switchTab("preview"));
  if (tabAnalysis) tabAnalysis.addEventListener("click", () => switchTab("analysis"));

  // ---------------- INIT ----------------
  if (!feeds.length) addFeed('WebCam (camera)', 'Camera Feed');
  renderFeeds();
  if (!selectedFeedId && feeds.length) selectedFeedId = feeds[0].id;
  loadSelectedFeed();

  // 🌗 Dark/Light Mode Toggle Logic
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

// Load saved theme from localStorage
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark-mode");
  themeIcon.classList.remove("fa-moon");
  themeIcon.classList.add("fa-sun");
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  if (isDark) {
    themeIcon.classList.remove("fa-moon");
    themeIcon.classList.add("fa-sun");
  } else {
    themeIcon.classList.remove("fa-sun");
    themeIcon.classList.add("fa-moon");
  }
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

});

// ============ API ENDPOINTS ============
const NODE_API = "http://127.0.0.1:3000";  // Node.js auth server
const FLASK_API = "http://127.0.0.1:5000"; // Flask YOLO server
const API_BASE = FLASK_API; // For backward compatibility

// ---------------- SIMPLE RECTANGULAR ZONE DRAWING ----------------
const canvas = document.getElementById("zoneCanvas");
const ctx = canvas.getContext("2d");
let zones = [];
let drawing = false;
let startX = 0, startY = 0;
let currentRect = null;

function resizeCanvas() {
  const video = document.getElementById("videoPreview");
  if (!video) return;
  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;
  canvas.style.width = video.clientWidth + "px";
  canvas.style.height = video.clientHeight + "px";
  drawZones();
}
window.addEventListener("resize", resizeCanvas);

function drawZones() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;

  // Draw saved zones
  zones.forEach(z => {
    ctx.strokeStyle = z.color || "#00ffff";
    ctx.strokeRect(z.x, z.y, z.w, z.h);
    ctx.fillStyle = (z.color || "#00ffff") + "33";
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.fillStyle = "#fff";
    ctx.font = "14px Poppins";
    ctx.fillText(z.label, z.x + 5, z.y + 20);
  });

  // Draw currently active rectangle
  if (currentRect) {
    ctx.strokeStyle = "#22c55e";
    ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
  }
}

// Mouse events
canvas.addEventListener("mousedown", e => {
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  currentRect = { x: startX, y: startY, w: 0, h: 0 };
});

canvas.addEventListener("mousemove", e => {
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  currentRect.w = mouseX - startX;
  currentRect.h = mouseY - startY;
  drawZones();
});

canvas.addEventListener("mouseup", e => {
  if (!drawing) return;
  drawing = false;
  const rect = canvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;

  const zoneLabelInput = document.getElementById("zoneLabelInput");
  const label = zoneLabelInput.value || `Zone ${zones.length + 1}`;
  const color = randomColor();

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const w = Math.abs(endX - startX);
  const h = Math.abs(endY - startY);

  zones.push({ x, y, w, h, label, color });
  currentRect = null;
  drawZones();
  addZoneToList(label);
});

function randomColor() {
  const colors = ["#3b82f6", "#22c55e", "#ef4444", "#eab308", "#8b5cf6"];
  return colors[zones.length % colors.length];
}

function addZoneToList(label) {
  const ul = document.getElementById("zonesList");
  const li = document.createElement("li");
  li.textContent = label;
  ul.appendChild(li);
}

document.getElementById("clearZonesBtn").addEventListener("click", () => {
  zones = [];
  drawZones();
  document.getElementById("zonesList").innerHTML = "";
});

document.getElementById("saveZonesBtn").addEventListener("click", async () => {
  if (!zones.length) return alert("Please draw at least one zone first!");
  const normalized = zones.map(z => ({
    label: z.label,
    points: [
      [z.x / canvas.width, z.y / canvas.height],
      [(z.x + z.w) / canvas.width, z.y / canvas.height],
      [(z.x + z.w) / canvas.width, (z.y + z.h) / canvas.height],
      [z.x / canvas.width, (z.y + z.h) / canvas.height]
    ],
  }));

  try {
    const res = await fetch(`${API_BASE}/api/set_zones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zones: normalized }),
    });
    const data = await res.json();
    if (res.ok) alert(`✅ ${zones.length} zone(s) saved successfully!`);
    else alert(`⚠️ ${data.error}`);
  } catch (err) {
    alert("Server error saving zones.");
  }
});


// Note: Upload handler is already defined above (line 308)
// This duplicate handler is kept for backward compatibility but should not be used
// The main upload handler above has better error handling

// Tab switching functionality
function switchTab(tabName) {
  // Remove active class from all tabs
  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.remove('active');
  });
  
  // Add active class to clicked tab
  const clickedTab = document.querySelector(`[data-tab="${tabName}"]`);
  if (clickedTab) {
    clickedTab.classList.add('active');
  }
  
  // Show/hide elements based on tab
  const videoPreview = document.getElementById("videoPreview");
  const imagePreview = document.getElementById("imagePreview");
  const liveVideo = document.getElementById("liveVideo");
  const mediaWrap = document.getElementById("mediaWrap");
  
  if (tabName === "analysis") {
    // Show processed video in Analysis tab
    if (processedVideoUrl) {
      console.log("📺 Switching to Analysis tab with video:", processedVideoUrl);
      
      // Hide other previews first
      if (videoPreview) videoPreview.style.display = "none";
      if (imagePreview) imagePreview.style.display = "none";
      
      // Show media wrap if hidden
      if (mediaWrap) {
        mediaWrap.hidden = false;
        mediaWrap.style.display = "flex";
      }
      
      // Set video source with proper styling
      liveVideo.src = processedVideoUrl;
      liveVideo.style.display = "block";
      liveVideo.style.position = "relative";  // Changed from absolute
      liveVideo.style.width = "100%";
      liveVideo.style.height = "100%";
      liveVideo.style.maxWidth = "100%";
      liveVideo.style.maxHeight = "100%";
      liveVideo.style.objectFit = "contain";
      
      // Add error event listener
      liveVideo.onerror = function(e) {
        console.error("❌ Video load error:", e);
        console.error("Video error code:", liveVideo.error ? liveVideo.error.code : 'unknown');
        console.error("Video error message:", liveVideo.error ? liveVideo.error.message : 'unknown');
        alert(`Video playback error. The video format may not be supported by your browser.\n\nTry:\n1. Using Chrome or Edge browser\n2. Converting video to MP4 (H.264 codec)\n3. Re-uploading a different video`);
      };
      
      // Add canplay event for debugging
      liveVideo.oncanplay = function() {
        console.log("✅ Video can play - format is compatible");
      };
      
      liveVideo.load();
      liveVideo.play().catch(err => {
        console.warn("⚠️ Autoplay blocked:", err);
        console.log("Click the video to play it manually");
      });
      
      // Start real-time analysis and counting
      startAnalysisIfNeeded();
    } else {
      alert("⚠️ Please upload and process a video first!");
      // Switch back to draw tab
      switchTab("draw");
      return;
    }
  } else {
    // Hide live video in other tabs
    if (liveVideo) liveVideo.style.display = "none";
    // Stop polling when leaving analysis tab
    stopPolling();
  }
}

// Start analysis if needed (called from switchTab)
async function startAnalysisIfNeeded() {
  if (!processedVideoUrl) {
    console.log("⚠️ No processed video available");
    return;
  }
  
  // Check if zones are drawn
  if (!zones || zones.length === 0) {
    const zonePanel = document.getElementById("zoneCountsPanel");
    zonePanel.innerHTML = '<div style="color: #ef4444; padding: 10px;">⚠️ Please draw zones in the "Draw Zones" tab first, then click "Save Zones" before analyzing.</div>';
    return;
  }
  
  try {
    console.log("📤 Sending zones to backend:", zones.length, "zones");
    
    // First, ensure zones are sent to backend
    const normalized = zones.map(z => ({
      label: z.label,
      points: [
        [z.x / canvas.width, z.y / canvas.height],
        [(z.x + z.w) / canvas.width, z.y / canvas.height],
        [(z.x + z.w) / canvas.width, (z.y + z.h) / canvas.height],
        [z.x / canvas.width, (z.y + z.h) / canvas.height]
      ],
    }));
    
    await fetch(`${API_BASE}/api/set_zones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zones: normalized }),
    });
    
    console.log("✅ Zones sent to backend");
    
    // Extract feed path from processed video URL
    const urlParts = processedVideoUrl.split('/');
    const fileName = urlParts[urlParts.length - 1].split('?')[0];
    const feedPath = `uploads/${fileName}`;
    
    console.log("📹 Starting analysis for:", feedPath);

    const res = await fetch(`${API_BASE}/api/start_analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_path: feedPath }),
    });

    const data = await res.json();
    if (res.ok) {
      console.log("🎬 YOLOv8 analysis started successfully!");
      startPolling();
    } else {
      console.warn("⚠️ Analysis start failed:", data.error);
      const zonePanel = document.getElementById("zoneCountsPanel");
      zonePanel.innerHTML = `<div style="color: #ef4444;">❌ ${data.error || 'Analysis failed'}</div>`;
    }
  } catch (err) {
    console.error("❌ Analysis start error:", err);
    const zonePanel = document.getElementById("zoneCountsPanel");
    zonePanel.innerHTML = '<div style="color: #ef4444;">❌ Error starting analysis. Check console.</div>';
  }
}


// Poll live counts
let poller = null;
function startPolling() {
  if (poller) {
    console.log("⚠️ Polling already active");
    return;
  }
  
  const zonePanel = document.getElementById("zoneCountsPanel");
  zonePanel.innerHTML = '<div style="color: #10b981; font-weight: bold;">🔄 Analyzing video...</div>';
  
  console.log("🔄 Started polling for live counts");
  
  let pollAttempts = 0;
  const maxAttempts = 5;
  
  poller = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/live_counts`);
      const data = await res.json();
      
      console.log("📊 Received counts:", data.counts);
      
      if (!data.counts || data.counts.length === 0) {
        pollAttempts++;
        if (pollAttempts < maxAttempts) {
          zonePanel.innerHTML = `<div style="color: #6b7280;">⏳ Waiting for analysis data... (${pollAttempts}/${maxAttempts})</div>`;
        } else {
          zonePanel.innerHTML = '<div style="color: #f59e0b; padding: 10px;"><strong>⚠️ No data received</strong><br/>Make sure:<br/>1. Zones are drawn and saved<br/>2. Video is processing<br/>3. Check console for errors</div>';
        }
        return;
      }
      
      // Reset poll attempts when we get data
      pollAttempts = 0;
      
      // Calculate total people across all zones
      const totalPeople = data.counts.reduce((sum, count) => sum + count, 0);
      
      // Display counts with better formatting
      let html = `<div style="margin-bottom: 10px; padding: 12px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; border-left: 4px solid #10b981; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="font-size: 18px; font-weight: bold; color: #059669;">👥 Total People: ${totalPeople}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Updated ${new Date().toLocaleTimeString()}</div>
      </div>`;
      
      html += '<div style="margin-top: 10px;">';
      data.counts.forEach((count, i) => {
        const zoneName = zones[i]?.label || `Zone ${i + 1}`;
        const color = count > 0 ? '#10b981' : '#9ca3af';
        const bgColor = count > 0 ? '#f0fdf4' : '#f9fafb';
        const icon = count > 0 ? '🟢' : '⚪';
        html += `<div style="padding: 10px; margin: 5px 0; background: ${bgColor}; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e5e7eb;">
          <span style="color: #374151; font-weight: 500;">${icon} ${zoneName}</span>
          <span style="color: ${color}; font-weight: bold; font-size: 20px;">${count}</span>
        </div>`;
      });
      html += '</div>';
      
      zonePanel.innerHTML = html;
    } catch (err) {
      console.error("❌ Polling error:", err);
      zonePanel.innerHTML = '<div style="color: #ef4444; padding: 10px;">❌ Error fetching counts<br/><small>' + err.message + '</small></div>';
    }
  }, 2000); // Poll every 2 seconds
}

function stopPolling() {
  if (poller) {
    clearInterval(poller);
    poller = null;
    console.log("🛑 Stopped polling");
  }
}
