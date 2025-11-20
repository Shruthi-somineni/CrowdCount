# CrowdCount Dashboard - Feature Documentation

## 🎯 Core Features

### 1. **Feed Management**

#### Create a New Feed
- Click the **"+"** button in the "Feeds" section
- Enter feed name (e.g., "Main Entrance")
- Select feed type: "Image" or "Video File"
- Click **"Add"**
- Feed appears in the sidebar

#### Select a Feed
- Click on any feed name in the sidebar to select it
- Current feed is highlighted with a blue background
- Zones are loaded based on the selected feed

#### Delete a Feed
- Click the **trash icon** next to any feed
- Feed is deleted from localStorage
- Any saved zones for that feed are also removed

---

### 2. **Video/Image Upload & Processing**

#### Upload Media
1. Click on a feed to select it
2. Drag & drop a file onto the upload area, OR click to browse
3. Supported formats:
   - **Videos:** MP4, MOV, MKV, AVI
   - **Images:** JPG, JPEG, PNG
4. Maximum file size: **500 MB**

#### Start Processing
1. After selecting a file, click **"Upload & Process"**
2. A progress bar appears
3. Processing happens on Flask server (Port 5000)
4. YOLO model detects all objects in the media
5. Result displays in the preview area with detection annotations

#### Progress Indicators
- 10-30%: Uploading file to server
- 30-60%: Server processing with YOLO
- 60-90%: Finalizing and returning result
- 90-100%: Media loaded in preview
- "✅ Detection complete!" - Success message

---

### 3. **Zone Drawing & Saving**

#### Draw Rectangular Zones
1. Upload media first (image or video)
2. Click **"Start Drawing"** button
   - Button changes to: "Drawing: Click & Drag"
   - Pointer events enabled on canvas
3. Enter a **Zone Label** (e.g., "Entrance", "Queue", "Exit")
4. **Click & drag** on the preview to draw rectangles
5. Zone is added automatically after drawing

#### Save Zones
1. After drawing zones, click **"Save Zones"**
2. Zones are saved to browser's localStorage
3. Each feed has separate zone storage: `zones_<feedId>`
4. Saved zones persist across page refreshes

#### View Saved Zones
- All zones appear in the **"Zones"** list on the right panel
- **Eye icon**: Highlight zone for 2.5 seconds
- **Trash icon**: Delete zone

#### Clear Zones
- Click **"Clear Zones"** button
- Zones are cleared from memory
- Save to persist the empty state

---

### 4. **Analysis Tab - Live People Counting**

#### Switch to Analysis Tab
1. Upload and process a video with YOLO detection
2. Click the **"Analysis"** tab
3. The detected video automatically loads and plays

#### Real-Time Counting Features
- **Live Video Display**: Shows YOLO-annotated video with bounding boxes
- **Live Counts Panel**: Shows detected people per zone
- **Update Frequency**: Counts update every 2 seconds
- **Zone-based Counting**: Only counts people within drawn zones

#### Live Counts Display
```
🟢 Entrance: 3
🟢 Queue: 5
🟢 Exit: 1
```

#### Start/Stop Analysis
- Analysis starts automatically when switching to Analysis tab
- Real-time counting begins if zones are defined
- Switch to another tab to pause counting

---

### 5. **Tab Navigation**

#### Three Main Tabs

**1. Draw Zones Tab**
- Upload media
- Draw rectangular zones
- Save zones to storage
- Preview: Shows uploaded media with zone overlays

**2. Preview Zones Tab**
- Shows current preview with all saved zones highlighted
- Can highlight individual zones using eye icons
- Read-only view of zone positions

**3. Analysis Tab**
- Shows YOLO-detected video
- Displays real-time people counts per zone
- Interactive video playback with controls
- Live counts update in real-time

---

### 6. **Authentication**

#### Login Flow
1. Navigate to `http://127.0.0.1:3000`
2. Enter username and password
3. Credentials verified against SQLite database
4. Access token created (15-minute expiry)
5. Refresh token created (7-day expiry)
6. Automatically redirected to dashboard
7. Tokens stored in localStorage

#### Token Management
- **Access Token**: Used for authenticated requests
- **Refresh Token**: Used to get new access tokens
- **Auto-Refresh**: Tokens refresh automatically before expiry
- **Logout**: Clears tokens and redirects to login

#### Demo Credentials
- **Username:** `testuser`
- **Password:** `password123`

---

### 7. **Theme Toggle**

#### Dark/Light Theme
- Click the **sun/moon icon** in top-right corner
- Theme preference saved to localStorage
- Persists across page refreshes
- Affects entire dashboard UI

#### Theme Colors
- **Light Mode**: White/light gray background, dark text
- **Dark Mode**: Dark background, light text, blue accents

---

## 🔄 Complete Workflow Example

### Step-by-Step Guide

```
1. START
   ↓
2. LOGIN with credentials
   ↓
3. DASHBOARD loads
   ↓
4. CREATE FEED "Market Entrance"
   ↓
5. SELECT the feed
   ↓
6. UPLOAD video file (500MB max)
   ↓
7. PROCESS with YOLO detection
   ↓
8. PREVIEW shows detected video
   ↓
9. DRAW ZONE "Entry Point" (rectangle)
   ↓
10. DRAW ZONE "Queue Area" (rectangle)
    ↓
11. SAVE ZONES to localStorage
    ↓
12. CLICK "Analysis" tab
    ↓
13. ANALYSIS starts automatically
    ↓
14. LIVE COUNTS update every 2 seconds:
    - Entry Point: 3 people
    - Queue Area: 7 people
    ↓
15. MONITOR and adjust zones as needed
    ↓
16. LOGOUT when done
```

---

## 📊 Data Flow Architecture

```
┌─────────────────┐
│   User Browser  │
│    Dashboard    │
└────────┬────────┘
         │
    ┌────┴──────────────┐
    │                   │
    ▼                   ▼
┌─────────────┐  ┌──────────────┐
│ Node Server │  │ Flask Server │
│  Port 3000  │  │  Port 5000   │
│             │  │              │
│ • Auth      │  │ • YOLO       │
│ • Tokens    │  │ • Detection  │
│ • Users     │  │ • Video proc │
└─────────────┘  └──────────────┘
    │                   │
    ▼                   ▼
┌─────────────┐  ┌──────────────┐
│ SQLite DB   │  │ /uploads dir │
│ (server/db) │  │ (video files)│
└─────────────┘  └──────────────┘
    │
    ▼
┌─────────────┐
│ localStorage│
│ (feeds,     │
│  zones,     │
│  tokens)    │
└─────────────┘
```

---

## 🎨 UI Components

### Main Layout
```
┌───────────────────────────────────────────────────────────┐
│ CrowdCount    [Feeds Section]  Welcome, User  [Logout]    │
├───────────────────────────────────────────────────────────┤
│                      │                                      │
│                      │                                      │
│  [Feeds List]        │   Feed: family                      │
│  - family            │   [Draw] [Preview] [Analysis]       │
│  - parking           │                                      │
│  - entrance          │   ┌─────────────────────────────┐  │
│                      │   │     Upload Area             │  │
│  [Manage Feeds]      │   │   Drag & drop here          │  │
│  [Logout]            │   │   [Upload & Process]        │  │
│                      │   └─────────────────────────────┘  │
│                      │                                      │
│                      │   ┌─────────────────────────────┐  │
│                      │   │   Video/Image Preview       │  │
│                      │   │   with Canvas (zones)       │  │
│                      │   │                             │  │
│                      │   └─────────────────────────────┘  │
│                      │                                      │
│                      │   Zone Label: [________]             │
│                      │   [Start] [Save] [Clear]            │
│                      │                                      │
├──────────────────────┤                                      │
│   Instructions       │                                      │
│   ...                │                                      │
│                      │                                      │
│   Zones              │                                      │
│   □ Zone 1           │                                      │
│   □ Zone 2           │                                      │
│                      │                                      │
│   Live Counts        │                                      │
│   No live stream     │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

---

## ⚙️ Settings & Customization

### Adjustable Parameters

**In dashboard.js:**
```javascript
NODE_API = "http://127.0.0.1:3000"    // Auth server
FLASK_API = "http://127.0.0.1:5000"   // YOLO server
```

**In app.py:**
```python
model = YOLO("yolov8n.pt")  # Detection model size
# Options: n (nano), s (small), m (medium), l (large), x (extra)
```

**Polling Frequency (live counts):**
```javascript
setInterval(async () => { ... }, 2000);  // 2000ms = 2 seconds
// Adjust for faster/slower updates
```

---

## 🚨 Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Cannot connect to server | Flask not running | Start Flask on port 5000 |
| Invalid file format | Wrong format | Use MP4, MOV, MKV, JPG, PNG |
| File too large | >500MB | Use smaller file |
| No zones defined | Missing zones | Draw zones before analysis |
| Live counts not updating | Analysis stopped | Click Analysis tab again |
| Authentication failed | Wrong credentials | Check username/password |
| Token expired | Inactivity >15 min | Login again |

---

## 📱 Responsive Design

- **Desktop**: Full layout with sidebar
- **Tablet**: Optimized grid layout
- **Mobile**: Simplified single-column view

---

## ♿ Accessibility Features

- Semantic HTML structure
- ARIA labels for modal dialogs
- Keyboard navigation support
- Color contrast compliance
- Focus indicators

---

## 🔒 Data Privacy

- **Zones**: Stored only in browser localStorage
- **Tokens**: Encrypted and HTTP-only (when configured)
- **Videos**: Stored in `/uploads` directory
- **User Data**: Stored in SQLite database

---

## 📈 Performance Tips

1. **Use smaller videos** for faster processing
2. **Limit zones to 5-10** per feed
3. **Close unused tabs** to reduce memory usage
4. **Clear browser cache** if experiencing issues
5. **Use YOLOv8n model** for speed, YOLOv8x for accuracy

---

## 🆘 Need Help?

1. Check browser console (F12) for errors
2. Check server terminal output for backend errors
3. Verify both servers are running
4. Review SETUP_GUIDE.md for detailed troubleshooting
5. Check file permissions in `/uploads` directory

---

**Last Updated:** 2025
**Version:** 1.0
