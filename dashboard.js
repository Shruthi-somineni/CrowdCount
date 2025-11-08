// dashboard.js - UI + lightweight zone drawing + per-feed localStorage
// Includes modal fix + dark/light theme toggle (persistent)

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

  const res = await fetch('http://127.0.0.1:3000/api/refresh', {
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
    if (!tokens.accessToken || !tokens.refreshToken) return false;

    const response = await fetchWithToken('http://127.0.0.1:3000/api/me');
    if (!response) return false;
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    document.getElementById('userName').textContent = data.user.name;
    return true;
  } catch { return false; }
}

// logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (refreshToken) {
    await fetch('http://127.0.0.1:3000/api/logout', {
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
  // initialize theme toggle early (so UI doesn't flash)
  initThemeToggle();

  const isAuthenticated = await verifyAuth();
  if (!isAuthenticated) { window.location.href = 'login.html'; return; }

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

  // ---------------- FILE UPLOAD + YOLO INTEGRATION ----------------
  uploadBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) return alert("Please select a file first.");

  const formData = new FormData();
  formData.append("file", file);

  const progress = document.getElementById("progress");
  progress.hidden = false;
  progress.querySelector(".bar").style.width = "30%";

  try {
    console.log("📤 Sending file:", file.name);
    const res = await fetch("http://127.0.0.1:3000/api/detect", {
      method: "POST",
      body: formData
    });

    console.log("📡 Response status:", res.status);

    const text = await res.text(); // get raw response first
    console.log("📩 Raw response:", text);

    if (!res.ok) {
      throw new Error("HTTP " + res.status + ": " + text);
    }

    // Try parsing JSON safely
    let data;
    try {
      data = JSON.parse(text);
    } catch (jsonErr) {
      console.error("⚠️ Failed to parse JSON:", jsonErr);
      throw new Error("Invalid JSON from backend: " + text);
    }

    console.log("✅ Parsed response:", data);

    const annotatedPath = data.file_url;
    if (!annotatedPath || !annotatedPath.startsWith("/uploads/")) {
      throw new Error("Invalid file_url: " + annotatedPath);
    }

    const detectedUrl = `http://127.0.0.1:3000${annotatedPath}?t=${Date.now()}`;
    previewPlaceholder.style.display = "none";
    mediaWrap.hidden = false;

    if (/\.(jpg|jpeg|png)$/i.test(detectedUrl)) {
      imagePreview.src = detectedUrl;
      imagePreview.style.display = "block";
      videoPreview.style.display = "none";
    } else if (/\.(mp4|mov|mkv)$/i.test(detectedUrl)) {
      videoPreview.src = detectedUrl;
      videoPreview.style.display = "block";
      imagePreview.style.display = "none";
      videoPreview.load();
      videoPreview.muted = true;
      videoPreview.play().catch(err => console.warn("Autoplay blocked:", err));
    } else {
      alert("Unsupported media format.");
    }

    alert(data.message || "Detection complete!");

  } catch (err) {
    console.error("❌ Detect error:", err);
    alert(
      "Detection failed.\n" +
      "Error: " + (err.message || err) + "\n" +
      "See console for more details."
    );
  } finally {
    progress.querySelector(".bar").style.width = "100%";
    setTimeout(() => (progress.hidden = true), 800);
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
