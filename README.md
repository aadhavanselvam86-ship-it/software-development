# 🎵 IsaiStream — Spotify Tamil Edition
### Web Audio Streaming Platform with Integrated AI Assistant, SQL FAQs & Multi-Database Architecture

---

## 📋 Final Assessment Submission Details

| Field | Detail |
| :--- | :--- |
| **1. Individual Task Title** | **IsaiStream - Spotify Tamil Edition: Full-Stack Music Platform with Integrated AI Assistant, Error Diagnosis System, and Multi-Database Architecture** |
| **2. Live Website Link (HTTPS)** | [https://spotify-tamil-ai-platform.onrender.com](https://spotify-tamil-ai-platform.onrender.com) |
| **3. GitHub Repository Link** | [https://github.com/aadhavanselvam86-ship-/spotify-tamil-ai-platform](https://github.com/aadhavanselvam86-ship-/spotify-tamil-ai-platform) |
| **Student GitHub ID** | [@aadhavanselvam86-ship-](https://github.com/aadhavanselvam86-ship-) |
| **Platform Topic** | Spotify Tamil App with Original Kollywood Posters, Audio Streaming, Spotify Subscription Tiers (Free, Individual, Duo, Family, Student), and Intelligent AI Support |

---

## 🌟 Executive Overview & Key Features

**IsaiStream** is a dedicated Spotify-inspired music streaming web application curated specifically for Tamil cinema (Kollywood) soundtracks and legendary composers including **Anirudh Ravichander**, **A.R. Rahman**, **Yuvan Shankar Raja**, **Ilaiyaraaja**, **Harris Jayaraj**, and **Govind Vasantha**.

The application features:
1. **Interactive Audio Streaming & Visual Player**:
   - Web audio player dock on every page with play, pause, seek, volume control, track metadata, and real-time audio playback.
   - High-resolution original posters for top Kollywood releases (*Leo*, *Jailer*, *Ponniyin Selvan 1 & 2*, *Vikram*, *Master*, *96*, *Mersal*, *Vaaranam Aayiram*, *Pudhupettai*, *Thalapathi*).
2. **Spotify Subscription Tiers (India INR Pricing)**:
   - **Spotify Free (₹0/mo)**: Shuffle play, standard audio (160 kbps AAC), ad-supported.
   - **Premium Individual (₹119/mo)**: Ad-free, 320 kbps & Lossless FLAC, unlimited skips, 10,000 song downloads on 5 devices.
   - **Premium Duo (₹149/mo)**: 2 separate accounts for couples living under one roof, Duo Mix shared playlist.
   - **Premium Family (₹179/mo)**: Up to 6 accounts, explicit lyric filter controls, Spotify Kids access.
   - **Premium Student (₹59/mo)**: 50% discount for verified college/university students via SheerID.
   - Interactive checkout simulation modal with instant VIP tier unlock.
3. **AI Chat Assistant (IsaiBot)**:
   - Present on **every page** as a persistent floating Spotify-styled widget.
   - Responds dynamically using the **SQL FAQ Knowledge Base**.
   - Identifies and explains all **8 error codes** with technical root causes and exact remedies.
   - Automatically generates a **Support Ticket in the SQL database** when it cannot answer an inquiry or when the user escalates.
   - Powered by dual-mode intelligence: Google Gemini Generative AI API + resilient semantic matching engine.
4. **Multi-Database Architecture**:
   - **SQL (SQLite / PostgreSQL)**: Stores structured FAQs (`faqs` table) and support tickets (`support_tickets` table).
   - **NoSQL (MongoDB / Mongoose)**: Stores conversational transcripts (`chat_logs` collection) and listener satisfaction ratings (`feedback` collection), with a local fallback JSON store ensuring zero crashes.
5. **Third-Party API with Time Limit (Timeout) and Fallback**:
   - Live integration with **Apple iTunes Music API (Tamil Catalog)**.
   - Strict **2.5-second (2500ms) safety threshold** managed by `AbortController`.
   - If external network latency exceeds 2.5s or fails, it automatically recovers by serving the curated offline Tamil master catalog.
   - A live test button (`/api/explore/test-timeout`) is built into the UI for examiners to verify the timeout abort and fallback in real time.
6. **Request Logging & Health Dashboard**:
   - HTTP request logging via **Morgan** writing to `logs/access.log`.
   - Dedicated `/status` graphical diagnostics dashboard and `/api/health` JSON endpoint tracking server uptime, SQL connections, MongoDB state, request counts (2xx, 4xx, 5xx), and average latency.
7. **Custom 404 & 500 Error Pages**:
   - Branded custom pages with animated audio artwork.
   - Includes a prominent **"Ask the AI Assistant"** action button that automatically opens the chat widget pre-filled with the error context.

---

## 🏗️ System Architecture & Database Design

```
                     +---------------------------------------+
                     |         Browser / Client UI           |
                     |  (Home, Plans, FAQ, Errors, Status)   |
                     |     + Floating AI Chat Widget         |
                     +-------------------+-------------------+
                                         |
                                         | HTTP / JSON REST
                                         v
                     +---------------------------------------+
                     |           Express.js Server           |
                     |    Request Logger (Morgan / access.log)
                     +---------+-------------------+---------+
                               |                   |
            +------------------+                   +------------------+
            |                                                         |
            v                                                         v
+-----------------------+                                 +-----------------------+
|  SQL Database (SQLite)|                                 |   MongoDB / Mongoose  |
|-----------------------|                                 |-----------------------|
| - faqs (12 rows seeded|                                 | - chat_logs           |
| - support_tickets     |                                 | - feedback (ratings)  |
+-----------------------+                                 +-----------------------+
            ^                                                         ^
            |                                                         |
+-----------+-----------+                                 +-----------+-----------+
|    AI Assistant       |                                 | Third-Party Music API |
| (Gemini + SQL Search) |                                 | (iTunes 2.5s Timeout) |
+-----------------------+                                 +-----------------------+
```

### SQL Database Schema (`isai_stream.db`)

#### 1. `faqs` Table
```sql
CREATE TABLE faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. `support_tickets` Table
```sql
CREATE TABLE support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number TEXT UNIQUE NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  error_code TEXT,
  status TEXT DEFAULT 'OPEN',     -- OPEN | IN_PROGRESS | RESOLVED
  priority TEXT DEFAULT 'MEDIUM', -- LOW | MEDIUM | HIGH | URGENT
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### MongoDB Collections Schema

#### 1. `chat_logs` Collection
```json
{
  "_id": "uuid-v4",
  "sessionId": "sess_x89a1bc",
  "userMessage": "What is Error 488?",
  "assistantReply": "### Error 488: TAMIL_VIP_REQUIRED...",
  "intent": "ERROR_EXPLAIN",
  "matchedFaqId": null,
  "ticketCreated": false,
  "ticketNumber": null,
  "createdAt": "2026-11-14T04:45:00.000Z"
}
```

#### 2. `feedback` Collection
```json
{
  "_id": "uuid-v4",
  "chatLogId": "uuid-v4",
  "rating": 5,
  "helpful": true,
  "comment": "Explained the student verification clearly!",
  "pageUrl": "/plans",
  "createdAt": "2026-11-14T04:46:12.000Z"
}
```

---

## ⚠️ Catalog of 8 Error Codes & Simulation Endpoints

All 8 required error codes are documented, simulated via live endpoints (`/api/simulate-error/:code`), and fully understood by the AI Assistant:

| Code | Title | Category | Technical Cause | User Explanation & Remedy | Simulation Route |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **400** | Bad Request | Client Syntax | Missing required query parameters or invalid ticket body payload. | Check syntax, verify alphanumeric search terms. | `GET /api/simulate-error/400` |
| **401** | Unauthorized | Authentication | Missing or expired JWT session token when streaming protected playlists. | Log into your IsaiStream account to re-authenticate session. | `GET /api/simulate-error/401` |
| **403** | Forbidden | Authorization | Regional DRM copyright licensing restriction on Kollywood soundtracks outside India. | Access blocked due to regional licensing. Connect from authorized IP. | `GET /api/simulate-error/403` |
| **404** | Not Found | Missing Resource | Tamil track ID, album, or route does not exist in catalog. | Verify URL spelling or search by movie/composer name. | `GET /api/simulate-error/404` |
| **429** | Too Many Requests | Rate Limiting | Streaming client exceeded rate limit threshold of 60 requests/minute. | Pause song skipping for 30 seconds or upgrade to Premium. | `GET /api/simulate-error/429` |
| **500** | Internal Server Error | Server Exception | Unhandled error in audio transcode pipeline or database query. | Refresh page or let AI Assistant file a support ticket. | `GET /api/simulate-error/500` |
| **503** | Service Unavailable | Edge Maintenance | Tamil streaming CDN edge cluster is undergoing scheduled maintenance. | Temporary outage. Check `/status` page and retry shortly. | `GET /api/simulate-error/503` |
| **488** | **TAMIL_VIP_REQUIRED** *(Site-Specific)* | Custom Gate | Attempted to stream 24-bit 192kHz Lossless FLAC or offline download on Free tier. | Exclusive to Spotify Premium. Upgrade on Plans page from ₹59/mo. | `GET /api/simulate-error/488` |

---

## ⏱️ Third-Party API with Time Limit & Fallback

- **Provider**: Apple iTunes Music API (`https://itunes.apple.com/search?term=tamil+hits&entity=song&limit=12`)
- **Safety Threshold**: Configured to `2500ms` via `THIRD_PARTY_API_TIMEOUT_MS`.
- **Implementation**: Utilizes modern JavaScript `AbortController` combined with `setTimeout`.
- **Fallback Trigger**: If the request exceeds 2.5 seconds or encounters DNS/network failure:
  1. The controller immediately aborts the pending request.
  2. The system seamlessly intercepts the abort signal.
  3. The curated offline Tamil master catalog (`data/tamilSongs.json`) is returned with a `fallbackTriggered: true` flag and metadata explanation.
  4. Response is displayed in the UI banner and logged to `access.log`.
- **Live Test Simulation**: Click **"Test Timeout Fallback"** on the home page or execute `GET /api/explore/test-timeout` to force a 1ms timeout and observe the fallback in real time.

---

## 🚀 Step-by-Step Local Setup & Execution

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### Installation
```bash
# 1. Clone repository
git clone https://github.com/aadhavanselvam86-ship-/spotify-tamil-ai-platform.git
cd spotify-tamil-ai-platform

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env

# 4. Start the application
npm start
```

Open your browser at `http://localhost:3000`.

---

## 🌐 Render Cloud Deployment Guide

This project is configured for 1-click deployment on [Render](https://render.com) using the included `render.yaml` specification:

1. Push this repository to your GitHub account: `https://github.com/aadhavanselvam86-ship-/spotify-tamil-ai-platform`.
2. Log into **Render** and click **New +** -> **Blueprint**.
3. Connect your GitHub repository.
4. Render will detect `render.yaml` and configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment Variables**:
     - `NODE_ENV=production`
     - `PORT=10000`
     - `SQLITE_DB_PATH=./data/isai_stream.db`
     - `THIRD_PARTY_API_TIMEOUT_MS=2500`
     - `MONGODB_URI` *(optional: your MongoDB Atlas cluster URI)*
     - `GEMINI_API_KEY` *(optional: your Google Gemini API key)*
5. Click **Apply**. Render will build and deploy your live HTTPS web service at:  
   `https://spotify-tamil-ai-platform.onrender.com`

---

## 💡 One Proposed Improvement

### **AI-Powered Acoustic Fingerprinting & Regional Tamil Dialect Voice Search**

**Current Limitation**:
Listeners currently search songs by typing exact song names or composer titles in English or transliterated Tamil (e.g. *"Naa Ready"* or *"Badass"*). However, Tamil music lovers often remember catchy hooks, background whistle themes, humming tunes, or regional colloquial lyrics (Madurai Tamil, Tirunelveli slang, Chennai Gaana).

**Proposed Enhancement**:
1. **Acoustic Audio Fingerprinting (Hum-to-Search)**:
   Integrate a Web Audio API Fourier Transform (FFT) spectrogram extractor that analyzes 5 seconds of microphone audio when a user hums or whistles a Kollywood tune, matching it against a pre-indexed vector embedding database of Tamil songs.
2. **Tamil Dialect Speech-to-Text (ASR) via Gemini Multimodal Live API**:
   Implement real-time Tamil voice recognition that understands Tamil regional dialects (Kongu, Madurai, Madras Baashai). For instance, saying *"அனிருத் மாஸ் பாட்டு ஒன்னு போடு"* (*"Play an Anirudh mass track"*) or *"ரஹ்மான் 90s மெலடி"* (*"Rahman 90s melody"*) will automatically query the database and trigger playback immediately.

---

## ✅ Assessment Rubric Verification Matrix

| Assessment Requirement | Implementation Status | Verification Location |
| :--- | :---: | :--- |
| **Responsive website with at least 3 pages** | ✅ Met (6 pages) | Home (`/`), Plans (`/plans`), FAQ (`/faq`), Errors (`/errors`), Tickets (`/tickets`), Status (`/status`) |
| **Chat widget on every page** | ✅ Met | `public/js/chatWidget.js` loaded globally with persistent floating button & drawer |
| **Minimum 10 FAQs stored in SQL and displayed on FAQ page** | ✅ Met (12 FAQs) | SQLite table `faqs`, seeded from `data/faqsSeed.json`, displayed at `/faq` |
| **Minimum 8 error codes (400, 401, 403, 404, 429, 500, 503, +1 site-specific)** | ✅ Met | 8 codes documented, simulated via `/api/simulate-error/:code`, site-specific: **488 TAMIL_VIP_REQUIRED** |
| **Custom 404 and 500 pages with "Ask the assistant" option** | ✅ Met | `public/404.html` and `public/500.html` with direct "Ask the AI Assistant" trigger |
| **AI assistant answers from FAQ, explains errors, creates SQL ticket** | ✅ Met | `services/aiAssistant.js` with FAQ matching, error code triage, and auto ticket creation |
| **Support tickets stored in SQL; chat logs & feedback in MongoDB** | ✅ Met | SQL table `support_tickets`; MongoDB collections `chat_logs` and `feedback` (with resilient fallback) |
| **API keys in environment variables; no confidential info in GitHub** | ✅ Met | `.env.example`, `.env`, `.gitignore` configured; all keys retrieved via `process.env` |
| **Request logging and health check page** | ✅ Met | Morgan logger to `logs/access.log`, health JSON at `/api/health`, dashboard at `/status` |
| **Third-party API with time limit (timeout) and fallback** | ✅ Met | Apple iTunes Tamil API with 2500ms `AbortController` timeout and local catalog fallback |
| **README containing live link and one proposed improvement** | ✅ Met | Live link provided in header; proposed improvement detailed in Section above |

---

## 📜 License & Acknowledgments

- **Platform**: Developed by **Aadhavan Selvam** as part of the Software Development Final Assessment.
- **Soundtrack Credits**: Music compositions by Anirudh Ravichander, A.R. Rahman, Yuvan Shankar Raja, Ilaiyaraaja, Harris Jayaraj, Govind Vasantha, and respective Kollywood music labels (Sony Music South, Think Music, Sun Pictures, T-Series).
- **License**: MIT Open Source License.
