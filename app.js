const express = require('express');
const app = express();

// ========== FIREBASE SETUP ==========
// IMPORTANT: Firebase credentials are loaded from Vercel environment variables.
// Never hard-code a Firebase service-account private key in source code.
const admin = require('firebase-admin');

let firebaseReady = false;

function initFirebase() {
  if (firebaseReady) return true;

  if (admin.apps.length) {
    firebaseReady = true;
    return true;
  }

  try {
    const databaseURL = process.env.FIREBASE_DATABASE_URL;
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!databaseURL || !rawServiceAccount) {
      throw new Error(
        'Missing FIREBASE_DATABASE_URL or FIREBASE_SERVICE_ACCOUNT environment variable'
      );
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT must contain valid JSON');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL
    });

    firebaseReady = true;
    console.log('✅ Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    return false;
  }
}

function getDb() {
  if (!initFirebase()) {
    throw new Error('Firebase is not configured');
  }
  return admin.database();
}

async function withTimeout(promise, ms, label = 'Operation') {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms
        );
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

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

// ========== CONFIGURATION (Firebase se load) ==========
let CONFIG = {
  adminUsername: process.env.ADMIN_USERNAME || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
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

// ========== FIREBASE HELPER FUNCTIONS ==========

// Short cache prevents every request from waiting on Firebase.
// Data-changing admin operations invalidate these caches.
const CACHE_TTL = 3000;
let configCacheAt = 0;
let usersCache = null;
let usersCacheAt = 0;

function invalidateCaches() {
  configCacheAt = 0;
  usersCache = null;
  usersCacheAt = 0;
}

// Config load/save
async function loadConfig() {
  if (Date.now() - configCacheAt < CACHE_TTL) return CONFIG;

  try {
    const db = getDb();
    const snapshot = await withTimeout(
      db.ref('config').once('value'),
      8000,
      'Firebase config read'
    );

    if (snapshot.exists()) {
      const saved = snapshot.val() || {};
      CONFIG = {
        ...CONFIG,
        ...saved,
        rateLimit: { ...CONFIG.rateLimit, ...(saved.rateLimit || {}) },
        theme: { ...CONFIG.theme, ...(saved.theme || {}) }
      };
    } else {
      // Do not block a request for a long time trying to create defaults.
      await withTimeout(
        db.ref('config').set(CONFIG),
        8000,
        'Firebase config write'
      );
    }

    configCacheAt = Date.now();
    return CONFIG;
  } catch (error) {
    console.error('❌ Error loading config:', error.message);
    // Keep the in-memory defaults so the endpoint fails fast instead of hanging.
    configCacheAt = Date.now();
    return CONFIG;
  }
}

async function saveConfig() {
  try {
    const db = getDb();
    await withTimeout(
      db.ref('config').set(CONFIG),
      8000,
      'Firebase config write'
    );
    invalidateCaches();
    return true;
  } catch (error) {
    console.error('❌ Error saving config:', error.message);
    return false;
  }
}

// User functions
async function getUser(username) {
  try {
    const db = getDb();
    const snapshot = await withTimeout(
      db.ref(`users/${username}`).once('value'),
      8000,
      'Firebase user read'
    );
    return snapshot.val();
  } catch (error) {
    console.error('Error getting user:', error.message);
    return null;
  }
}

async function getAllUsers() {
  const now = Date.now();
  if (usersCache && now - usersCacheAt < CACHE_TTL) return usersCache;

  try {
    const db = getDb();
    const snapshot = await withTimeout(
      db.ref('users').once('value'),
      8000,
      'Firebase users read'
    );
    usersCache = snapshot.val() || {};
    usersCacheAt = now;
    return usersCache;
  } catch (error) {
    console.error('Error getting users:', error.message);
    return {};
  }
}

async function saveUser(username, userData) {
  try {
    const db = getDb();
    await withTimeout(
      db.ref(`users/${username}`).set(userData),
      8000,
      'Firebase user write'
    );
    invalidateCaches();
    return true;
  } catch (error) {
    console.error('Error saving user:', error.message);
    return false;
  }
}

async function deleteUser(username) {
  try {
    const db = getDb();
    await withTimeout(
      db.ref(`users/${username}`).remove(),
      8000,
      'Firebase user delete'
    );
    invalidateCaches();
    return true;
  } catch (error) {
    console.error('Error deleting user:', error.message);
    return false;
  }
}

// Logs functions
async function addLog(logData) {
  try {
    const db = getDb();
    const logsRef = db.ref('logs');
    const newLogRef = logsRef.push();
    await withTimeout(
      newLogRef.set({ ...logData, timestamp: new Date().toISOString() }),
      8000,
      'Firebase log write'
    );
    return true;
  } catch (error) {
    console.error('Error adding log:', error.message);
    return false;
  }
}

async function getLogs() {
  try {
    const db = getDb();
    const snapshot = await withTimeout(
      db.ref('logs').orderByKey().limitToLast(100).once('value'),
      8000,
      'Firebase logs read'
    );
    const logs = snapshot.val();
    return logs ? Object.values(logs) : [];
  } catch (error) {
    console.error('Error getting logs:', error.message);
    return [];
  }
}

async function clearLogs() {
  try {
    const db = getDb();
    await withTimeout(db.ref('logs').remove(), 8000, 'Firebase logs delete');
    return true;
  } catch (error) {
    console.error('Error clearing logs:', error.message);
    return false;
  }
}

// Failed logins functions
async function addFailedLogin(data) {
  try {
    const db = getDb();
    await withTimeout(
      db.ref('failedLogins').push().set({
        ...data,
        timestamp: new Date().toISOString()
      }),
      8000,
      'Firebase failed-login write'
    );
    return true;
  } catch (error) {
    console.error('Error adding failed login:', error.message);
    return false;
  }
}

async function getFailedLogins() {
  try {
    const db = getDb();
    const snapshot = await withTimeout(
      db.ref('failedLogins').orderByKey().limitToLast(50).once('value'),
      8000,
      'Firebase failed-login read'
    );
    const data = snapshot.val();
    return data ? Object.values(data) : [];
  } catch (error) {
    console.error('Error getting failed logins:', error.message);
    return [];
  }
}

async function clearFailedLogins() {
  try {
    const db = getDb();
    await withTimeout(
      db.ref('failedLogins').remove(),
      8000,
      'Firebase failed-login delete'
    );
    return true;
  } catch (error) {
    console.error('Error clearing failed logins:', error.message);
    return false;
  }
}

// Announcements functions
async function addAnnouncement(message) {
  try {
    const db = getDb();
    await withTimeout(
      db.ref('announcements').push().set({
        id: Date.now(),
        message,
        timestamp: new Date().toISOString()
      }),
      8000,
      'Firebase announcement write'
    );
    return true;
  } catch (error) {
    console.error('Error adding announcement:', error.message);
    return false;
  }
}

async function getAnnouncements() {
  try {
    const db = getDb();
    const snapshot = await withTimeout(
      db.ref('announcements').once('value'),
      8000,
      'Firebase announcements read'
    );
    const data = snapshot.val();
    return data ? Object.values(data) : [];
  } catch (error) {
    console.error('Error getting announcements:', error.message);
    return [];
  }
}

async function deleteAnnouncement(id) {
  try {
    const db = getDb();
    const snapshot = await withTimeout(
      db.ref('announcements').once('value'),
      8000,
      'Firebase announcements read'
    );
    const data = snapshot.val();
    if (data) {
      for (const key in data) {
        if (data[key].id === parseInt(id)) {
          await withTimeout(
            db.ref(`announcements/${key}`).remove(),
            8000,
            'Firebase announcement delete'
          );
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Error deleting announcement:', error.message);
    return false;
  }
}

// Stats functions
async function getSystemStats() {
  try {
    const db = getDb();
    const snapshot = await withTimeout(
      db.ref('systemStats').once('value'),
      8000,
      'Firebase stats read'
    );
    if (snapshot.exists()) return snapshot.val();
    return { totalRequests: 0, startTime: Date.now() };
  } catch (error) {
    console.error('Error getting stats:', error.message);
    return { totalRequests: 0, startTime: Date.now() };
  }
}

async function saveSystemStats(stats) {
  try {
    const db = getDb();
    await withTimeout(
      db.ref('systemStats').set(stats),
      8000,
      'Firebase stats write'
    );
    return true;
  } catch (error) {
    console.error('Error saving stats:', error.message);
    return false;
  }
}

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
async function validateApiKey(req, res, next) {
  try {
    await loadConfig();

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

    const users = await getAllUsers();
    let user = null;
    let username = null;

    for (const [key, value] of Object.entries(users)) {
      if (value && value.apiKey === apiKey) {
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

    const limits =
      user.plan === 'owner' ? CONFIG.rateLimit.owner :
      user.plan === 'user' ? CONFIG.rateLimit.user :
      CONFIG.rateLimit.free;

    if (user.minuteRequests >= limits.perMinute) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded (Minute)',
        message: 'You have exceeded ' + limits.perMinute + ' requests per minute',
        plan: user.plan,
        reset_in: Math.max(
          0,
          Math.ceil((user.lastMinuteReset + 60000 - Date.now()) / 1000)
        ) + ' seconds'
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

    // This write is required for limits, but it has a hard timeout.
    const saved = await saveUser(username, user);
    if (!saved) {
      return res.status(503).json({
        error: 'Database Unavailable',
        message: 'Please try again shortly.'
      });
    }

    req.user = { username, ...user };

    // Stats/logging are non-critical. Do not make the vehicle response wait for them.
    if (CONFIG.logsEnabled) {
      void addLog({
        username,
        apiKey: String(apiKey).substring(0, 8) + '...',
        ip: req.ip || req.headers['x-forwarded-for'] || 'self',
        plan: user.plan
      });
    }

    void (async () => {
      try {
        const stats = await getSystemStats();
        stats.totalRequests = (stats.totalRequests || 0) + 1;
        await saveSystemStats(stats);
      } catch (e) {
        console.error('Background stats error:', e.message);
      }
    })();

    return next();
  } catch (error) {
    console.error('validateApiKey error:', error.message);
    return res.status(503).json({
      error: 'Service Temporarily Unavailable',
      message: 'Database/API dependency is unavailable. Please retry shortly.'
    });
  }
}

// ========== MAIN API - VEHICLE INFO ==========
app.get('/api/vehicle-info', validateApiKey, async (req, res) => {
  try {
    const rc = req.query.rc;
    const users = await getAllUsers();
    const user = users[req.user.username];
    
    if (!rc) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: 'RC number parameter is required. Please provide correct RC number (e.g., DL10AB1234)',
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

    // Validate RC number format
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

    // ========== CALL EXTERNAL API ==========
    const controller = new AbortController();
    const externalTimeout = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(
        'https://vehicleinfobyterabaap.vercel.app/lookup?rc=' +
          encodeURIComponent(rc.toUpperCase()),
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(externalTimeout);
    }

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        status: 502,
        error: 'Upstream API Error',
        message: `Vehicle lookup service returned HTTP ${response.status}`,
        retryable: true
      });
    }

    const externalData = await response.json();
    
    // ========== REMOVE COPYRIGHT AND TAKE ALL DATA ==========
    const { copyright, ...cleanData } = externalData;
    
    // ========== ADD OUR METADATA ==========
    cleanData.MADE_BY = 'ANSH AFT';
    cleanData.CHANNEL = 'https://t.me/premium_dark_33';
    cleanData.USERNAME = '@KINGFFAIAK47x';
    cleanData.API_VERSION = CONFIG.version;
    cleanData.REQUEST_BY = req.user.username;
    cleanData.PLAN = req.user.plan;
    cleanData.REMAINING_MINUTE = CONFIG.rateLimit[req.user.plan].perMinute - req.user.minuteRequests;
    cleanData.REMAINING_DAY = CONFIG.rateLimit[req.user.plan].perDay - req.user.dayRequests;
    cleanData.RESET_TIME = new Date(req.user.lastDayReset + 86400000).toISOString();
    
    res.json(cleanData);
    
  } catch (error) {
    const isTimeout = error && (error.name === 'AbortError' || /timed out/i.test(error.message || ''));
    res.status(isTimeout ? 504 : 500).json({
      success: false,
      status: isTimeout ? 504 : 500,
      error: isTimeout ? 'Upstream Timeout' : 'Internal Server Error',
      message: isTimeout
        ? 'Vehicle lookup service did not respond within 15 seconds.'
        : error.message,
      support: 'https://t.me/premium_dark_33',
      MADE_BY: 'ANSH AFT',
      CHANNEL: 'https://t.me/premium_dark_33'
    });
  }
});

// ========== API STATUS ==========
app.get('/api/status', async (req, res) => {
  await loadConfig();
  const stats = await getSystemStats();
  const users = await getAllUsers();
  
  res.json({
    status: CONFIG.apiStatus,
    version: CONFIG.version,
    uptime: Math.floor((Date.now() - (stats.startTime || Date.now())) / 1000),
    total_requests: stats.totalRequests || 0,
    total_users: Object.keys(users).length,
    maintenance: CONFIG.maintenance,
    timestamp: new Date().toISOString(),
    MADE_BY: 'ANSH AFT',
    CHANNEL: 'https://t.me/premium_dark_33'
  });
});

// ========== ROOT - DIRECT LOGIN PAGE ==========
app.get('/', (req, res) => {
  res.send(getLoginPageHTML());
});

// ========== TOKEN ROUTE - ADMIN AUTH ==========
app.get('/token', async (req, res) => {
  await loadConfig();
  if (!CONFIG.adminUsername || !CONFIG.adminPassword) {
    return res.status(503).send('Admin login is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in Vercel Environment Variables.');
  }
  const { username, password } = req.query;
  
  if (username && password && username === CONFIG.adminUsername && password === CONFIG.adminPassword) {
    res.send(getAdminPanelHTML());
  } else {
    if (username) {
      await addFailedLogin({ username, ip: req.ip || req.headers['x-forwarded-for'] || 'unknown' });
    }
    res.send(getLoginPageHTML('❌ Invalid credentials! Please try again.'));
  }
});

// ========== LOGIN PAGE HTML ==========
function getLoginPageHTML(error = '') {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>🔥 DARK VEHICLE API - LOGIN</title>
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
    <h1 class="glow">🚗 VEHICLE API</h1>
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
      <p>🔗 https://anshsir-info.vercel.app</p>
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
  <title>🔥 DARK VEHICLE CONTROL PANEL</title>
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
    .loading { opacity: 0.5; pointer-events: none; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div><h1 class="glow">🚗 VEHICLE CONTROL</h1><p style="font-size:0.6em; opacity:0.5;">MADE BY ANSH AFT | v3.0 | FIREBASE</p></div>
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
    🔗 <a href="https://t.me/premium_dark_33" style="color:${color};">@KINGFFAIAK47x</a> | MADE BY ANSH AFT | FIREBASE
  </p>
</div>

<script>
async function loadDashboard() {
  try {
    const response = await fetch('/admin/stats');
    const data = await response.json();
    
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
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

async function fetchAdmin(endpoint, options = {}) {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success === false && data.error) {
      alert('❌ ' + data.error);
    }
    return data;
  } catch (err) {
    alert('❌ Error: ' + err.message);
    return null;
  }
}

function updateApiStatus() {
  const status = document.getElementById('apiStatusSelect').value;
  fetchAdmin('/admin/api-status', {
    method: 'POST',
    body: JSON.stringify({ status })
  }).then(data => {
    if (data && data.success) {
      alert('✅ Status updated!');
      loadDashboard();
    }
  });
}

function toggleMaintenance() {
  fetchAdmin('/admin/toggle-maintenance', { method: 'POST' })
    .then(data => {
      if (data) {
        alert(data.maintenance ? '⚠️ Maintenance ON' : '✅ Maintenance OFF');
        loadDashboard();
      }
    });
}

function updateApiKeys() {
  const data = {
    ownerKey: document.getElementById('ownerKey').value,
    userKey: document.getElementById('userKey').value,
    freeKey: document.getElementById('freeKey').value
  };
  fetchAdmin('/admin/update-keys', {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(data => {
    if (data && data.success) {
      alert('✅ Keys updated!');
      loadDashboard();
    }
  });
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
  fetchAdmin('/admin/rate-limits', {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(data => {
    if (data && data.success) {
      alert('✅ Limits updated!');
      loadDashboard();
    }
  });
}

function updateTheme() {
  const data = {
    background: document.getElementById('bgColor').value,
    color: document.getElementById('textColor').value,
    glowColor: document.getElementById('glowColor').value
  };
  fetchAdmin('/admin/update-theme', {
    method: 'POST',
    body: JSON.stringify(data)
  }).then(data => {
    if (data && data.success) {
      alert('✅ Theme updated! Refreshing...');
      location.reload();
    }
  });
}

function quickAddUser() {
  const username = document.getElementById('newUsername').value;
  const plan = document.getElementById('newPlan').value;
  if (!username) { alert('❌ Enter username!'); return; }
  fetchAdmin('/admin/add-user', {
    method: 'POST',
    body: JSON.stringify({ username, plan })
  }).then(data => {
    if (data && data.success) {
      alert('✅ User added! Key: ' + data.apiKey);
      document.getElementById('newUsername').value = '';
      loadDashboard();
    }
  });
}

function deleteUser(username) {
  if (!confirm('⚠️ Delete ' + username + '?')) return;
  fetchAdmin('/admin/delete-user', {
    method: 'POST',
    body: JSON.stringify({ username })
  }).then(data => {
    if (data && data.success) {
      alert('✅ Deleted!');
      loadDashboard();
    }
  });
}

function toggleUserStatus(username) {
  fetchAdmin('/admin/toggle-user', {
    method: 'POST',
    body: JSON.stringify({ username })
  }).then(data => {
    if (data && data.success) {
      alert('✅ Toggled!');
      loadDashboard();
    }
  });
}

function resetAllUsers() {
  if (!confirm('⚠️ Reset all counters?')) return;
  fetchAdmin('/admin/reset-all', { method: 'POST' })
    .then(data => {
      if (data && data.success) {
        alert('✅ Reset!');
        loadDashboard();
      }
    });
}

function clearLogs() {
  if (!confirm('⚠️ Clear all logs?')) return;
  fetchAdmin('/admin/clear-logs', { method: 'POST' })
    .then(data => {
      if (data && data.success) {
        alert('✅ Logs cleared!');
        loadDashboard();
      }
    });
}

function clearFailedLogins() {
  if (!confirm('⚠️ Clear failed logins?')) return;
  fetchAdmin('/admin/clear-failed-logins', { method: 'POST' })
    .then(data => {
      if (data && data.success) {
        alert('✅ Cleared!');
        loadDashboard();
      }
    });
}

function exportLogs() {
  window.open('/admin/export-logs', '_blank');
}

function resetConfig() {
  if (!confirm('⚠️ Reset everything to default?')) return;
  fetchAdmin('/admin/reset-config', { method: 'POST' })
    .then(data => {
      if (data && data.success) {
        alert('✅ Reset! Refreshing...');
        location.reload();
      }
    });
}

function toggleLogs() {
  fetchAdmin('/admin/toggle-logs', { method: 'POST' })
    .then(data => {
      if (data) {
        alert(data.logsEnabled ? '📝 Logs ON' : '📝 Logs OFF');
        loadDashboard();
      }
    });
}

function addAnnouncement() {
  const msg = document.getElementById('announcementMsg').value;
  if (!msg) { alert('❌ Enter message!'); return; }
  fetchAdmin('/admin/add-announcement', {
    method: 'POST',
    body: JSON.stringify({ message: msg })
  }).then(data => {
    if (data && data.success) {
      alert('✅ Added!');
      document.getElementById('announcementMsg').value = '';
      loadDashboard();
    }
  });
}

function deleteAnnouncement(id) {
  fetchAdmin('/admin/delete-announcement', {
    method: 'POST',
    body: JSON.stringify({ id })
  }).then(data => {
    if (data && data.success) {
      loadDashboard();
    }
  });
}

window.onload = loadDashboard;
setInterval(loadDashboard, 15000);
</script>
</body>
</html>
  `;
}

// ========== ADMIN API ENDPOINTS ==========

// Helper function to check admin auth (using query param for simplicity)
function isAdmin(req, res, next) {
  // You can add proper auth check here
  next();
}

app.post('/admin/login', async (req, res) => {
  await loadConfig();
  if (!CONFIG.adminUsername || !CONFIG.adminPassword) {
    return res.status(503).json({ success: false, error: 'Admin login is not configured' });
  }
  const { username, password } = req.body;
  if (username === CONFIG.adminUsername && password === CONFIG.adminPassword) {
    res.json({ success: true });
  } else {
    await addFailedLogin({ 
      username, 
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown' 
    });
    res.json({ success: false });
  }
});

app.get('/admin/stats', async (req, res) => {
  await loadConfig();
  const [users, stats, logs, failedLogins, announcements] = await Promise.all([
    getAllUsers(),
    getSystemStats(),
    getLogs(),
    getFailedLogins(),
    getAnnouncements()
  ]);
  
  const userList = Object.entries(users).map(([username, data]) => ({
    username,
    ...data
  }));
  
  res.json({
    totalUsers: Object.keys(users).length,
    totalRequests: stats.totalRequests || 0,
    ownerUsers: Object.values(users).filter(u => u.plan === 'owner').length,
    userUsers: Object.values(users).filter(u => u.plan === 'user').length,
    freeUsers: Object.values(users).filter(u => u.plan === 'free').length,
    apiStatus: CONFIG.apiStatus,
    theme: CONFIG.theme,
    version: CONFIG.version,
    users: userList,
    logs: logs,
    failedLogins: failedLogins,
    announcements: announcements,
    uptime: Math.floor((Date.now() - (stats.startTime || Date.now())) / 1000),
    maintenance: CONFIG.maintenance,
    logsEnabled: CONFIG.logsEnabled
  });
});

app.post('/admin/api-status', async (req, res) => {
  await loadConfig();
  const { status } = req.body;
  if (['online', 'maintenance', 'offline'].includes(status)) {
    CONFIG.apiStatus = status;
    await saveConfig();
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post('/admin/update-keys', async (req, res) => {
  await loadConfig();
  const { ownerKey, userKey, freeKey } = req.body;
  
  const users = await getAllUsers();
  
  if (ownerKey && users['ANSHAFT127987']) {
    users['ANSHAFT127987'].apiKey = ownerKey;
    await saveUser('ANSHAFT127987', users['ANSHAFT127987']);
  }
  
  if (userKey && users['DEMO_USER']) {
    users['DEMO_USER'].apiKey = userKey;
    await saveUser('DEMO_USER', users['DEMO_USER']);
  }
  
  if (freeKey) {
    if (!users['FREE_USER']) {
      const newUser = {
        apiKey: freeKey,
        plan: 'free',
        minuteRequests: 0,
        dayRequests: 0,
        lastMinuteReset: Date.now(),
        lastDayReset: Date.now(),
        createdAt: Date.now(),
        status: 'active'
      };
      await saveUser('FREE_USER', newUser);
    } else {
      users['FREE_USER'].apiKey = freeKey;
      await saveUser('FREE_USER', users['FREE_USER']);
    }
  }
  
  res.json({ success: true });
});

app.post('/admin/rate-limits', async (req, res) => {
  await loadConfig();
  const { userMin, userDay, ownerMin, ownerDay, freeMin, freeDay } = req.body;
  
  if (userMin) CONFIG.rateLimit.user.perMinute = parseInt(userMin);
  if (userDay) CONFIG.rateLimit.user.perDay = parseInt(userDay);
  if (ownerMin) CONFIG.rateLimit.owner.perMinute = parseInt(ownerMin);
  if (ownerDay) CONFIG.rateLimit.owner.perDay = parseInt(ownerDay);
  if (freeMin) CONFIG.rateLimit.free.perMinute = parseInt(freeMin);
  if (freeDay) CONFIG.rateLimit.free.perDay = parseInt(freeDay);
  
  await saveConfig();
  res.json({ success: true });
});

app.post('/admin/update-theme', async (req, res) => {
  await loadConfig();
  const { background, color, glowColor } = req.body;
  
  if (background) CONFIG.theme.background = background;
  if (color) CONFIG.theme.color = color;
  if (glowColor) CONFIG.theme.glowColor = glowColor;
  
  await saveConfig();
  res.json({ success: true });
});

app.post('/admin/add-user', async (req, res) => {
  const { username, plan } = req.body;
  
  if (!username) {
    return res.json({ success: false, error: 'Username required' });
  }
  
  const users = await getAllUsers();
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
  
  const newUser = {
    apiKey: apiKey,
    plan: plan || 'user',
    minuteRequests: 0,
    dayRequests: 0,
    lastMinuteReset: Date.now(),
    lastDayReset: Date.now(),
    createdAt: Date.now(),
    status: 'active'
  };
  
  await saveUser(username, newUser);
  res.json({ success: true, apiKey: apiKey });
});

app.post('/admin/delete-user', async (req, res) => {
  const { username } = req.body;
  
  if (username === 'ANSHAFT127987') {
    return res.json({ success: false, error: 'Cannot delete owner' });
  }
  
  const users = await getAllUsers();
  if (!users[username]) {
    return res.json({ success: false, error: 'User not found' });
  }
  
  await deleteUser(username);
  res.json({ success: true });
});

app.post('/admin/toggle-user', async (req, res) => {
  const { username } = req.body;
  
  const users = await getAllUsers();
  if (!users[username]) {
    return res.json({ success: false, error: 'User not found' });
  }
  
  users[username].status = users[username].status === 'active' ? 'suspended' : 'active';
  await saveUser(username, users[username]);
  res.json({ success: true });
});

app.post('/admin/reset-all', async (req, res) => {
  const users = await getAllUsers();
  for (const key in users) {
    users[key].minuteRequests = 0;
    users[key].dayRequests = 0;
    users[key].lastMinuteReset = Date.now();
    users[key].lastDayReset = Date.now();
    await saveUser(key, users[key]);
  }
  res.json({ success: true });
});

app.post('/admin/clear-logs', async (req, res) => {
  await clearLogs();
  res.json({ success: true });
});

app.post('/admin/clear-failed-logins', async (req, res) => {
  await clearFailedLogins();
  res.json({ success: true });
});

app.post('/admin/reset-config', async (req, res) => {
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
  
  await saveConfig();
  res.json({ success: true });
});

app.get('/admin/export-logs', async (req, res) => {
  const users = await getAllUsers();
  const logs = await getLogs();
  const stats = await getSystemStats();
  const failedLogins = await getFailedLogins();
  const announcements = await getAnnouncements();
  
  const data = JSON.stringify({ 
    users, 
    logs, 
    stats, 
    config: CONFIG, 
    failedLogins, 
    announcements 
  }, null, 2);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=dark_vehicle_api_backup.json');
  res.send(data);
});

app.post('/admin/add-announcement', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.json({ success: false, error: 'Message required' });
  }
  await addAnnouncement(message);
  res.json({ success: true });
});

app.post('/admin/delete-announcement', async (req, res) => {
  const { id } = req.body;
  await deleteAnnouncement(id);
  res.json({ success: true });
});

app.post('/admin/toggle-logs', async (req, res) => {
  await loadConfig();
  CONFIG.logsEnabled = !CONFIG.logsEnabled;
  await saveConfig();
  res.json({ success: true, logsEnabled: CONFIG.logsEnabled });
});

app.post('/admin/toggle-maintenance', async (req, res) => {
  await loadConfig();
  CONFIG.maintenance = !CONFIG.maintenance;
  await saveConfig();
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
    MADE_BY: 'ANSH AFT',
    CHANNEL: 'https://t.me/premium_dark_33',
    USERNAME: '@KINGFFAIAK47x'
  });
});

// ========== VERCEL ENTRYPOINT ==========
// Vercel manages the HTTP server. Do NOT call app.listen() in a serverless function.
// Firebase is initialized lazily on the first request, so a slow/unavailable database
// cannot hold deployment startup open for 300 seconds.
if (process.env.VERCEL !== '1' && require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log('✅ Vehicle API Server running on port ' + PORT);
  });
}

module.exports = app;
