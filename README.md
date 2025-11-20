# 🚀 CrowdCount - Real-Time Crowd Counting with YOLO

A modern web-based application for detecting and counting people in videos using YOLOv8, with zone-based analysis and real-time crowd monitoring.

## ✨ Features

### 📹 Video Processing
- Upload video or image files
- YOLOv8-based object detection
- Real-time people detection and annotation
- Support for MP4, MOV, MKV, JPG, PNG formats
- Maximum file size: 500MB

### 🎯 Zone Management
- Draw rectangular detection zones on videos
- Multiple zones per feed
- Zone-based people counting
- Visual zone highlighting and preview
- Persistent storage per feed

### 📊 Live Monitoring
- Real-time people counts per zone
- Updates every 2 seconds
- Visual display of detection results
- Analysis tab with live statistics

### 🔐 Security & Authentication
- User authentication with JWT tokens
- Refresh token mechanism
- Account status tracking (active/locked/inactive)
- Secure password hashing with bcrypt
- Token expiry: 15 minutes (access), 7 days (refresh)

### 🎨 User Interface
- Responsive dashboard design
- Dark/Light theme toggle
- Intuitive feed management
- Real-time preview with overlays
- Mobile-optimized layout

## 🏗️ Architecture

### **Frontend (Port varies)**
- `dashboard.html` - Main UI
- `dashboard.js` - Core logic & API integration
- `dashboard.css` - Styling
- Browser localStorage - Feed/zone persistence

### **Node.js Auth Server (Port 3000)**
- User authentication & JWT tokens
- Token validation & refresh
- User management
- SQLite database
- CORS-enabled API

### **Flask YOLO Server (Port 5000)**
- YOLOv8 object detection
- Video/image processing
- Zone-based counting
- Real-time analysis
- File serving

## 🚀 Quick Start

### 1️⃣ Install Dependencies

```bash
# Python dependencies
pip install -r requirements.txt

# Node.js dependencies
cd server
npm install
```

### 2️⃣ Start Servers

**Option A: Automatic (PowerShell)**
```powershell
.\START_SERVERS.ps1
```

**Option B: Automatic (Batch)**
```cmd
START_SERVERS.bat
```

**Option C: Manual**

Terminal 1 - Auth Server:
```bash
cd server
npm start
```

Terminal 2 - YOLO Server:
```bash
python app.py
```

### 3️⃣ Open Dashboard

Navigate to: `http://127.0.0.1:3000`

### 4️⃣ Login

- **Username:** `testuser`
- **Password:** `password123`

## 📖 Usage Guide

### Creating a Feed
1. Click the **"+"** button in "Feeds" section
2. Enter feed name (e.g., "Main Entrance")
3. Select feed type: "Image" or "Video File"
4. Click **"Add"**

### Uploading Media
1. Select a feed
2. Drag & drop or click to upload
3. Wait for YOLO processing to complete
4. Preview shows annotated result with detected people

### Drawing Zones
1. Click **"Start Drawing"** button
2. Enter zone label
3. Click & drag to draw rectangular zones
4. Click **"Save Zones"** to persist

### Analyzing Results
1. Click **"Analysis"** tab
2. Video displays with YOLO annotations
3. **"Live Counts"** panel shows real-time people counts per zone
4. Counts update every 2 seconds

## 📁 Project Structure

```
e:\login\
├── server/
│   ├── server.js           # Node.js auth server
│   ├── db.js               # SQLite database
│   ├── middleware/auth.js  # JWT validation
│   └── package.json
├── app.py                  # Flask YOLO server
├── dashboard.html          # Main dashboard UI
├── dashboard.js            # Dashboard logic
├── dashboard.css           # Styling
├── login.html             # Login page
├── auth.js                # Login handler
├── uploads/               # Processed media files
├── requirements.txt       # Python packages
├── SETUP_GUIDE.md         # Detailed setup instructions
├── FEATURES.md            # Feature documentation
├── QUICK_REFERENCE.md     # Quick reference
├── TROUBLESHOOTING.md     # Troubleshooting guide
└── README.md              # This file
```

## 🔌 API Endpoints

### Authentication Server (Port 3000)
```
POST   /api/login          - User login
POST   /api/logout         - User logout
GET    /api/me             - Get current user
POST   /api/refresh        - Refresh access token
POST   /api/signup         - User registration
```

### YOLO Detection Server (Port 5000)
```
POST   /api/detect         - Detect objects in file
POST   /api/start_analysis - Begin zone counting
POST   /api/stop_analysis  - Stop analysis
GET    /api/live_counts    - Get current zone counts
GET    /uploads/<file>     - Serve media files
GET    /api/health         - Server health check
```

## 🛠️ Configuration

### Change Detection Model

Edit `app.py` line ~12:
```python
model = YOLO("yolov8n.pt")  # nano (fastest)
# Options: yolov8s.pt, yolov8m.pt, yolov8l.pt, yolov8x.pt
```

### Change Server Ports

Edit `dashboard.js` line ~636:
```javascript
const NODE_API = "http://127.0.0.1:3000";
const FLASK_API = "http://127.0.0.1:5000";
```

### Change Polling Frequency

Edit `dashboard.js` line ~851 (search for `setInterval`):
```javascript
setInterval(async () => { ... }, 2000);  // 2000ms = 2 seconds
```

## 📋 System Requirements

- **Windows 10/11** (or Linux/Mac with minor adjustments)
- **Python 3.8+** with pip
- **Node.js 14+** with npm
- **RAM:** 8GB minimum (for video processing)
- **Disk Space:** 10GB free (for models & uploads)

## 🔒 Security

- ✅ JWT-based authentication
- ✅ Bcrypt password hashing
- ✅ Refresh token mechanism
- ✅ Account status tracking
- ✅ CORS configuration
- ⚠️ Use HTTPS in production

## 📊 Performance Tips

1. **Use YOLOv8n** for speed (recommended for real-time)
2. **Use videos < 5 minutes** for faster processing
3. **Limit zones to 5-10** per feed
4. **Close unused browser tabs** to reduce memory
5. **Use MP4 format** for best compatibility

## 🐛 Troubleshooting

### "Cannot connect to server"
- Ensure Flask server is running on port 5000
- Check firewall settings
- Verify network connection

### "Invalid credentials"
- Username: `testuser`, Password: `password123`
- Case-sensitive - must match exactly
- Clear browser cache and retry

### YOLO processing hangs
- Use smaller video file (< 2 minutes)
- Check available RAM
- Reduce video resolution to 720p

### "No live counts"
- Ensure zones are drawn and saved
- Verify Analysis tab is active
- Check zones are within video bounds

**For detailed troubleshooting, see `TROUBLESHOOTING.md`**

## 📚 Documentation

- **`SETUP_GUIDE.md`** - Complete installation & startup guide
- **`FEATURES.md`** - Detailed feature documentation
- **`QUICK_REFERENCE.md`** - Quick reference card
- **`TROUBLESHOOTING.md`** - Comprehensive troubleshooting guide

## 🚀 Advanced Usage

### Processing Multiple Videos
1. Create separate feeds for each camera
2. Process videos simultaneously in different tabs
3. Each feed maintains independent zones
4. Monitor all feeds in separate browser windows

### Custom Zone Analysis
1. Define precise zones for specific areas
2. Zone names appear in live counts
3. Overlapping zones count same person in both
4. Non-overlapping zones provide accurate segregation

### Real-Time Monitoring
- Keep Analysis tab open during live video
- Monitor zone counts in real-time
- Adjust zones as needed while processing
- Export data for analysis (future feature)

## 🔄 Workflow Example

```
1. Create Feed → "Main Entrance"
2. Upload Video → "entrance_crowd.mp4"
3. Wait for YOLO → Detects 42 people
4. Draw Zones → "Entry", "Queue", "Exit"
5. Save Zones → Zones persist
6. Analysis Tab → Shows video with annotations
7. Live Counts:
   - Entry: 15 people
   - Queue: 20 people
   - Exit: 7 people
8. Monitor → Counts update every 2 seconds
```

## 💡 Use Cases

- 🏪 **Retail Stores** - Monitor crowding in different zones
- 🏥 **Hospitals** - Track foot traffic and congestion
- 🏢 **Office Buildings** - Count people in corridors/lobbies
- 🎬 **Events** - Monitor crowd distribution
- 🚏 **Public Transit** - Track passenger volumes
- 🏛️ **Museums** - Analyze visitor distribution
- 🏃 **Fitness Centers** - Monitor activity zones

## 📈 Roadmap

- [ ] Export data to CSV/JSON
- [ ] Historical trend analysis
- [ ] Custom time-based reports
- [ ] Email alerts for threshold breaches
- [ ] Multiple user support
- [ ] Video clip export
- [ ] Mobile app integration

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- UI/UX enhancements
- Performance optimization
- Model accuracy improvements
- Mobile responsiveness
- Documentation improvements

## 📝 License

This project is provided as-is for educational and commercial use.

## 🙏 Acknowledgments

- **YOLOv8** by Ultralytics
- **OpenCV** for video processing
- **Flask** for web server
- **Express.js** for authentication server
- **SQLite** for database

## 📞 Support & Feedback

For issues, questions, or feedback:
1. Check `TROUBLESHOOTING.md` first
2. Review console logs (F12)
3. Check server terminal output
4. Verify both servers are running

## 🎯 Quick Reference Commands

```bash
# Install dependencies
pip install -r requirements.txt
cd server && npm install

# Start servers
python app.py                    # Terminal 1 - Flask
cd server && npm start          # Terminal 2 - Node.js

# Reset database
rm server/db.sqlite
npm start                        # Recreates with defaults

# Check server status
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:5000/api/health

# View browser storage
# F12 → Application → LocalStorage
```

## 🌟 Key Features Summary

| Feature | Status | Details |
|---------|--------|---------|
| Video Upload | ✅ | MP4, MOV, MKV (500MB max) |
| Image Upload | ✅ | JPG, PNG support |
| YOLO Detection | ✅ | Real-time with YOLOv8n |
| Zone Drawing | ✅ | Rectangular zones with labels |
| Zone Counting | ✅ | Real-time people count per zone |
| Live Counts | ✅ | Updates every 2 seconds |
| Authentication | ✅ | JWT tokens with refresh |
| Persistence | ✅ | localStorage for feeds/zones |
| Dark Theme | ✅ | Dark/Light mode toggle |
| Responsive | ✅ | Mobile-friendly design |

---

**Version:** 1.0  
**Last Updated:** 2025  
**Status:** ✅ Production Ready

**Happy Counting! 🎯**
