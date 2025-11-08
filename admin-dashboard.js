// ===============================
// Configuration
// ===============================
const BASE_URL = "https://127.0.0.1:5000/api";

// ===============================
// Authentication Check
// ===============================
if (!localStorage.getItem("accessToken") || !localStorage.getItem("refreshToken")) {
  window.location.href = "index.html";
}

// ===============================
// Logout
// ===============================
document.getElementById("logout").addEventListener("click", async () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  window.location.href = "index.html";
});

// ===============================
// Canvas Drawing (Zone Mockup)
// ===============================
const canvas = document.getElementById("zoneCanvas");
const ctx = canvas.getContext("2d");
let drawing = false;
let startX, startY;

canvas.addEventListener("mousedown", (e) => {
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
});

canvas.addEventListener("mouseup", (e) => {
  if (!drawing) return;
  drawing = false;
  const rect = canvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;
  ctx.strokeStyle = "#1d3557";
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, startY, endX - startX, endY - startY);
});

// ===============================
// Feed Management (Stub APIs)
// ===============================
async function fetchFeeds() {
  try {
    const res = await fetch(`${BASE_URL}/feeds`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
    });
    const data = await res.json();
    populateFeedList(data.feeds || []);
  } catch (err) {
    console.error("Fetch feeds failed", err);
  }
}

function populateFeedList(feeds) {
  const list = document.getElementById("feedList");
  list.innerHTML = "";
  if (feeds.length === 0) {
    list.innerHTML = "<li>No feeds available</li>";
    return;
  }
  feeds.forEach((feed) => {
    const li = document.createElement("li");
    li.textContent = feed.name;
    li.addEventListener("click", () => loadFeedPreview(feed));
    list.appendChild(li);
  });
}

async function addFeed() {
  const name = document.getElementById("feedName").value.trim();
  const type = document.getElementById("feedType").value;
  const file = document.getElementById("videoUpload").files[0];
  if (!name || !file) return alert("Please fill all fields.");

  const formData = new FormData();
  formData.append("name", name);
  formData.append("type", type);
  formData.append("video", file);

  try {
    const res = await fetch(`${BASE_URL}/feeds`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      body: formData,
    });
    if (res.ok) {
      alert("Feed added successfully!");
      fetchFeeds();
    } else {
      alert("Failed to add feed.");
    }
  } catch (err) {
    console.error("Add feed error", err);
  }
}

document.getElementById("saveFeed").addEventListener("click", addFeed);
document.getElementById("cancelFeed").addEventListener("click", () => {
  document.getElementById("feedName").value = "";
  document.getElementById("videoUpload").value = "";
});

// ===============================
// Zone Saving (Stub)
// ===============================
document.getElementById("saveZone").addEventListener("click", async () => {
  alert("Zone coordinates saved (stub). Connect this to /api/zones");
});

// ===============================
// Initialize Dashboard
// ===============================
window.onload = fetchFeeds;
