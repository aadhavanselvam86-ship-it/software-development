require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initSqlDatabase, dbAll, dbGet } = require('./config/sqlDb');
const { connectMongo, getMongoStatus } = require('./config/mongoDb');
const { requestLoggerMiddleware, morganCombined, morganDev, requestMetrics } = require('./config/logger');
const { fetchThirdPartyTamilTracks, DEFAULT_TIMEOUT_MS } = require('./services/thirdPartyMusic');
const { processAssistantQuery } = require('./services/aiAssistant');
const { createSupportTicket, getAllTickets, updateTicketStatus } = require('./services/ticketService');
const { getRecentChatLogs } = require('./models/ChatLog');
const { recordFeedback, getRecentFeedback } = require('./models/Feedback');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLoggerMiddleware);
app.use(morganDev);
app.use(morganCombined);

// Serve static assets (allow dotfiles so paths containing .gemini work smoothly)
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'allow' }));

// Helper to reliably send HTML files across all environments
const sendHtml = (res, fileName, statusCode = 200) => {
  res.status(statusCode).sendFile(path.join(__dirname, 'public', fileName), { dotfiles: 'allow' });
};

// Load static catalogs
const tamilSongs = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'tamilSongs.json'), 'utf8')
);
const errorCodes = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'errorCodes.json'), 'utf8')
);

/* ==========================================================================
   PAGE ROUTES (HTML)
   ========================================================================== */
app.get('/', (req, res) => sendHtml(res, 'index.html'));
app.get('/plans', (req, res) => sendHtml(res, 'plans.html'));
app.get('/faq', (req, res) => sendHtml(res, 'faq.html'));
app.get('/errors', (req, res) => sendHtml(res, 'errors.html'));
app.get('/tickets', (req, res) => sendHtml(res, 'tickets.html'));
app.get('/status', (req, res) => sendHtml(res, 'status.html'));
app.get('/404', (req, res) => sendHtml(res, '404.html', 404));
app.get('/500', (req, res) => sendHtml(res, '500.html', 500));

/* ==========================================================================
   REST API: TAMIL MUSIC CATALOG
   ========================================================================== */
app.get('/api/songs', (req, res) => {
  const { genre, composer, search } = req.query;
  let results = tamilSongs;

  if (genre) {
    results = results.filter((s) => s.genre.toLowerCase().includes(genre.toLowerCase()));
  }
  if (composer) {
    results = results.filter((s) => s.composer.toLowerCase().includes(composer.toLowerCase()));
  }
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.movie.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q)
    );
  }

  res.json({ success: true, count: results.length, data: results });
});

app.get('/api/songs/:id', (req, res) => {
  const song = tamilSongs.find((s) => s.id === req.params.id);
  if (!song) {
    return res.status(404).json({
      success: false,
      errorCode: 404,
      error: 'Not Found',
      message: `Tamil track with id '${req.params.id}' was not found in catalog.`
    });
  }
  res.json({ success: true, data: song });
});

/* ==========================================================================
   REST API: THIRD-PARTY API WITH TIMEOUT & FALLBACK
   ========================================================================== */
app.get('/api/explore/third-party', async (req, res) => {
  const query = req.query.q || 'tamil anirudh';
  const timeoutMs = parseInt(req.query.timeoutMs, 10) || DEFAULT_TIMEOUT_MS;
  const result = await fetchThirdPartyTamilTracks(query, timeoutMs);
  res.json(result);
});

// Explicit simulation of third-party timeout with immediate fallback
app.get('/api/explore/test-timeout', async (req, res) => {
  // Force a 1ms timeout threshold so AbortController fires immediately
  const result = await fetchThirdPartyTamilTracks('tamil a r rahman', 1);
  res.json({
    simulation: 'Forced Third-Party Timeout Test',
    explanation: 'Requested external API with 1ms timeout. As expected, AbortController triggered timeout and loaded local fallback catalog.',
    result
  });
});

/* ==========================================================================
   REST API: FAQS (STORED IN SQL DATABASE)
   ========================================================================== */
app.get('/api/faqs', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    let sql = 'SELECT * FROM faqs WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND (question LIKE ? OR answer LIKE ? OR tags LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY id ASC';
    const faqs = await dbAll(sql, params);
    res.json({ success: true, count: faqs.length, data: faqs });
  } catch (err) {
    next(err);
  }
});

app.get('/api/faqs/:id', async (req, res, next) => {
  try {
    const faq = await dbGet('SELECT * FROM faqs WHERE id = ?', [req.params.id]);
    if (!faq) {
      return res.status(404).json({
        success: false,
        errorCode: 404,
        error: 'Not Found',
        message: `FAQ item with ID ${req.params.id} does not exist.`
      });
    }
    res.json({ success: true, data: faq });
  } catch (err) {
    next(err);
  }
});

/* ==========================================================================
   REST API: 8 ERROR CODES & LIVE SIMULATOR
   ========================================================================== */
app.get('/api/error-codes', (req, res) => {
  res.json({ success: true, count: errorCodes.length, data: errorCodes });
});

// Simulator endpoint for testing all 8 required error codes
app.get('/api/simulate-error/:code', (req, res, next) => {
  const code = parseInt(req.params.code, 10);
  const matched = errorCodes.find((e) => e.code === code);

  switch (code) {
    case 400:
      return res.status(400).json({
        errorCode: 400,
        error: 'Bad Request',
        message: 'Simulation: Malformed query payload or missing track ID.',
        remedy: matched ? matched.remedy : 'Verify your parameters.'
      });

    case 401:
      return res.status(401).json({
        errorCode: 401,
        error: 'Unauthorized',
        message: 'Simulation: Session expired. Please log into your IsaiStream Tamil account.',
        remedy: matched ? matched.remedy : 'Re-authenticate.'
      });

    case 403:
      return res.status(403).json({
        errorCode: 403,
        error: 'Forbidden',
        message: 'Simulation: Regional DRM copyright restriction prevents streaming this Tamil soundtrack outside India.',
        remedy: matched ? matched.remedy : 'Check regional permissions.'
      });

    case 404:
      return res.status(404).json({
        errorCode: 404,
        error: 'Not Found',
        message: 'Simulation: The requested Tamil album or track does not exist in our catalog.',
        remedy: matched ? matched.remedy : 'Verify URL.'
      });

    case 429:
      return res.status(429).json({
        errorCode: 429,
        error: 'Too Many Requests',
        message: 'Simulation: Streaming rate limit exceeded (60 requests/min). Please slow down your requests.',
        remedy: matched ? matched.remedy : 'Wait 30-60 seconds.'
      });

    case 500:
      // Deliberately throw an unhandled error to test 500 pipeline
      const simulatedError = new Error('Simulation: Simulated database crash or audio transcode failure!');
      simulatedError.statusCode = 500;
      return next(simulatedError);

    case 503:
      return res.status(503).json({
        errorCode: 503,
        error: 'Service Unavailable',
        message: 'Simulation: Tamil audio streaming CDN edge cluster is undergoing scheduled maintenance.',
        remedy: matched ? matched.remedy : 'Try again in a few minutes.'
      });

    case 488:
      // Site-specific error code
      return res.status(488).json({
        errorCode: 488,
        error: 'TAMIL_VIP_REQUIRED',
        message: 'Site-Specific Error: Hi-Res Lossless 24-bit FLAC audio & Offline Download is exclusive to Spotify Premium VIP members.',
        remedy: 'Upgrade to Premium Individual (₹119/mo), Duo (₹149/mo), Family (₹179/mo) or Student (₹59/mo) on the Plans page.'
      });

    default:
      return res.status(400).json({
        errorCode: 400,
        error: 'Invalid Code',
        message: `Simulation not configured for HTTP code ${code}. Supported: 400, 401, 403, 404, 429, 500, 503, 488.`
      });
  }
});

/* ==========================================================================
   REST API: SUPPORT TICKETS (STORED IN SQL)
   ========================================================================== */
app.get('/api/tickets', async (req, res, next) => {
  try {
    const tickets = await getAllTickets();
    res.json({ success: true, count: tickets.length, data: tickets });
  } catch (err) {
    next(err);
  }
});

app.post('/api/tickets', async (req, res, next) => {
  try {
    const { userName, userEmail, subject, description, errorCode, priority } = req.body;
    if (!description) {
      return res.status(400).json({
        success: false,
        errorCode: 400,
        error: 'Bad Request',
        message: 'Ticket description is required.'
      });
    }

    const ticket = await createSupportTicket({
      userName,
      userEmail,
      subject: subject || 'Tamil Stream User Query',
      description,
      errorCode,
      priority
    });

    res.status(201).json({
      success: true,
      message: 'Support ticket successfully generated in SQL database.',
      data: ticket
    });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/tickets/:ticketNumber/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
      return res.status(400).json({
        success: false,
        errorCode: 400,
        error: 'Bad Request',
        message: 'Status must be OPEN, IN_PROGRESS, or RESOLVED.'
      });
    }
    const updated = await updateTicketStatus(req.params.ticketNumber, status);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/* ==========================================================================
   REST API: AI CHAT ASSISTANT & MONGODB LOGGING
   ========================================================================== */
app.post('/api/chat', async (req, res, next) => {
  try {
    const { message, sessionId, pageContext, userName, userEmail } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        errorCode: 400,
        error: 'Bad Request',
        message: 'Message content is required for the AI Assistant.'
      });
    }

    const response = await processAssistantQuery({
      message,
      sessionId,
      pageContext,
      userName,
      userEmail
    });

    res.json({ success: true, data: response });
  } catch (err) {
    next(err);
  }
});

// Retrieve chat logs (stored in MongoDB / resilient fallback)
app.get('/api/chat/logs', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = await getRecentChatLogs(limit);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    next(err);
  }
});

// Feedback on AI responses (stored in MongoDB)
app.post('/api/feedback', async (req, res, next) => {
  try {
    const { chatLogId, rating, helpful, comment, pageUrl } = req.body;
    const feedback = await recordFeedback({
      chatLogId,
      rating,
      helpful,
      comment,
      pageUrl
    });
    res.status(201).json({ success: true, message: 'Feedback recorded in MongoDB', data: feedback });
  } catch (err) {
    next(err);
  }
});

app.get('/api/feedback', async (req, res, next) => {
  try {
    const feedback = await getRecentFeedback(50);
    res.json({ success: true, count: feedback.length, data: feedback });
  } catch (err) {
    next(err);
  }
});

/* ==========================================================================
   HEALTH CHECK & DIAGNOSTICS (JSON & METRICS)
   ========================================================================== */
app.get(['/api/health', '/health'], async (req, res) => {
  let sqlStatus = 'healthy';
  let faqCount = 0;
  let ticketCount = 0;

  try {
    const fCount = await dbGet('SELECT COUNT(*) as count FROM faqs');
    const tCount = await dbGet('SELECT COUNT(*) as count FROM support_tickets');
    faqCount = fCount.count;
    ticketCount = tCount.count;
  } catch (e) {
    sqlStatus = `error: ${e.message}`;
  }

  const mongoStatus = getMongoStatus();
  const uptimeSec = process.uptime();
  const mem = process.memoryUsage();

  res.json({
    status: sqlStatus === 'healthy' ? 'healthy' : 'degraded',
    service: 'IsaiStream - Spotify Tamil Edition Platform',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(uptimeSec),
    uptimeFormatted: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${Math.floor(uptimeSec % 60)}s`,
    databases: {
      sql: {
        type: 'SQLite Database',
        status: sqlStatus,
        tables: {
          faqs: faqCount,
          support_tickets: ticketCount
        }
      },
      mongodb: {
        status: mongoStatus.connected ? 'connected' : 'fallback_mode',
        mode: mongoStatus.state,
        storageTarget: mongoStatus.connected ? 'MongoDB Atlas' : 'Local Resilient JSON Store'
      }
    },
    thirdPartyApi: {
      name: 'Apple iTunes Music API (Tamil Catalog)',
      timeoutLimitMs: DEFAULT_TIMEOUT_MS,
      fallbackConfigured: true,
      endpoint: '/api/explore/third-party'
    },
    performance: {
      totalRequests: requestMetrics.totalRequests,
      status2xx: requestMetrics.status2xx,
      status4xx: requestMetrics.status4xx,
      status5xx: requestMetrics.status5xx,
      averageLatencyMs: requestMetrics.totalRequests > 0
        ? Math.round(requestMetrics.totalLatencyMs / requestMetrics.totalRequests)
        : 0,
      memoryRssMB: (mem.rss / 1024 / 1024).toFixed(1),
      heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1)
    },
    recentRequests: requestMetrics.recentRequests.slice(0, 8)
  });
});

/* ==========================================================================
   CUSTOM 404 & 500 ERROR MIDDLEWARE
   ========================================================================== */
// 404 Handler
app.use((req, res) => {
  if (req.accepts('html')) {
    sendHtml(res, '404.html', 404);
  } else {
    res.status(404).json({
      errorCode: 404,
      error: 'Not Found',
      message: `The requested path '${req.originalUrl}' does not exist on this server.`,
      askAssistantUrl: `/?ask=404&path=${encodeURIComponent(req.originalUrl)}`
    });
  }
});

// 500 Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[Server Error ${statusCode}]`, err.message);

  if (req.accepts('html')) {
    sendHtml(res, '500.html', statusCode);
  } else {
    res.status(statusCode).json({
      errorCode: statusCode,
      error: statusCode === 500 ? 'Internal Server Error' : 'Application Error',
      message: err.message || 'An unexpected server error occurred.',
      askAssistantUrl: `/?ask=${statusCode}&error=${encodeURIComponent(err.message || '')}`
    });
  }
});

/* ==========================================================================
   START SERVER & INITIALIZE DATABASES
   ========================================================================== */
async function startServer() {
  console.log('--- Initializing IsaiStream Backend ---');
  await initSqlDatabase();
  await connectMongo();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  🎵 IsaiStream - Spotify Tamil Edition is LIVE!`);
    console.log(`  🌐 Local Server: http://localhost:${PORT}`);
    console.log(`  📋 Health Status: http://localhost:${PORT}/status`);
    console.log(`  ❓ FAQs Page: http://localhost:${PORT}/faq`);
    console.log(`  💎 Subscription Plans: http://localhost:${PORT}/plans`);
    console.log(`  ⚠️ Error Codes: http://localhost:${PORT}/errors`);
    console.log(`=======================================================`);
  });
}

startServer();
