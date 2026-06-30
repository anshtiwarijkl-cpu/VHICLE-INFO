const express = require('express');
const app = express();

// ========== CORS ==========
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ========== CONFIGURATION ==========
let CONFIG = {
  adminUsername: 'ANSHAFT127987',
  adminPassword: 'ANSHAFTAK47',
  rateLimit: {
    user: { perMinute: 100, perDay: 1000 },
    owner: { perMinute: 10000, perDay: 100000 },
    free: { perMinute: 10, perDay: 100 }
  },
  apiStatus: 'online',
  version: '3.0.0',
  theme: {
    background: '#0a0a0a',
    color: '#00ff41',
    glowColor: '#00ff41'
  },
  maintenance: false,
  logsEnabled: true
};

// ========== DATA STORAGE ==========
let users = {
  'ANSHAFT127987': {
    apiKey: 'ANSHAFTAK472026',
    plan: 'owner',
    minuteRequests: 0,
    dayRequests: 0,
    lastMinuteReset: Date.now(),
    lastDayReset: Date.now(),
    createdAt: Date.now(),
    status: 'active'
  },
  'DEMO_USER': {
    apiKey: 'DEMOFUCK',
    plan: 'user',
    minuteRequests: 0,
    dayRequests: 0,
    lastMinuteReset: Date.now(),
    lastDayReset: Date.now(),
    createdAt: Date.now(),
    status: 'active'
  }
};

let usageLogs = [];
let systemStats = { totalRequests: 0, startTime: Date.now() };
let failedLogins = [];
let announcements = [];

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== CHECK AND RESET LIMITS ==========
function checkAndResetLimits(user) {
  const now = Date.now();
  const oneMinute = 60000;
  const oneDay = 86400000;
  
  if (now - user.lastMinuteReset > oneMinute) {
    user.minuteRequests = 0;
    user.lastMinuteReset = now;
  }
  
  if (now - user.lastDayReset > oneDay) {
    user.dayRequests = 0;
    user.lastDayReset = now;
  }
}

// ========== API KEY VALIDATION ==========
function validateApiKey(req, res, next) {
  if (CONFIG.maintenance) {
    return res.status(503).json({
      error: 'API Under Maintenance',
      message: 'We are currently upgrading our systems.',
      contact: '@KINGFFAIAK47x'
    });
  }
  
  if (CONFIG.apiStatus === 'offline') {
    return res.status(503).json({
      error: 'API Offline',
      message: 'API is currently disabled.',
      contact: '@KINGFFAIAK47x'
    });
  }

  const apiKey = req.query.api_key || req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API Key Required',
      message: 'Please provide api_key parameter',
      get_key: 'Contact @KINGFFAIAK47x'
    });
  }

  let user = null;
  let username = null;
  for (const [key, value] of Object.entries(users)) {
    if (value.apiKey === apiKey) {
      user = value;
      username = key;
      break;
    }
  }

  if (!user) {
    return res.status(403).json({
      error: 'Invalid API Key',
      message: 'The API key provided is not valid',
      support: 'https://t.me/premium_dark_33'
    });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({
      error: 'Account Suspended',
      message: 'Your account has been suspended.',
      support: 'https://t.me/premium_dark_33'
    });
  }

  checkAndResetLimits(user);

  let limits;
  if (user.plan === 'owner') {
    limits = CONFIG.rateLimit.owner;
  } else if (user.plan === 'user') {
    limits = CONFIG.rateLimit.user;
  } else {
    limits = CONFIG.rateLimit.free;
  }

  if (user.minuteRequests >= limits.perMinute) {
    return res.status(429).json({
      error: 'Rate Limit Exceeded (Minute)',
      message: 'You have exceeded ' + limits.perMinute + ' requests per minute',
      plan: user.plan,
      reset_in: Math.ceil((user.lastMinuteReset + 60000 - Date.now()) / 1000) + ' seconds'
    });
  }

  if (user.dayRequests >= limits.perDay) {
    return res.status(429).json({
      error: 'Rate Limit Exceeded (Daily)',
      message: 'You have exceeded ' + limits.perDay + ' requests per day',
      plan: user.plan,
      reset_at: new Date(user.lastDayReset + 86400000).toISOString()
    });
  }

  user.minuteRequests++;
  user.dayRequests++;
  systemStats.totalRequests++;
  
  if (CONFIG.logsEnabled) {
    usageLogs.push({
      username: username,
      apiKey: apiKey.substring(0, 8) + '...',
      timestamp: new Date().toISOString(),
      ip: req.query.ip || 'self',
      plan: user.plan
    });
  }

  if (usageLogs.length > 1000) {
    usageLogs = usageLogs.slice(-500);
  }

  req.user = { username: username, ...user };
  next();
}

// ========== MAIN API - VEHICLE INFO ==========
app.get('/api/vehicle-info', validateApiKey, async (req, res) => {
  try {
    const rc = req.query.rc;
    
    if (!rc) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'RC number parameter is required. Please provide correct RC number',
        MADE_BY: 'ANSH AFT',
        CHANNEL: 'https://t.me/premium_dark_33',
        USERNAME: '@KINGFFAIAK47x',
        API_VERSION: CONFIG.version,
        REQUEST_BY: req.user.username,
        PLAN: req.user.plan,
        REMAINING_MINUTE: CONFIG.rateLimit[req.user.plan].perMinute - req.user.minuteRequests,
        REMAINING_DAY: CONFIG.rateLimit[req.user.plan].perDay - req.user.dayRequests,
        RESET_TIME: new Date(req.user.lastDayReset + 86400000).toISOString()
      });
    }

    // Validate RC number format (DL10AB1234 format)
    const rcRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{1,4}$/;
    if (!rcRegex.test(rc.toUpperCase())) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'Invalid RC number format. Please provide a valid RC number (e.g., DL10AB1234)',
        MADE_BY: 'ANSH AFT',
        CHANNEL: 'https://t.me/premium_dark_33',
        USERNAME: '@KINGFFAIAK47x',
        API_VERSION: CONFIG.version,
        REQUEST_BY: req.user.username,
        PLAN: req.user.plan,
        REMAINING_MINUTE: CONFIG.rateLimit[req.user.plan].perMinute - req.user.minuteRequests,
        REMAINING_DAY: CONFIG.rateLimit[req.user.plan].perDay - req.user.dayRequests,
        RESET_TIME: new Date(req.user.lastDayReset + 86400000).toISOString()
      });
    }

    // Call the vehicle info API
    const response = await fetch('https://vehicleinfobyterabaap.vercel.app/lookup?rc=' + encodeURIComponent(rc.toUpperCase()));
    const data = await response.json();
    
    // Add metadata to the response
    data.MADE_BY = 'ANSH AFT';
    data.CHANNEL = 'https://t.me/premium_dark_33';
    data.USERNAME = '@KINGFFAIAK47x';
    data.API_VERSION = CONFIG.version;
    data.REQUEST_BY = req.user.username;
    data.PLAN = req.user.plan;
    data.REMAINING_MINUTE = CONFIG.rateLimit[req.user.plan].perMinute - req.user.minuteRequests;
    data.REMAINING_DAY = CONFIG.rateLimit[req.user.plan].perDay - req.user.dayRequests;
    data.RESET_TIME = new Date(req.user.lastDayReset + 86400000).toISOString();
    
    res.json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 500,
      error: 'Internal Server Error',
      message: error.message,
      support: 'https://t.me/premium_dark_33'
    });
  }
});

// ========== API STATUS ==========
app.get('/api/status', (req, res) => {
  res.json({
    status: CONFIG.apiStatus,
    version: CONFIG.version,
    uptime: Math.floor((Date.now() - systemStats.startTime) / 1000),
    total_requests: systemStats.totalRequests,
    total_users: Object.keys(users).length,
    maintenance: CONFIG.maintenance,
    timestamp: new Date().toISOString()
  });
});

// ========== ROOT - DIRECT LOGIN PAGE ==========
app.get('/', (req, res) => {
  res.send(getLoginPageHTML());
});

// ========== TOKEN ROUTE - ADMIN AUTH ==========
app.get('/token', (req, res) => {
  const { username, password } = req.query;
  
  if (username && password && username === CONFIG.adminUsername && password === CONFIG.adminPassword) {
    res.send(getAdminPanelHTML());
  } else {
    res.send(getLoginPageHTML('❌ Invalid credentials! Please try again.'));
  }
});

// ========== LOGIN PAGE HTML ==========
function getLoginPageHTML(error = '') {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>🔥 DARK LOGIN</title>
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
    .login-container {
      background: rgba(0,0,0,0.9);
      padding: 50px;
      border-radius: 20px;
      border: 1px solid #00ff4133;
      max-width: 450px;
      width: 100%;
      box-shadow: 0 0 50px #00ff4110;
    }
    .glow { text-shadow: 0 0 20px #00ff41; }
    .login-container h1 {
      font-size: 2.5em;
      text-align: center;
      margin-bottom: 5px;
    }
    .subtitle {
      text-align: center;
      opacity: 0.5;
      font-size: 0.8em;
      margin-bottom: 30px;
    }
    .input-group {
      margin: 15px 0;
    }
    .input-group label {
      display: block;
      font-size: 0.8em;
      opacity: 0.7;
      margin-bottom: 5px;
    }
    .input-group input {
      width: 100%;
      padding: 14px;
      background: rgba(0,0,0,0.5);
      border: 1px solid #00ff4150;
      border-radius: 10px;
      color: #00ff41;
      font-size: 1em;
      font-family: 'Courier New', monospace;
      transition: 0.3s;
    }
    .input-group input:focus {
      outline: none;
      border-color: #00ff41;
      box-shadow: 0 0 20px #00ff4133;
    }
    .login-btn {
      width: 100%;
      padding: 14px;
      background: #00ff41;
      border: none;
      border-radius: 10px;
      color: #000;
      font-weight: bold;
      font-size: 1.1em;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      margin-top: 10px;
      transition: 0.3s;
    }
    .login-btn:hover {
      box-shadow: 0 0 40px #00ff4166;
      transform: scale(1.02);
    }
    .error {
      color: #ff0044;
      text-align: center;
      padding: 10px;
      border: 1px solid #ff004433;
      border-radius: 8px;
      margin-bottom: 15px;
      font-size: 0.9em;
    }
    .footer {
      text-align: center;
      margin-top: 25px;
      opacity: 0.3;
      font-size: 0.7em;
    }
    .footer a {
      color: #00ff41;
      text-decoration: none;
    }
    .api-info {
      margin-top: 20px;
      padding: 15px;
      background: rgba(0,0,0,0.3);
      border-radius: 10px;
      font-size: 0.7em;
      opacity: 0.5;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <h1 class="glow">🔥 DARK</h1>
    <p class="subtitle">ADMIN CONTROL PANEL</p>
    
    ${error ? '<div class="error">' + error + '</div>' : ''}
    
    <form id="loginForm" method="GET" action="/token">
      <div class="input-group">
        <label>👤 USERNAME</label>
        <input type="text" name="username" placeholder="Enter username" value="" required>
      </div>
      <div class="input-group">
        <label>🔑 PASSWORD</label>
        <input type="password" name="password" placeholder="Enter password" value="" required>
      </div>
      <button type="submit" class="login-btn">▶ LOGIN</button>
    </form>
    
    <div class="api-info">
      <p>📌 Vehicle Info API | Made by ANSH AFT</p>
    </div>
    
    <div class="footer">
      MADE BY <a href="https://t.me/premium_dark_33">ANSH AFT</a> | v3.0
    </div>
  </div>
</body>
</html>
  `;
}

// ========== ADMIN PANEL HTML ==========
function getAdminPanelHTML() {
  const bg = CONFIG.theme.background;
  const color = CONFIG.theme.color;
  const glow = CONFIG.theme.glowColor;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>🔥 DARK CONTROL PANEL</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      background: ${bg};
      color: ${color};
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .glow { text-shadow: 0 0 10px ${glow}; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      background: rgba(0,0,0,0.8);
      border-radius: 15px;
      margin-bottom: 30px;
      border: 1px solid ${color}30;
      flex-wrap: wrap;
      gap: 10px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: rgba(0,0,0,0.8);
      padding: 20px;
      border-radius: 15px;
      text-align: center;
      border: 1px solid ${color}30;
    }
    .stat-card .number { font-size: 2.5em; font-weight: 900; color: ${color}; }
    .stat-card .label { font-size: 0.7em; opacity: 0.7; }
    .controls-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .control-card {
      background: rgba(0,0,0,0.8);
      padding: 20px;
      border-radius: 15px;
      border: 1px solid ${color}30;
    }
    .control-card h3 { color: ${color}; margin-bottom: 12px; font-size: 1em; }
    .control-card input, .control-card select {
      width: 100%;
      padding: 10px;
      margin: 5px 0;
      background: rgba(0,0,0,0.5);
      border: 1px solid ${color}50;
      border-radius: 8px;
      color: ${color};
      font-family: 'Courier New', monospace;
    }
    .control-card button {
      padding: 8px 15px;
      margin: 5px 5px 5px 0;
      background: ${color};
      border: none;
      border-radius: 8px;
      color: #000;
      font-weight: bold;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 0.8em;
    }
    .control-card button:hover { box-shadow: 0 0 20px ${color}60; }
    .control-card button.danger { background: #ff0044; color: #fff; }
    .control-card button.warning { background: #ff8800; color: #000; }
    .table-container {
      background: rgba(0,0,0,0.8);
      padding: 20px;
      border-radius: 15px;
      margin-bottom: 30px;
      border: 1px solid ${color}30;
      overflow-x: auto;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid ${color}20; font-size: 0.8em; }
    th { color: ${color}; font-size: 0.7em; opacity: 0.8; }
    .badge {
      padding: 2px 12px;
      border-radius: 20px;
      font-size: 0.7em;
    }
    .badge-owner { background: #ffd700; color: #000; }
    .badge-user { background: ${color}; color: #000; }
    .badge-free { background: #555; color: #fff; }
    .badge-active { background: ${color}; color: #000; }
    .badge-suspended { background: #ff0044; color: #fff; }
    .action-btn {
      padding: 4px 8px;
      margin: 2px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 0.6em;
    }
    .action-btn.danger { background: #ff0044; color: #fff; }
    .action-btn.warning { background: #ff8800; color: #000; }
    .logout-btn {
      padding: 8px 20px;
      background: #ff004488;
      border: none;
      border-radius: 10px;
      color: #fff;
      font-family: 'Courier New', monospace;
      cursor: pointer;
      text-decoration: none;
    }
    .logout-btn:hover { background: #ff0044; }
    .flex-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .mt-10 { margin-top: 10px; }
    .color-picker { width: 60px !important; height: 45px; padding: 0 !important; cursor: pointer; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div><h1 class="glow">🔥 DARK CONTROL</h1><p style="font-size:0.6em; opacity:0.5;">MADE BY ANSH AFT | v3.0</p></div>
    <div class="flex-row">
      <span id="apiStatusText" style="font-size:0.7em;">● ONLINE</span>
      <span id="maintenanceText" style="font-size:0.7em;"></span>
      <a href="/" class="logout-btn">🚪 LOGOUT</a>
      <button class="home-btn" onclick="location.reload()" style="padding:8px 20px;background:${color}33;border:1px solid ${color};border-radius:10px;color:${color};cursor:pointer;">🔄 REFRESH</button>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card"><div class="number" id="totalUsers">0</div><div class="label">👤 TOTAL USERS</div></div>
    <div class="stat-card"><div class="number" id="totalRequests">0</div><div class="label">📊 TOTAL REQUESTS</div></div>
    <div class="stat-card"><div class="number" id="ownerUsers">0</div><div class="label">👑 OWNERS</div></div>
    <div class="stat-card"><div class="number" id="userUsers">0</div><div class="label">⭐ USERS</div></div>
    <div class="stat-card"><div class="number" id="freeUsers">0</div><div class="label">🆓 FREE USERS</div></div>
    <div class="stat-card"><div class="number" id="uptime">0</div><div class="label">⏱ UPTIME (s)</div></div>
  </div>

  <div class="controls-grid">
    <div class="control-card">
      <h3>🔧 API CONTROL</h3>
      <select id="apiStatusSelect">
        <option value="online">● ONLINE</option>
        <option value="maintenance">⚠ MAINTENANCE</option>
        <option value="offline">✖ OFFLINE</option>
      </select>
      <button onclick="updateApiStatus()">APPLY</button>
      <button class="warning" onclick="toggleMaintenance()">🛠 TOGGLE MAINTENANCE</button>
    </div>

    <div class="control-card">
      <h3>⚡ CHANGE API KEYS</h3>
      <input type="text" id="ownerKey" placeholder="Owner API Key" value="ANSHAFTAK472026">
      <input type="text" id="userKey" placeholder="User API Key" value="DEMOFUCK">
      <input type="text" id="freeKey" placeholder="Free API Key" value="FREEUSER2026">
      <button onclick="updateApiKeys()">UPDATE KEYS</button>
    </div>

    <div class="control-card">
      <h3>📊 CHANGE LIMITS</h3>
      <div class="flex-row">
        <input type="number" id="ownerMin" placeholder="OWNER/MIN" value="10000" style="width:48%;">
        <input type="number" id="ownerDay" placeholder="OWNER/DAY" value="100000" style="width:48%;">
      </div>
      <div class="flex-row">
        <input type="number" id="userMin" placeholder="USER/MIN" value="100" style="width:48%;">
        <input type="number" id="userDay" placeholder="USER/DAY" value="1000" style="width:48%;">
      </div>
      <div class="flex-row">
        <input type="number" id="freeMin" placeholder="FREE/MIN" value="10" style="width:48%;">
        <input type="number" id="freeDay" placeholder="FREE/DAY" value="100" style="width:48%;">
      </div>
      <button onclick="updateRateLimits()">UPDATE LIMITS</button>
    </div>

    <div class="control-card">
      <h3>🎨 THEME CUSTOMIZATION</h3>
      <div class="flex-row">
        <div><label style="font-size:0.7em;">Bg</label><br><input type="color" id="bgColor" class="color-picker" value="${bg}"></div>
        <div><label style="font-size:0.7em;">Text</label><br><input type="color" id="textColor" class="color-picker" value="${color}"></div>
        <div><label style="font-size:0.7em;">Glow</label><br><input type="color" id="glowColor" class="color-picker" value="${glow}"></div>
      </div>
      <button onclick="updateTheme()" class="mt-10">APPLY THEME</button>
    </div>

    <div class="control-card">
      <h3>👤 ADD USER</h3>
      <input type="text" id="newUsername" placeholder="USERNAME">
      <select id="newPlan">
        <option value="owner">👑 OWNER</option>
        <option value="user">⭐ USER</option>
        <option value="free">🆓 FREE</option>
      </select>
      <button onclick="quickAddUser()">+ ADD USER</button>
    </div>

    <div class="control-card">
      <h3>🔄 ACTIONS</h3>
      <button class="warning" onclick="resetAllUsers()">🔄 RESET ALL</button>
      <button class="danger" onclick="clearLogs()">🗑 CLEAR LOGS</button>
      <button class="danger" onclick="clearFailedLogins()">🗑 CLEAR FAILED LOGINS</button>
      <button onclick="exportLogs()">📥 EXPORT DATA</button>
      <button class="danger" onclick="resetConfig()">⚙️ RESET CONFIG</button>
      <button class="secondary" onclick="toggleLogs()">📝 TOGGLE LOGS</button>
    </div>

    <div class="control-card">
      <h3>📢 ANNOUNCEMENTS</h3>
      <input type="text" id="announcementMsg" placeholder="Announcement message">
      <button onclick="addAnnouncement()">+ ADD</button>
      <div id="announcementList" style="margin-top:10px; font-size:0.8em;"></div>
    </div>
  </div>

  <div class="table-container">
    <h3>👥 USER MANAGEMENT</h3>
    <table>
      <thead><tr><th>USER</th><th>API KEY</th><th>PLAN</th><th>MIN/DAY</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
      <tbody id="userTableBody"></tbody>
    </table>
  </div>

  <div class="table-container">
    <h3>📝 RECENT LOGS</h3>
    <table>
      <thead><tr><th>USER</th><th>API KEY</th><th>IP</th><th>TIME</th></tr></thead>
      <tbody id="logsBody"></tbody>
    </table>
  </div>

  <div class="table-container">
    <h3>🔐 FAILED LOGIN ATTEMPTS</h3>
    <table>
      <thead><tr><th>USERNAME</th><th>IP</th><th>TIME</th></tr></thead>
      <tbody id="failedLoginsBody"></tbody>
    </table>
  </div>

  <p style="text-align:center; margin-top:30px; font-size:0.6em; opacity:0.3;">
    🔗 <a href="https://t.me/premium_dark_33" style="color:${color};">@KINGFFAIAK47x</a> | MADE BY ANSH AFT
  </p>
</div>

<script>
function loadDashboard() {
  fetch('/admin/stats')
    .then(res => res.json())
    .then(data => {
      document.getElementById('totalUsers').textContent = data.totalUsers || 0;
      document.getElementById('totalRequests').textContent = data.totalRequests || 0;
      document.getElementById('ownerUsers').textContent = data.ownerUsers || 0;
      document.getElementById('userUsers').textContent = data.userUsers || 0;
      document.getElementById('freeUsers').textContent = data.freeUsers || 0;
      document.getElementById('uptime').textContent = data.uptime || 0;
      document.getElementById('apiStatusText').textContent = data.apiStatus ? '● ' + data.apiStatus.toUpperCase() : '● ONLINE';
      
      if (data.maintenance) {
        document.getElementById('maintenanceText').textContent = '⚠ MAINTENANCE';
        document.getElementById('maintenanceText').style.color = '#ff8800';
      } else {
        document.getElementById('maintenanceText').textContent = '';
      }

      let html = '';
      if (data.users) {
        data.users.forEach(u => {
          html += '<tr>' +
            '<td>' + u.username + '</td>' +
            '<td style="font-size:0.6em;">' + u.apiKey + '</td>' +
            '<td><span class="badge badge-' + u.plan + '">' + u.plan.toUpperCase() + '</span></td>' +
            '<td>' + u.minuteRequests + '/' + u.dayRequests + '</td>' +
            '<td><span class="badge badge-' + (u.status || 'active') + '">' + (u.status || 'ACTIVE').toUpperCase() + '</span></td>' +
            '<td>' +
              (u.username !== 'ANSHAFT127987' ? '<button class="action-btn danger" onclick="deleteUser(\\'' + u.username + '\\')">DEL</button>' : '') +
              '<button class="action-btn warning" onclick="toggleUserStatus(\\'' + u.username + '\\')">TOG</button>' +
            '</td>' +
          '</tr>';
        });
      }
      document.getElementById('userTableBody').innerHTML = html;

      let logsHtml = '';
      if (data.logs) {
        data.logs.slice(-20).reverse().forEach(log => {
          logsHtml += '<tr><td>' + log.username + '</td><td style="font-size:0.6em;">' + log.apiKey + '</td><td>' + log.ip + '</td><td style="font-size:0.6em;">' + new Date(log.timestamp).toLocaleString() + '</td></tr>';
        });
      }
      document.getElementById('logsBody').innerHTML = logsHtml;

      let failedHtml = '';
      if (data.failedLogins) {
        data.failedLogins.slice(-10).reverse().forEach(f => {
          failedHtml += '<tr><td>' + f.username + '</td><td>' + f.ip + '</td><td style="font-size:0.6em;">' + new Date(f.timestamp).toLocaleString() + '</td></tr>';
        });
      }
      document.getElementById('failedLoginsBody').innerHTML = failedHtml;

      let annHtml = '';
      if (data.announcements) {
        data.announcements.forEach(a => {
          annHtml += '<div style="display:flex;justify-content:space-between;border-bottom:1px solid #00ff4120;padding:5px 0;">' +
            '<span>' + a.message + '</span>' +
            '<button class="action-btn danger" onclick="deleteAnnouncement(' + a.id + ')">✕</button>' +
          '</div>';
        });
      }
      document.getElementById('announcementList').innerHTML = annHtml;
    })
    .catch(err => console.error('Error:', err));
}

function updateApiStatus() {
  const status = document.getElementById('apiStatusSelect').value;
  fetch('/admin/api-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  })
  .then(r => r.json())
  .then(d => { if(d.success){ alert('✅ Status updated!'); loadDashboard(); } })
  .catch(err => alert('❌ Error: ' + err.message));
}

function toggleMaintenance() {
  fetch('/admin/toggle-maintenance', { method: 'POST' })
    .then(r => r.json())
    .then(d => { alert(d.maintenance ? '⚠️ Maintenance ON' : '✅ Maintenance OFF'); loadDashboard(); })
    .catch(err => alert('❌ Error: ' + err.message));
}

function updateApiKeys() {
  const data = {
    ownerKey: document.getElementById('ownerKey').value,
    userKey: document.getElementById('userKey').value,
    freeKey: document.getElementById('freeKey').value
  };
  fetch('/admin/update-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(r => r.json())
  .then(d => { if(d.success){ alert('✅ Keys updated!'); loadDashboard(); } })
  .catch(err => alert('❌ Error: ' + err.message));
}

function updateRateLimits() {
  const data = {
    ownerMin: parseInt(document.getElementById('ownerMin').value),
    ownerDay: parseInt(document.getElementById('ownerDay').value),
    userMin: parseInt(document.getElementById('userMin').value),
    userDay: parseInt(document.getElementById('userDay').value),
    freeMin: parseInt(document.getElementById('freeMin').value),
    freeDay: parseInt(document.getElementById('freeDay').value)
  };
  fetch('/admin/rate-limits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(r => r.json())
  .then(d => { if(d.success){ alert('✅ Limits updated!'); loadDashboard(); } })
  .catch(err => alert('❌ Error: ' + err.message));
}

function updateTheme() {
  const data = {
    background: document.getElementById('bgColor').value,
    color: document.getElementById('textColor').value,
    glowColor: document.getElementById('glowColor').value
  };
  fetch('/admin/update-theme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(r => r.json())
  .then(d => { if(d.success){ alert('✅ Theme updated! Refreshing...'); location.reload(); } })
  .catch(err => alert('❌ Error: ' + err.message));
}

function quickAddUser() {
  const username = document.getElementById('newUsername').value;
  const plan = document.getElementById('newPlan').value;
  if (!username) { alert('❌ Enter username!'); return; }
  fetch('/admin/add-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, plan })
  })
  .then(r => r.json())
  .then(d => {
    if(d.success){
      alert('✅ User added! Key: ' + d.apiKey);
      document.getElementById('newUsername').value = '';
      loadDashboard();
    } else { alert('❌ ' + d.error); }
  })
  .catch(err => alert('❌ Error: ' + err.message));
}

function deleteUser(username) {
  if (!confirm('⚠️ Delete ' + username + '?')) return;
  fetch('/admin/delete-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
  .then(r => r.json())
  .then(d => { if(d.success){ alert('✅ Deleted!'); loadDashboard(); } })
  .catch(err => alert('❌ Error: ' + err.message));
}

function toggleUserStatus(username) {
  fetch('/admin/toggle-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
  .then(r => r.json())
  .then(d => { if(d.success){ alert('✅ Toggled!'); loadDashboard(); } })
  .catch(err => alert('❌ Error: ' + err.message));
}

function resetAllUsers() {
  if (!confirm('⚠️ Reset all counters?')) return;
  fetch('/admin/reset-all', { method: 'POST' })
    .then(r => r.json())
    .then(d => { alert('✅ Reset!'); loadDashboard(); })
    .catch(err => alert('❌ Error: ' + err.message));
}

function clearLogs() {
  if (!confirm('⚠️ Clear all logs?')) return;
  fetch('/admin/clear-logs', { method: 'POST' })
    .then(r => r.json())
    .then(d => { alert('✅ Logs cleared!'); loadDashboard(); })
    .catch(err => alert('❌ Error: ' + err.message));
}

function clearFailedLogins() {
  if (!confirm('⚠️ Clear failed logins?')) return;
  fetch('/admin/clear-failed-logins', { method: 'POST' })
    .then(r => r.json())
    .then(d => { alert('✅ Cleared!'); loadDashboard(); })
    .catch(err => alert('❌ Error: ' + err.message));
}

function exportLogs() {
  window.open('/admin/export-logs', '_blank');
}

function resetConfig() {
  if (!confirm('⚠️ Reset everything to default?')) return;
  fetch('/admin/reset-config', { method: 'POST' })
    .then(r => r.json())
    .then(d => { if(d.success){ alert('✅ Reset! Refreshing...'); location.reload(); } })
    .catch(err => alert('❌ Error: ' + err.message));
}

function toggleLogs() {
  fetch('/admin/toggle-logs', { method: 'POST' })
    .then(r => r.json())
    .then(d => { alert(d.logsEnabled ? '📝 Logs ON' : '📝 Logs OFF'); loadDashboard(); })
    .catch(err => alert('❌ Error: ' + err.message));
}

function addAnnouncement() {
  const msg = document.getElementById('announcementMsg').value;
  if (!msg) { alert('❌ Enter message!'); return; }
  fetch('/admin/add-announcement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg })
  })
  .then(r => r.json())
  .then(d => { if(d.success){ alert('✅ Added!'); document.getElementById('announcementMsg').value = ''; loadDashboard(); } })
  .catch(err => alert('❌ Error: ' + err.message));
}

function deleteAnnouncement(id) {
  fetch('/admin/delete-announcement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  })
  .then(r => r.json())
  .then(d => { if(d.success){ loadDashboard(); } })
  .catch(err => console.error('Error:', err));
}

window.onload = loadDashboard;
setInterval(loadDashboard, 15000);
</script>
</body>
</html>
  `;
}

// ========== ADMIN API ENDPOINTS ==========
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === CONFIG.adminUsername && password === CONFIG.adminPassword) {
    res.json({ success: true });
  } else {
    failedLogins.push({ username, timestamp: new Date().toISOString(), ip: req.ip || req.headers['x-forwarded-for'] || 'unknown' });
    res.json({ success: false });
  }
});

app.get('/admin/stats', (req, res) => {
  const userList = Object.entries(users).map(([username, data]) => ({
    username,
    ...data
  }));
  
  res.json({
    totalUsers: Object.keys(users).length,
    totalRequests: systemStats.totalRequests,
    ownerUsers: Object.values(users).filter(u => u.plan === 'owner').length,
    userUsers: Object.values(users).filter(u => u.plan === 'user').length,
    freeUsers: Object.values(users).filter(u => u.plan === 'free').length,
    apiStatus: CONFIG.apiStatus,
    theme: CONFIG.theme,
    version: CONFIG.version,
    users: userList,
    logs: usageLogs,
    failedLogins: failedLogins,
    announcements: announcements,
    uptime: Math.floor((Date.now() - systemStats.startTime) / 1000),
    maintenance: CONFIG.maintenance,
    logsEnabled: CONFIG.logsEnabled
  });
});

app.post('/admin/api-status', (req, res) => {
  const { status } = req.body;
  if (['online', 'maintenance', 'offline'].includes(status)) {
    CONFIG.apiStatus = status;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post('/admin/update-keys', (req, res) => {
  const { ownerKey, userKey, freeKey } = req.body;
  if (ownerKey) {
    users['ANSHAFT127987'].apiKey = ownerKey;
  }
  if (userKey) {
    users['DEMO_USER'].apiKey = userKey;
  }
  if (freeKey) {
    if (!users['FREE_USER']) {
      users['FREE_USER'] = {
        apiKey: freeKey,
        plan: 'free',
        minuteRequests: 0,
        dayRequests: 0,
        lastMinuteReset: Date.now(),
        lastDayReset: Date.now(),
        createdAt: Date.now(),
        status: 'active'
      };
    } else {
      users['FREE_USER'].apiKey = freeKey;
    }
  }
  res.json({ success: true });
});

app.post('/admin/rate-limits', (req, res) => {
  const { userMin, userDay, ownerMin, ownerDay, freeMin, freeDay } = req.body;
  if (userMin) CONFIG.rateLimit.user.perMinute = parseInt(userMin);
  if (userDay) CONFIG.rateLimit.user.perDay = parseInt(userDay);
  if (ownerMin) CONFIG.rateLimit.owner.perMinute = parseInt(ownerMin);
  if (ownerDay) CONFIG.rateLimit.owner.perDay = parseInt(ownerDay);
  if (freeMin) CONFIG.rateLimit.free.perMinute = parseInt(freeMin);
  if (freeDay) CONFIG.rateLimit.free.perDay = parseInt(freeDay);
  res.json({ success: true });
});

app.post('/admin/update-theme', (req, res) => {
  const { background, color, glowColor } = req.body;
  if (background) CONFIG.theme.background = background;
  if (color) CONFIG.theme.color = color;
  if (glowColor) CONFIG.theme.glowColor = glowColor;
  res.json({ success: true });
});

app.post('/admin/add-user', (req, res) => {
  const { username, plan } = req.body;
  if (!username) {
    return res.json({ success: false, error: 'Username required' });
  }
  if (users[username]) {
    return res.json({ success: false, error: 'User already exists' });
  }
  
  let apiKey;
  if (plan === 'owner') {
    apiKey = username.toUpperCase() + '-OWNER-2026';
  } else if (plan === 'user') {
    apiKey = username.toUpperCase() + '-USER-2026';
  } else {
    apiKey = username.toUpperCase() + '-FREE-2026';
  }
  
  users[username] = {
    apiKey: apiKey,
    plan: plan || 'user',
    minuteRequests: 0,
    dayRequests: 0,
    lastMinuteReset: Date.now(),
    lastDayReset: Date.now(),
    createdAt: Date.now(),
    status: 'active'
  };
  
  res.json({ success: true, apiKey: apiKey });
});

app.post('/admin/delete-user', (req, res) => {
  const { username } = req.body;
  if (!users[username]) {
    return res.json({ success: false, error: 'User not found' });
  }
  if (username === 'ANSHAFT127987') {
    return res.json({ success: false, error: 'Cannot delete owner' });
  }
  delete users[username];
  res.json({ success: true });
});

app.post('/admin/toggle-user', (req, res) => {
  const { username } = req.body;
  if (!users[username]) {
    return res.json({ success: false, error: 'User not found' });
  }
  users[username].status = users[username].status === 'active' ? 'suspended' : 'active';
  res.json({ success: true });
});

app.post('/admin/reset-all', (req, res) => {
  for (const key in users) {
    users[key].minuteRequests = 0;
    users[key].dayRequests = 0;
    users[key].lastMinuteReset = Date.now();
    users[key].lastDayReset = Date.now();
  }
  res.json({ success: true });
});

app.post('/admin/clear-logs', (req, res) => {
  usageLogs = [];
  res.json({ success: true });
});

app.post('/admin/clear-failed-logins', (req, res) => {
  failedLogins = [];
  res.json({ success: true });
});

app.post('/admin/reset-config', (req, res) => {
  CONFIG.rateLimit.user.perMinute = 100;
  CONFIG.rateLimit.user.perDay = 1000;
  CONFIG.rateLimit.owner.perMinute = 10000;
  CONFIG.rateLimit.owner.perDay = 100000;
  CONFIG.rateLimit.free.perMinute = 10;
  CONFIG.rateLimit.free.perDay = 100;
  CONFIG.theme.background = '#0a0a0a';
  CONFIG.theme.color = '#00ff41';
  CONFIG.theme.glowColor = '#00ff41';
  CONFIG.apiStatus = 'online';
  CONFIG.maintenance = false;
  CONFIG.logsEnabled = true;
  res.json({ success: true });
});

app.get('/admin/export-logs', (req, res) => {
  const data = JSON.stringify({ users, logs: usageLogs, stats: systemStats, config: CONFIG, failedLogins, announcements }, null, 2);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=dark_panel_backup.json');
  res.send(data);
});

app.post('/admin/add-announcement', (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.json({ success: false, error: 'Message required' });
  }
  announcements.push({ id: Date.now(), message, timestamp: new Date().toISOString() });
  res.json({ success: true });
});

app.post('/admin/delete-announcement', (req, res) => {
  const { id } = req.body;
  announcements = announcements.filter(a => a.id !== parseInt(id));
  res.json({ success: true });
});

app.post('/admin/toggle-logs', (req, res) => {
  CONFIG.logsEnabled = !CONFIG.logsEnabled;
  res.json({ success: true, logsEnabled: CONFIG.logsEnabled });
});

app.post('/admin/toggle-maintenance', (req, res) => {
  CONFIG.maintenance = !CONFIG.maintenance;
  res.json({ success: true, maintenance: CONFIG.maintenance });
});

// ========== 404 ERROR HANDLER ==========
app.use((req, res) => {
  res.status(404).json({
    success: false,
    status: 404,
    message: 'Route not found',
    available_endpoints: {
      'Vehicle Info': '/api/vehicle-info?rc=DL10AB1234&api_key=DEMOFUCK',
      'Status': '/api/status',
      'Admin Panel': '/',
      'Login': '/token'
    },
    made_by: 'ANSH AFT',
    channel: 'https://t.me/premium_dark_33'
  });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('✅ Server running on port ' + PORT);
  console.log('📌 Login Page: http://localhost:' + PORT + '/');
  console.log('📌 API Status: http://localhost:' + PORT + '/api/status');
  console.log('📌 API Endpoint: http://localhost:' + PORT + '/api/vehicle-info?rc=DL10AB1234&api_key=DEMOFUCK');
  console.log('');
  console.log('🔑 Default Credentials:');
  console.log('   Username: ANSHAFT127987');
  console.log('   Password: ANSHAFTAK47');
  console.log('   API Key: DEMOFUCK (for testing)');
});

module.exports = app;
