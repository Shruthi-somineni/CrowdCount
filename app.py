from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from pymongo import MongoClient
import jwt, datetime, bcrypt, os, cv2, uuid, glob
from ultralytics import YOLO
import numpy as np

# Use the same JWT secret as Node.js server for token compatibility
SECRET_KEY = "your-super-secret-jwt-key-change-in-production-12345"

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://127.0.0.1:5500", "http://localhost:5500"]}},
     supports_credentials=True)
 
model = YOLO("yolov8n.pt")  # ✅ Load once globally, faster!
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({'error': 'Method not allowed'}), 405

# ----------------------------
# MongoDB Connection
# ----------------------------
MONGO_URI = "mongodb+srv://shruthisomineni_db_user:kwanjiah%401434@cluster0.3l7l1eg.mongodb.net/?retryWrites=true&w=majority"
client = MongoClient(MONGO_URI)
db = client["crowd_counting_db"]


# ----------------------------
# Create Uploads Folder (filesystem)
# ----------------------------
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ----------------------------
# Serve Files (HTTP access)
# ----------------------------
@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    """Serve uploaded or annotated files with proper MIME types"""
    response = send_from_directory(UPLOAD_FOLDER, filename)
    
    # Set proper MIME type for videos to ensure browser compatibility
    if filename.endswith('.mp4'):
        response.headers['Content-Type'] = 'video/mp4'
    elif filename.endswith('.webm'):
        response.headers['Content-Type'] = 'video/webm'
    elif filename.endswith(('.jpg', '.jpeg')):
        response.headers['Content-Type'] = 'image/jpeg'
    elif filename.endswith('.png'):
        response.headers['Content-Type'] = 'image/png'
    
    # Add CORS headers for video streaming
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Accept-Ranges'] = 'bytes'
    
    return response


# ----------------------------
# Root route
# ----------------------------
@app.route('/')
def home():
    return jsonify({"message": "Flask backend running successfully!"}), 200

# ----------------------------
# SIGNUP ROUTE
# ----------------------------
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if db.users.find_one({"email": email}):
        return jsonify({"error": "Email already exists"}), 400
    if db.users.find_one({"username": username}):
        return jsonify({"error": "Username already exists"}), 400

    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db.users.insert_one({"username": username, "email": email, "password": hashed_pw})
    return jsonify({"message": "Signup successful"}), 201

# ----------------------------
# LOGIN ROUTE
# ----------------------------
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    user = db.users.find_one({
        "$or": [{"username": username}, {"email": username}]
    })

    if not user or not bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
        return jsonify({"error": "Invalid credentials"}), 401

    access_payload = {
        "username": user["username"],
        "email": user["email"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    }
    access_token = jwt.encode(access_payload, SECRET_KEY, algorithm="HS256")

    refresh_payload = {
        "username": user["username"],
        "email": user["email"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30)
    }
    refresh_token = jwt.encode(refresh_payload, SECRET_KEY, algorithm="HS256")

    return jsonify({
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresIn": "15m",
        "message": "Login successful",
        "redirectURL": "/dashboard"
    }), 200

# ----------------------------
# ADMIN LOGIN ROUTE (MongoDB)
# ----------------------------
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    try:
        data = request.json
        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return jsonify({"error": "Missing username or password"}), 400

        # ✅ Try both username and email fields
        admin = db.admins.find_one({
            "$or": [{"username": username}, {"email": username}]
        })

        print("🔍 Input username/email:", username)
        print("🔍 Admin found in DB:", admin)

        if not admin:
            return jsonify({"error": "Admin not found"}), 404

        print("🔍 Entered password:", password)
        print("🔍 Stored hash:", admin["password"])
        print("Entered password:", password)
        print("Hash from DB:", admin["password"])
        print("Password check result:", bcrypt.checkpw(password.encode('utf-8'), admin["password"].encode('utf-8')))

        # ✅ Compare hashed passwords
        if not bcrypt.checkpw(password.encode('utf-8'), admin["password"].encode('utf-8')):
            print("❌ Password check failed")
            return jsonify({"error": "Invalid admin credentials"}), 401

        print("✅ Password verified successfully")

        token_payload = {
            "username": admin.get("username"),
            "role": "admin",
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        }
        admin_token = jwt.encode(token_payload, SECRET_KEY, algorithm="HS256")

        return jsonify({
            "message": "Admin login successful",
            "token": admin_token,
            "redirectURL": "admin-dashboard.html"
        }), 200

    except Exception as e:
        print("⚠️ Admin login error:", str(e))
        return jsonify({"error": f"Server error: {str(e)}"}), 500

# ----------------------------
# ADMIN: GET ALL USERS
# ----------------------------
@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    """Admin endpoint to fetch all users from MongoDB"""
    try:
        # Verify admin token
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid token"}), 401

        token = auth_header.split(" ")[1]
        try:
            decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            if decoded.get("role") != "admin":
                return jsonify({"error": "Admin access required"}), 403
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        # Fetch all users from MongoDB
        users = list(db.users.find({}, {"password": 0}))  # Exclude password field
        
        # Convert ObjectId to string for JSON serialization
        for user in users:
            user["_id"] = str(user["_id"])
        
        print(f"✅ Admin fetched {len(users)} users")
        return jsonify({"users": users, "total": len(users)}), 200

    except Exception as e:
        print("❌ Error fetching users:", str(e))
        return jsonify({"error": f"Server error: {str(e)}"}), 500

# ----------------------------
# ADMIN: DELETE USER
# ----------------------------
@app.route('/api/admin/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Admin endpoint to delete a user"""
    try:
        # Verify admin token
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Missing or invalid token"}), 401

        token = auth_header.split(" ")[1]
        try:
            decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            if decoded.get("role") != "admin":
                return jsonify({"error": "Admin access required"}), 403
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        # Delete user from MongoDB
        from bson.objectid import ObjectId
        result = db.users.delete_one({"_id": ObjectId(user_id)})
        
        if result.deleted_count == 0:
            return jsonify({"error": "User not found"}), 404
        
        print(f"✅ Admin deleted user: {user_id}")
        return jsonify({"message": "User deleted successfully"}), 200

    except Exception as e:
        print("❌ Error deleting user:", str(e))
        return jsonify({"error": f"Server error: {str(e)}"}), 500

# ----------------------------
# USER INFO
# ----------------------------
@app.route('/api/me', methods=['GET'])
def get_user_info():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Missing or invalid token"}), 401

    token = auth_header.split(" ")[1]
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username = decoded.get("username")
        email = decoded.get("email")
        return jsonify({"user": {"name": username, "email": email}})
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401

# ----------------------------
# Serve dashboard.html
# ----------------------------
@app.route('/dashboard')
def serve_dashboard():
    return send_from_directory(os.getcwd(), 'dashboard.html')

@app.route('/api/test', methods=['GET'])
def test_connection():
    return jsonify({"message": "✅ Flask connection working fine"}), 200

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify server is running"""
    return jsonify({
        "status": "healthy",
        "message": "Server is running",
        "model_loaded": model is not None
    }), 200

# ----------------------------
# YOLO IMAGE / VIDEO DETECTION (fixed for frontend compatibility)
# ----------------------------
@app.route('/api/detect', methods=['POST'])
def detect_objects():
    try:
        file = request.files.get('file')
        if not file:
            return jsonify({"error": "No file uploaded. Please select a file first."}), 400

        # Validate filename
        if not file.filename:
            return jsonify({"error": "Invalid file. Please select a valid file."}), 400

        # Check file size (500MB limit)
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        max_size = 500 * 1024 * 1024  # 500MB
        if file_size > max_size:
            return jsonify({"error": f"File is too large ({file_size / 1024 / 1024:.2f}MB). Maximum size is 500MB."}), 400

        filename = f"{uuid.uuid4().hex}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Ensure uploads directory exists
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        file.save(filepath)
        
        # Verify file was saved
        if not os.path.exists(filepath):
            return jsonify({"error": "Failed to save uploaded file. Please try again."}), 500
        
        ext = os.path.splitext(filename)[1].lower()

        if ext in ['.jpg', '.jpeg', '.png']:
            # ---- Image detection ----
            results = model(filepath)
            annotated = results[0].plot()

            annotated_filename = f"det_{filename}"
            annotated_path = os.path.join(UPLOAD_FOLDER, annotated_filename)
            annotated_bgr = cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR)
            cv2.imwrite(annotated_path, annotated_bgr)

            detections = []
            for box in results[0].boxes:
                cls_idx = int(box.cls)
                cls_name = model.names.get(cls_idx, str(cls_idx))
                conf = round(float(box.conf), 2)
                detections.append({"class": cls_name, "confidence": conf})

            return jsonify({
                "message": "✅ Image detection complete",
                "file_url": f"/uploads/{annotated_filename}",
                "feed_path": f"uploads/{annotated_filename}",   # ✅ ensure both image and video return this
                "detections": detections
            }), 200

        elif ext in ['.mp4', '.avi', '.mov', '.mkv']:
            # ---- Video detection ----
            annotated_filename = f"det_{filename}"
            annotated_path = os.path.join(UPLOAD_FOLDER, annotated_filename)

            try:
                # ✅ FASTER: Process video directly without saving each frame
                print(f"📹 Processing video: {filename}")
                cap = cv2.VideoCapture(filepath)
                fps = int(cap.get(cv2.CAP_PROP_FPS)) or 25
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                
                print(f"📊 Video info: {width}x{height}, {fps} FPS, {frame_count} frames")
                
                # Use H.264 codec for web compatibility (browsers support this)
                # Try different codecs in order of compatibility
                codecs_to_try = [
                    ('avc1', 'H.264'),
                    ('H264', 'H.264 alt'),
                    ('X264', 'x264'),
                    ('mp4v', 'MPEG-4')
                ]
                
                out = None
                for codec_code, codec_name in codecs_to_try:
                    try:
                        fourcc = cv2.VideoWriter_fourcc(*codec_code)
                        out = cv2.VideoWriter(annotated_path, fourcc, fps, (width, height))
                        if out.isOpened():
                            print(f"✅ Using {codec_name} codec")
                            break
                        else:
                            print(f"⚠️ {codec_name} codec failed, trying next...")
                    except Exception as e:
                        print(f"⚠️ {codec_name} codec error: {e}")
                
                if not out or not out.isOpened():
                    print("❌ Failed to open video writer with any codec")
                    raise Exception("Failed to initialize video writer - no compatible codec found")
                
                processed = 0
                # Process every 3rd frame for better quality/speed balance
                skip_frames = max(1, fps // 10)  # Process 10 frames per second for better quality
                
                try:
                    while cap.isOpened():
                        ret, frame = cap.read()
                        if not ret:
                            break
                        
                        # Skip frames for faster processing
                        if processed % skip_frames == 0:
                            # Run YOLO detection
                            results = model(frame, verbose=False)
                            annotated_frame = results[0].plot()
                            annotated_frame_bgr = cv2.cvtColor(annotated_frame, cv2.COLOR_RGB2BGR)
                            out.write(annotated_frame_bgr)
                        else:
                            # Write original frame without detection
                            out.write(frame)
                        
                        processed += 1
                        
                        # Progress indicator
                        if processed % 30 == 0:
                            progress = (processed / frame_count) * 100 if frame_count > 0 else 0
                            print(f"⏳ Progress: {progress:.1f}% ({processed}/{frame_count} frames)")
                
                except Exception as write_err:
                    print(f"⚠️ Video processing error: {write_err}")
                finally:
                    cap.release()
                    out.release()
                
                if os.path.exists(annotated_path) and os.path.getsize(annotated_path) > 0:
                    print(f"✅ Video processed successfully: {annotated_filename}")
                    return jsonify({
                        "message": "✅ Video detection complete",
                        "file_url": f"/uploads/{annotated_filename}",
                        "feed_path": f"uploads/{annotated_filename}",
                        "detections": []
                    }), 200
                else:
                    print(f"❌ Output file not created or empty")
                    raise Exception("Video processing failed - output file not created")
                
            except cv2.error as cv_err:
                # Handle OpenCV-specific errors
                import traceback
                traceback.print_exc()
                error_msg = str(cv_err)
                if "encoder" in error_msg.lower() or "codec" in error_msg.lower():
                    return jsonify({
                        "error": "Video encoding error. The video format may not be fully supported. Please try converting the video to MP4 format first."
                    }), 500
                else:
                    return jsonify({
                        "error": f"Video processing error: {error_msg}. Please ensure the video file is valid and not corrupted."
                    }), 500
            except Exception as video_err:
                # Handle other video processing errors
                import traceback
                traceback.print_exc()
                error_msg = str(video_err)
                if "memory" in error_msg.lower() or "ram" in error_msg.lower():
                    return jsonify({
                        "error": "Video file is too large or complex. Please try a shorter video or reduce the resolution."
                    }), 500
                else:
                    return jsonify({
                        "error": f"Video processing failed: {error_msg}. Please check the video file and try again."
                    }), 500

        else:
            return jsonify({"error": "Unsupported file type"}), 400

    except cv2.error as cv_err:
        # Handle OpenCV errors specifically
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": f"Image/Video processing error: {str(cv_err)}. Please ensure the file is valid and not corrupted."
        }), 500
    except Exception as e:
        import traceback
        traceback.print_exc()  # ✅ This prints full error to your VS Code terminal
        error_msg = str(e)
        # Provide more user-friendly error messages
        if "No such file" in error_msg or "not found" in error_msg.lower():
            return jsonify({"error": "File not found. Please ensure the file was uploaded correctly."}), 500
        elif "permission" in error_msg.lower():
            return jsonify({"error": "Permission denied. Please check file permissions."}), 500
        elif "timeout" in error_msg.lower():
            return jsonify({"error": "Processing timed out. The file might be too large or complex. Please try a smaller file."}), 500
        else:
            return jsonify({"error": f"Detection error: {error_msg}. Please check the file and try again."}), 500

# ----------------------------
# YOLO Zone Counting (Video)
# ----------------------------
zones = []
latest_counts = []

@app.route('/api/set_zones', methods=['POST'])
def set_zones():
    global zones
    zones = request.json.get("zones", [])
    print(f"📍 Received {len(zones)} zones from frontend:")
    for i, zone in enumerate(zones):
        print(f"   Zone {i+1}: {zone.get('label', 'Unnamed')} with {len(zone.get('points', []))} points")
    return jsonify({"message": "Zones received", "zone_count": len(zones)}), 200

def generate_frames(video_path):
    global latest_counts
    model = YOLO("yolov8n.pt")
    cap = cv2.VideoCapture(video_path)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.resize(frame, (1280, 720))
        results = model(frame, verbose=False)

        boxes = results[0].boxes.xyxy
        cls = results[0].boxes.cls
        names = model.names

        zone_counts = [0] * len(zones)

        for box, c in zip(boxes, cls):
            if names[int(c)] == "person":
                x1, y1, x2, y2 = map(int, box)
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                for i, zone in enumerate(zones):
                    poly = np.array(zone["points"], np.int32)
                    if cv2.pointPolygonTest(poly, (cx, cy), False) >= 0:
                        zone_counts[i] += 1

        # Store counts globally for frontend polling
        latest_counts = zone_counts.copy()

        # Draw zones and counts
        for i, zone in enumerate(zones):
            poly = np.array(zone["points"], np.int32)
            cv2.polylines(frame, [poly], True, (255, 255, 0), 2)
            x, y = zone["points"][0]
            cv2.putText(frame, f"People: {zone_counts[i]}", (x, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 255), 2)

        _, buffer = cv2.imencode('.jpg', frame)
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

    cap.release()

@app.route('/api/video_feed')
def video_feed():
    video_path = request.args.get('path')
    if not video_path or not os.path.exists(video_path):
        return jsonify({"error": "Video path invalid"}), 400

    return Response(generate_frames(video_path),
                    mimetype='multipart/x-mixed-replace; boundary=frame')
                    
@app.route('/api/refresh', methods=['POST'])
def refresh_token():
    data = request.json
    refresh_token = data.get("refreshToken")
    if not refresh_token:
        return jsonify({"error": "Missing refresh token"}), 400

    try:
        decoded = jwt.decode(refresh_token, SECRET_KEY, algorithms=["HS256"])
        new_payload = {
            "username": decoded.get("username"),
            "email": decoded.get("email"),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
        }
        new_access_token = jwt.encode(new_payload, SECRET_KEY, algorithm="HS256")
        return jsonify({
            "accessToken": new_access_token,
            "expiresIn": "15m"
        }), 200
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Refresh token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid refresh token"}), 401


# ----------------------------
# LIVE COUNTS API (frontend polls every 2s)
# ----------------------------
@app.route('/api/live_counts')
def live_counts():
    global latest_counts
    return jsonify({"counts": latest_counts}), 200

from threading import Thread, Event

analysis_thread = None
stop_event = Event()
video_path_global = None

def analyze_video_background(video_path):
    global latest_counts, zones
    
    print(f"🎬 Starting background analysis for: {video_path}")
    print(f"📊 Number of zones: {len(zones)}")
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Failed to open video: {video_path}")
        return
    
    frame_width = 1280
    frame_height = 720
    frame_count = 0
    
    while not stop_event.is_set():
        ret, frame = cap.read()
        if not ret:
            print(f"📹 End of video reached after {frame_count} frames")
            # Loop the video for continuous counting
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        frame = cv2.resize(frame, (frame_width, frame_height))
        results = model(frame, verbose=False)
        boxes = results[0].boxes.xyxy
        cls = results[0].boxes.cls
        names = model.names

        zone_counts = [0] * len(zones)
        total_people = 0
        people_positions = []  # For debugging

        for box, c in zip(boxes, cls):
            if names[int(c)] == "person":
                total_people += 1
                x1, y1, x2, y2 = map(int, box)
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                people_positions.append((cx, cy))
                
                # Check each zone
                for i, zone in enumerate(zones):
                    # Convert normalized coordinates to pixel coordinates
                    points = zone["points"]
                    pixel_points = []
                    for point in points:
                        px = int(point[0] * frame_width)
                        py = int(point[1] * frame_height)
                        pixel_points.append([px, py])
                    
                    poly = np.array(pixel_points, np.int32)
                    # Test if person center is inside this zone
                    test_result = cv2.pointPolygonTest(poly, (cx, cy), False)
                    if test_result >= 0:
                        zone_counts[i] += 1

        latest_counts = zone_counts.copy()
        frame_count += 1
        
        # Log every 30 frames (once per second at 30fps)
        if frame_count % 30 == 0:
            print(f"👥 Frame {frame_count}: Total people: {total_people}, Counts per zone: {zone_counts}")
            if frame_count == 30:  # Detailed debug on first log
                print(f"🔍 DEBUG - First person position: {people_positions[0] if people_positions else 'No people detected'}")
                if len(zones) > 0:
                    print(f"🔍 DEBUG - First zone pixel points: {[[int(p[0]*frame_width), int(p[1]*frame_height)] for p in zones[0]['points']]}")
        
        # Sleep to reduce CPU usage
        cv2.waitKey(33)  # ~30fps

    cap.release()
    print(f"🛑 Analysis stopped after {frame_count} frames")

@app.route("/api/start_analysis", methods=["POST"])
def start_analysis():
    global analysis_thread, stop_event, video_path_global
    data = request.get_json()
    video_path_global = data.get("feed_path")

    if not video_path_global or not os.path.exists(video_path_global):
        return jsonify({"error": "Invalid or missing feed_path"}), 400

    if analysis_thread and analysis_thread.is_alive():
        return jsonify({"message": "Analysis already running"}), 200

    stop_event.clear()
    analysis_thread = Thread(target=analyze_video_background, args=(video_path_global,))
    analysis_thread.start()
    print(f"🎬 Started analysis on {video_path_global}")
    return jsonify({"message": "Analysis started"}), 200

@app.route("/api/stop_analysis", methods=["POST"])
def stop_analysis():
    global stop_event, analysis_thread
    if analysis_thread and analysis_thread.is_alive():
        stop_event.set()
        analysis_thread.join()
    return jsonify({"message": "Analysis stopped"}), 200

# ----------------------------
# MAIN ENTRY
# ----------------------------
if __name__ == '__main__':
    app.run(port=5000, debug=True, use_reloader=False)











