from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import time
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)

# ========== CONFIGURATION ==========
CONFIG = {
    "adminUsername": "ANSHAFT127987",
    "adminPassword": "ANSHAFTAK47",
    "rateLimit": {
        "user": {"perMinute": 100, "perDay": 1000},
        "owner": {"perMinute": 10000, "perDay": 100000},
        "free": {"perMinute": 10, "perDay": 100}
    },
    "apiStatus": "online",
    "version": "3.0.0",
    "maintenance": False
}

# ========== IN-MEMORY STORAGE ==========
users = {
    "ANSHAFT127987": {
        "apiKey": "ANSHAFTAK472026",
        "plan": "owner",
        "minuteRequests": 0,
        "dayRequests": 0,
        "lastMinuteReset": int(time.time() * 1000),
        "lastDayReset": int(time.time() * 1000),
        "status": "active"
    },
    "DEMO_USER": {
        "apiKey": "DEMOFUCK",
        "plan": "user",
        "minuteRequests": 0,
        "dayRequests": 0,
        "lastMinuteReset": int(time.time() * 1000),
        "lastDayReset": int(time.time() * 1000),
        "status": "active"
    }
}

system_stats = {"totalRequests": 0, "startTime": int(time.time() * 1000)}

# ========== HELPER FUNCTIONS ==========
def check_and_reset_limits(user):
    now = int(time.time() * 1000)
    if now - user["lastMinuteReset"] > 60000:
        user["minuteRequests"] = 0
        user["lastMinuteReset"] = now
    if now - user["lastDayReset"] > 86400000:
        user["dayRequests"] = 0
        user["lastDayReset"] = now

def validate_api_key(api_key):
    if CONFIG["maintenance"]:
        return None, {"error": "API Under Maintenance", "status": 503}
    
    if CONFIG["apiStatus"] == "offline":
        return None, {"error": "API Offline", "status": 503}
    
    if not api_key:
        return None, {"error": "API Key Required", "status": 401}
    
    user = None
    username = None
    
    for key, value in users.items():
        if value["apiKey"] == api_key:
            user = value
            username = key
            break
    
    if not user:
        return None, {"error": "Invalid API Key", "status": 403}
    
    if user["status"] == "suspended":
        return None, {"error": "Account Suspended", "status": 403}
    
    check_and_reset_limits(user)
    
    limits = CONFIG["rateLimit"][user["plan"]]
    
    if user["minuteRequests"] >= limits["perMinute"]:
        return None, {"error": f"Rate Limit: {limits['perMinute']}/minute", "status": 429}
    
    if user["dayRequests"] >= limits["perDay"]:
        return None, {"error": f"Rate Limit: {limits['perDay']}/day", "status": 429}
    
    user["minuteRequests"] += 1
    user["dayRequests"] += 1
    system_stats["totalRequests"] += 1
    
    return {"username": username, **user}, None

# ========== API ENDPOINTS ==========

@app.route('/', methods=['GET'])
def home():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>🚗 Vehicle API</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                background: #0a0a0a; 
                color: #00ff41; 
                font-family: 'Courier New', monospace; 
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .container {
                background: rgba(0,0,0,0.9);
                padding: 50px;
                border-radius: 20px;
                border: 1px solid #00ff4133;
                max-width: 600px;
                text-align: center;
                box-shadow: 0 0 50px #00ff4110;
            }
            h1 { 
                font-size: 3em; 
                text-shadow: 0 0 20px #00ff41;
                margin-bottom: 10px;
            }
            .subtitle { opacity: 0.5; font-size: 0.8em; margin-bottom: 30px; }
            .endpoint {
                background: rgba(0,0,0,0.5);
                padding: 15px;
                border-radius: 10px;
                margin: 10px 0;
                border: 1px solid #00ff4120;
            }
            .endpoint code { font-size: 0.8em; word-break: break-all; }
            a { color: #00ff41; text-decoration: none; }
            .footer { margin-top: 30px; opacity: 0.3; font-size: 0.7em; }
            .badge {
                display: inline-block;
                padding: 3px 12px;
                border-radius: 20px;
                background: #00ff41;
                color: #000;
                font-size: 0.7em;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚗 VEHICLE API</h1>
            <p class="subtitle">STATUS: <span class="badge">● ONLINE</span></p>
            
            <div class="endpoint">
                <strong>📊 Status</strong><br>
                <code>GET /api/status</code>
            </div>
            
            <div class="endpoint">
                <strong>🔍 Vehicle Info</strong><br>
                <code>GET /api/vehicle-info?rc=DL10AB1234&api_key=DEMOFUCK</code>
            </div>
            
            <div class="endpoint">
                <strong>🔐 Admin Login</strong><br>
                <code>GET /token?username=ANSHAFT127987&password=ANSHAFTAK47</code>
            </div>
            
            <div class="footer">
                MADE BY <a href="https://t.me/premium_dark_33">ANSH AFT</a> | v3.0
            </div>
        </div>
    </body>
    </html>
    '''

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({
        "status": CONFIG["apiStatus"],
        "version": CONFIG["version"],
        "uptime": int((time.time() * 1000 - system_stats["startTime"]) / 1000),
        "total_requests": system_stats["totalRequests"],
        "total_users": len(users),
        "maintenance": CONFIG["maintenance"],
        "timestamp": datetime.now().isoformat(),
        "MADE_BY": "ANSH AFT",
        "CHANNEL": "https://t.me/premium_dark_33"
    })

@app.route('/api/vehicle-info', methods=['GET'])
def vehicle_info():
    try:
        # Get API key
        api_key = request.args.get('api_key') or request.headers.get('x-api-key')
        user, error = validate_api_key(api_key)
        
        if error:
            return jsonify(error), error.get("status", 403)
        
        # Get RC number
        rc = request.args.get('rc')
        
        if not rc:
            return jsonify({
                "success": False,
                "message": "RC number parameter is required",
                "MADE_BY": "ANSH AFT",
                "CHANNEL": "https://t.me/premium_dark_33",
                "USERNAME": "@KINGFFAIAK47x",
                "API_VERSION": CONFIG["version"],
                "REQUEST_BY": user["username"],
                "PLAN": user["plan"]
            }), 400
        
        # Validate RC format
        import re
        if not re.match(r'^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{1,4}$', rc.upper()):
            return jsonify({
                "success": False,
                "message": "Invalid RC number format",
                "MADE_BY": "ANSH AFT",
                "CHANNEL": "https://t.me/premium_dark_33"
            }), 400
        
        # Call external API with timeout
        try:
            response = requests.get(
                f"https://vehicleinfobyterabaap.vercel.app/lookup?rc={rc.upper()}",
                timeout=10
            )
            
            if response.status_code != 200:
                return jsonify({
                    "success": False,
                    "message": "External API error",
                    "status_code": response.status_code,
                    "MADE_BY": "ANSH AFT"
                }), 502
            
            data = response.json()
            
            # Remove copyright
            if "copyright" in data:
                del data["copyright"]
            
            # Add metadata
            data["MADE_BY"] = "ANSH AFT"
            data["CHANNEL"] = "https://t.me/premium_dark_33"
            data["USERNAME"] = "@KINGFFAIAK47x"
            data["API_VERSION"] = CONFIG["version"]
            data["REQUEST_BY"] = user["username"]
            data["PLAN"] = user["plan"]
            data["REMAINING_MINUTE"] = CONFIG["rateLimit"][user["plan"]]["perMinute"] - user["minuteRequests"]
            data["REMAINING_DAY"] = CONFIG["rateLimit"][user["plan"]]["perDay"] - user["dayRequests"]
            
            return jsonify(data)
            
        except requests.Timeout:
            return jsonify({
                "success": False,
                "message": "External API timeout (10 seconds)",
                "MADE_BY": "ANSH AFT"
            }), 504
        except requests.RequestException as e:
            return jsonify({
                "success": False,
                "message": f"External API error: {str(e)}",
                "MADE_BY": "ANSH AFT"
            }), 502
            
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Internal error: {str(e)}",
            "MADE_BY": "ANSH AFT"
        }), 500

@app.route('/token', methods=['GET'])
def token():
    try:
        username = request.args.get('username')
        password = request.args.get('password')
        
        if username == CONFIG["adminUsername"] and password == CONFIG["adminPassword"]:
            # Generate user table HTML
            user_rows = []
            for k, v in users.items():
                plan_class = "owner" if v["plan"] == "owner" else "user" if v["plan"] == "user" else "free"
                user_rows.append(f'''
                    <tr>
                        <td>{k}</td>
                        <td><span class="badge badge-{plan_class}">{v["plan"].upper()}</span></td>
                        <td>{v["minuteRequests"]}/{v["dayRequests"]}</td>
                        <td><span class="badge badge-{v["status"]}">{v["status"].upper()}</span></td>
                    </tr>
                ''')
            
            return f'''
            <!DOCTYPE html>
            <html>
            <head>
                <title>🚗 Admin Panel</title>
                <style>
                    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                    body {{
                        background: #0a0a0a;
                        color: #00ff41;
                        font-family: 'Courier New', monospace;
                        padding: 20px;
                    }}
                    .container {{ max-width: 1200px; margin: auto; }}
                    h1 {{ text-shadow: 0 0 20px #00ff41; margin-bottom: 20px; }}
                    .stats {{
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 15px;
                        margin-bottom: 30px;
                    }}
                    .stat-card {{
                        background: rgba(0,0,0,0.8);
                        padding: 20px;
                        border-radius: 15px;
                        text-align: center;
                        border: 1px solid #00ff4133;
                    }}
                    .stat-card .number {{ font-size: 2em; font-weight: bold; }}
                    .stat-card .label {{ font-size: 0.7em; opacity: 0.7; }}
                    .table-container {{
                        background: rgba(0,0,0,0.8);
                        padding: 20px;
                        border-radius: 15px;
                        border: 1px solid #00ff4133;
                        overflow-x: auto;
                    }}
                    table {{ width: 100%; border-collapse: collapse; }}
                    th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #00ff4120; }}
                    th {{ opacity: 0.7; font-size: 0.8em; }}
                    .badge {{
                        padding: 3px 12px;
                        border-radius: 20px;
                        font-size: 0.7em;
                        font-weight: bold;
                    }}
                    .badge-owner {{ background: #ffd700; color: #000; }}
                    .badge-user {{ background: #00ff41; color: #000; }}
                    .badge-free {{ background: #555; color: #fff; }}
                    .badge-active {{ background: #00ff41; color: #000; }}
                    .badge-suspended {{ background: #ff0044; color: #fff; }}
                    .logout {{
                        display: inline-block;
                        padding: 10px 20px;
                        background: #ff004488;
                        border-radius: 10px;
                        color: #fff;
                        text-decoration: none;
                        margin-top: 20px;
                    }}
                    .logout:hover {{ background: #ff0044; }}
                    .footer {{ margin-top: 30px; opacity: 0.3; text-align: center; font-size: 0.7em; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🚗 ADMIN PANEL</h1>
                    
                    <div class="stats">
                        <div class="stat-card">
                            <div class="number">{len(users)}</div>
                            <div class="label">👤 TOTAL USERS</div>
                        </div>
                        <div class="stat-card">
                            <div class="number">{system_stats["totalRequests"]}</div>
                            <div class="label">📊 REQUESTS</div>
                        </div>
                        <div class="stat-card">
                            <div class="number">{len([u for u in users.values() if u["plan"] == "owner"])}</div>
                            <div class="label">👑 OWNERS</div>
                        </div>
                        <div class="stat-card">
                            <div class="number">{len([u for u in users.values() if u["plan"] == "user"])}</div>
                            <div class="label">⭐ USERS</div>
                        </div>
                    </div>
                    
                    <div class="table-container">
                        <h3>👥 Users</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>USERNAME</th>
                                    <th>PLAN</th>
                                    <th>REQUESTS (MIN/DAY)</th>
                                    <th>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {''.join(user_rows)}
                            </tbody>
                        </table>
                    </div>
                    
                    <a href="/" class="logout">🚪 LOGOUT</a>
                    
                    <div class="footer">
                        MADE BY <a href="https://t.me/premium_dark_33" style="color:#00ff41;">ANSH AFT</a> | v3.0
                    </div>
                </div>
            </body>
            </html>
            '''
        else:
            return '''
            <!DOCTYPE html>
            <html>
            <head>
                <title>❌ Login Failed</title>
                <style>
                    body { background: #0a0a0a; color: #ff0044; font-family: monospace; text-align: center; padding: 50px; }
                    h1 { font-size: 3em; }
                    a { color: #00ff41; text-decoration: none; }
                </style>
            </head>
            <body>
                <h1>❌ Invalid Credentials</h1>
                <p><a href="/">← Go Back</a></p>
            </body>
            </html>
            ''', 401
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ========== ERROR HANDLERS ==========

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "success": False,
        "message": "Route not found",
        "available_endpoints": {
            "Home": "/",
            "Status": "/api/status",
            "Vehicle Info": "/api/vehicle-info?rc=DL10AB1234&api_key=DEMOFUCK",
            "Admin": "/token?username=ANSHAFT127987&password=ANSHAFTAK47"
        },
        "MADE_BY": "ANSH AFT"
    }), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({
        "success": False,
        "message": "Internal server error",
        "MADE_BY": "ANSH AFT"
    }), 500

# ========== FOR VERCEL ==========
app.debug = False

# ========== FOR LOCAL TESTING ==========
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=3000)
