from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from pymongo import MongoClient
import jwt, datetime, bcrypt, os, cv2, uuid
from ultralytics import YOLO
import numpy as np
import secrets
SECRET_KEY = secrets.token_hex(32)
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
    """Serve uploaded or annotated files"""
    return send_from_directory(UPLOAD_FOLDER, filename)


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

# ----------------------------
# YOLO IMAGE DETECTION (robust)
# ----------------------------
@app.route('/api/detect', methods=['POST'])
def detect_objects():
    file = request.files.get('file')
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    filename = f"{uuid.uuid4().hex}_{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    ext = os.path.splitext(filename)[1].lower()

    try:
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
                "detections": detections
            }), 200

        elif ext in ['.mp4', '.avi', '.mov', '.mkv']:
            # ---- Video detection ----
            annotated_filename = f"det_{filename}"
            annotated_path = os.path.join(UPLOAD_FOLDER, annotated_filename)

            # Stream detection output directly to file
            model.predict(
                source=filepath,
                save=True,
                save_txt=False,
                project=UPLOAD_FOLDER,
                name="",  # saves directly into uploads folder
                exist_ok=True
            )

            return jsonify({
                "message": "✅ Video detection complete",
                "file_url": f"/uploads/{annotated_filename}",
                "detections": []
            }), 200

        else:
            return jsonify({"error": "Unsupported file type"}), 400

    except Exception as e:
        return jsonify({"error": f"Detection error: {str(e)}"}), 500
# ----------------------------
# YOLO Zone Counting (Video)
# ----------------------------
zones = []
latest_counts = []

@app.route('/api/set_zones', methods=['POST'])
def set_zones():
    global zones
    zones = request.json.get("zones", [])
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

# ----------------------------
# MAIN ENTRY
# ----------------------------
if __name__ == '__main__':
    app.run(port=3000, debug=True, use_reloader=False)











