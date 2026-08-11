/* ===== EDUVERSE AI — FULL BACKEND SERVER ===== */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const fetch = require('node-fetch');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_DOCUMENT_CHARS = 60000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const sessions = new Map();
const googleStates = new Map();

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; }
}
function writeUsers(users) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}
function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, college: user.college || '', branch: user.branch || '', provider: user.provider || 'password' };
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function passwordMatches(password, savedHash) {
  const [salt, hash] = String(savedHash || '').split(':');
  if (!salt || !hash) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(actual, 'hex'));
}
function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  return token;
}
function getSessionUser(token) {
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); return null; }
  return readUsers().find(user => user.id === session.userId) || null;
}

// ==================== MIDDLEWARE ====================
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    process.env.FRONTEND_URL || 'https://edu-verse-ai-nqng.vercel.app',
    /\.vercel\.app$/,
    /\.onrender\.com$/
  ],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    // Avoid old JavaScript/CSS being kept after a local update.
    if (/\.(js|css|html)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-store');
  }
}));

// ==================== FILE UPLOAD SETUP ====================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf', 'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg', 'image/png', 'image/webp'
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'));
    }
  }
});


// ==================== AI HELPER (MULTI-MODEL FALLBACK — NO LIMITS) ====================
// Models are tried in order. When one hits a rate/token limit, the next is used automatically.
// Combined daily token budget: ~2,000,000+ tokens across all models.
const GROQ_MODELS = [
  { id: 'llama-3.1-8b-instant',       tpd: '500K',  maxTokens: 2048 },
  { id: 'llama-3.3-70b-versatile',    tpd: '100K',  maxTokens: 1024 },
  { id: 'llama-3.1-70b-versatile',    tpd: '500K',  maxTokens: 1024 },
  { id: 'gemma-7b-it',                tpd: '500K',  maxTokens: 2048 },
];

function getGroqClient(apiKey) {
  const key = process.env.GROQ_API_KEY || apiKey;
  if (!key || key === 'your_groq_api_key_here') {
    throw new Error('GROQ_API_KEY not configured. Please add your API key in Settings.');
  }
  return new Groq({ apiKey: key });
}

// Core generator — tries each model until one succeeds
async function aiGenerate(prompt, apiKey) {
  const client = getGroqClient(apiKey);
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  let lastError = null;

  for (const model of GROQ_MODELS) {
    try {
      console.log(`Trying model: ${model.id} (${model.tpd} TPD)`);
      const response = await client.chat.completions.create({
        model: model.id,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: model.maxTokens,
      });
      const text = response.choices[0]?.message?.content || '';
      console.log(`✅ Success with ${model.id}`);
      return text;
    } catch (err) {
      const msg = err.message || '';
      const isRateLimit = msg.includes('429') || msg.includes('rate_limit') ||
                          msg.includes('Rate limit') || msg.includes('TPD') ||
                          msg.includes('tokens per day') || msg.includes('quota');
      const isModelUnavailable = msg.includes('model') && (msg.includes('not found') || msg.includes('deprecated'));

      console.log(`❌ ${model.id} failed: ${msg.slice(0, 120)}`);
      lastError = err;

      if (isRateLimit || isModelUnavailable) {
        // Try next model in list
        console.log(`Switching to next model...`);
        await delay(300); // small pause before switching
        continue;
      }
      // Non-rate-limit error — don't try other models, just throw
      throw new Error(msg);
    }
  }

  // All models exhausted — give a friendly message
  throw new Error(
    'All AI models are temporarily at their usage limit. Please wait a few minutes and try again, or come back in a few hours for the daily limit to reset.'
  );
}

// Chat variant — tries each model in order for conversation history
async function aiChat(messages, apiKey) {
  const client = getGroqClient(apiKey);
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const groqMessages = messages.map(m => ({
    role: m.role === 'ai' ? 'assistant' : 'user',
    content: m.content || m.parts || ''
  }));

  for (const model of GROQ_MODELS) {
    try {
      console.log(`Chat trying model: ${model.id}`);
      const response = await client.chat.completions.create({
        model: model.id,
        messages: groqMessages,
        temperature: 0.7,
        max_tokens: model.maxTokens,
      });
      console.log(`✅ Chat success with ${model.id}`);
      return response.choices[0]?.message?.content || '';
    } catch (err) {
      const msg = err.message || '';
      const isRateLimit = msg.includes('429') || msg.includes('rate_limit') ||
                          msg.includes('Rate limit') || msg.includes('TPD') ||
                          msg.includes('tokens per day');
      console.log(`❌ Chat ${model.id} failed: ${msg.slice(0, 80)}`);
      if (isRateLimit) { await delay(300); continue; }
      throw new Error(msg);
    }
  }
  throw new Error('All AI models are temporarily at capacity. Please try again shortly.');
}

// Simple single-model generate (kept for backward compat — now delegates to aiGenerate)
async function groqGenerate(prompt, apiKey) {
  return await aiGenerate(prompt, apiKey);
}

async function groqChat(messages, apiKey) {
  return await aiChat(messages, apiKey);
}


// ==================== CLEANUP HELPER ====================

function deleteFile(filePath) {
  setTimeout(() => {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
  }, 60000); // Delete after 1 min
}

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', groqConfigured: !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') });
});

// ==================== AUTHENTICATION ====================
app.post('/api/auth/signup', (req, res) => {
  const { firstName = '', lastName = '', email = '', password = '', college = '', branch = '' } = req.body;
  const cleanEmail = email.trim().toLowerCase();
  if (!firstName.trim() || !cleanEmail || !password) return res.status(400).json({ error: 'Name, email, and password are required.' });
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const users = readUsers();
  if (users.some(user => user.email === cleanEmail)) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = { id: crypto.randomUUID(), email: cleanEmail, name: `${firstName.trim()} ${lastName.trim()}`.trim(), college: college.trim(), branch: branch.trim(), passwordHash: hashPassword(password), provider: 'password', createdAt: new Date().toISOString() };
  users.push(user); writeUsers(users);
  res.status(201).json({ user: publicUser(user), token: createSession(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email = '', password = '' } = req.body;
  const user = readUsers().find(item => item.email === email.trim().toLowerCase());
  if (!user || !user.passwordHash || !passwordMatches(password, user.passwordHash)) return res.status(401).json({ error: 'Incorrect email or password.' });
  res.json({ user: publicUser(user), token: createSession(user) });
});

app.get('/api/auth/me', (req, res) => {
  const user = getSessionUser(req.headers.authorization?.replace(/^Bearer\s+/i, ''));
  if (!user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) sessions.delete(token);
  res.status(204).end();
});

app.get('/api/auth/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).send('Google sign-in is not configured.');
  const state = crypto.randomBytes(24).toString('hex');
  googleStates.set(state, Date.now() + 10 * 60 * 1000);
  // GOOGLE_REDIRECT_URI must match exactly what is set in Google Cloud Console
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!redirectUri) return res.status(503).send('GOOGLE_REDIRECT_URI env variable not set.');
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/api/auth/google/callback', async (req, res) => {
  // After Google auth, we redirect the user BACK to the frontend (Vercel) with their token
  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://edu-verse-ai-nqng.vercel.app';
  const { code, state: oauthState, error } = req.query;
  const expiresAt = googleStates.get(oauthState);
  googleStates.delete(oauthState);
  if (error || !code || !expiresAt || expiresAt < Date.now()) {
    return res.redirect(`${FRONTEND_URL}/?authError=google`);
  }
  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error('Google token exchange failed');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email || !profile.email_verified) throw new Error('Google did not provide a verified email');
    const users = readUsers();
    let user = users.find(item => item.email === profile.email.toLowerCase());
    if (!user) {
      user = { id: crypto.randomUUID(), email: profile.email.toLowerCase(), name: profile.name || profile.email.split('@')[0], provider: 'google', googleId: profile.sub, createdAt: new Date().toISOString() };
      users.push(user);
      writeUsers(users);
    }
    // Redirect back to the Vercel frontend with the session token
    res.redirect(`${FRONTEND_URL}/?authToken=${createSession(user)}`);
  } catch (err) {
    console.error('Google authentication failed:', err.message);
    res.redirect(`${FRONTEND_URL}/?authError=google`);
  }
});

// ==================== AI CHAT ====================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, subject, history = [], apiKey, documentText = '', documentName = '' } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    const systemContext = `You are PRINCE, an expert AI tutor for engineering students specializing in ${subject || 'Engineering'}. 
You provide clear, structured, and comprehensive explanations.
Always use markdown formatting:
- **Bold** for key terms
- Code blocks with language tags for code
- Tables for comparisons
- Bullet points for lists
- Numbered lists for steps
Be encouraging, accurate, and educational. Include:
1. Core explanation with examples
2. Code snippets when relevant  
3. Key formulas or algorithms
4. Real-world applications
5. Exam tips when helpful`;

    const histContext = history.slice(-6).map(h =>
      `${h.role === 'user' ? 'Student' : 'PRINCE'}: ${h.content}`
    ).join('\n\n');

    const documentContext = documentText.trim()
      ? `\n\nUploaded document (${documentName || 'unnamed document'}):\n---\n${documentText.slice(0, MAX_DOCUMENT_CHARS)}\n---\nUse this document as the primary source. Answer only from it when the question relates to the document. If the answer is not in the document, clearly say so rather than guessing.`
      : '';

    const fullPrompt = `${systemContext}${documentContext}

${histContext ? `Previous conversation:\n${histContext}\n\n` : ''}Student asks: ${message}

Provide a comprehensive, well-structured response:`;

    const response = await aiGenerate(fullPrompt, apiKey);
    res.json({ response });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== PDF UPLOAD & ANALYSIS ====================
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let textContent = '';
    const { apiKey } = req.body;

    if (req.file.mimetype === 'application/pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        textContent = pdfData.text.substring(0, MAX_DOCUMENT_CHARS);
      } catch (parseError) {
        console.error(`PDF text extraction failed for ${req.file.originalname}:`, parseError.message);
        textContent = '';
      }
    } else if (req.file.mimetype === 'text/plain') {
      textContent = fs.readFileSync(filePath, 'utf-8').substring(0, MAX_DOCUMENT_CHARS);
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      textContent = result.value.substring(0, MAX_DOCUMENT_CHARS);
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      const JSZip = require('jszip');
      const { XMLParser } = require('fast-xml-parser');
      const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
      const parser = new XMLParser({ ignoreAttributes: false });
      const slideNames = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
      const slides = await Promise.all(slideNames.map(async (name, index) => {
        const xml = await zip.file(name).async('string');
        const parsed = parser.parse(xml);
        const values = [];
        const collect = value => {
          if (!value || typeof value !== 'object') return;
          if (Array.isArray(value)) return value.forEach(collect);
          for (const [key, item] of Object.entries(value)) {
            if (key === 'a:t' && typeof item === 'string') values.push(item);
            else collect(item);
          }
        };
        collect(parsed);
        return `Slide ${index + 1}: ${values.join(' ')}`;
      }));
      textContent = slides.join('\n\n').substring(0, MAX_DOCUMENT_CHARS);
    } else if (req.file.mimetype.startsWith('image/')) {
      // Never send a made-up image description to the AI as if it were document text.
      textContent = '';
    } else {
      textContent = `No readable text could be extracted from ${req.file.originalname}.`;
    }

    if (!textContent.trim()) {
      deleteFile(filePath);
      return res.status(422).json({
        error: 'No readable text was found in this file. This can happen with scanned/image-only PDFs and image files; OCR support is required for those files.'
      });
    }

    // Generate quick summary
    let summary = '';
    if (textContent && apiKey) {
      const summaryPrompt = `The text below was extracted from the uploaded file "${req.file.originalname}". Summarize only this extracted content in 3-4 sentences. Identify the subject area and key topics. Do not say you cannot access the file, and do not add facts that are not in the text.\n\nEXTRACTED TEXT:\n${textContent.substring(0, 5000)}`;
      summary = await aiGenerate(summaryPrompt, apiKey);
    }

    deleteFile(filePath);
    res.json({
      success: true,
      filename: req.file.originalname,
      size: req.file.size,
      textContent: textContent.substring(0, MAX_DOCUMENT_CHARS),
      summary,
      charCount: textContent.length
    });
  } catch (err) {
    if (filePath) deleteFile(filePath);
    console.error('Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== GENERATE NOTES ====================
app.post('/api/notes', async (req, res) => {
  try {
    const { topic, subject, type = 'revision', textContent, apiKey } = req.body;
    const source = textContent ? `Based on this content:\n${textContent.substring(0, 8000)}\n\n` : '';
    const typeInstructions = {
      revision: 'Create concise revision notes with key points, definitions, and formulas. Use bullet points and headings.',
      short: 'Create very short flash-card style notes. Maximum 1-2 lines per point.',
      long: 'Create comprehensive detailed notes with full explanations, examples, derivations, and diagrams described in text.',
      formula: 'Create a complete formula sheet with all important formulas, their variables explained, and when to use each.',
      summary: 'Create a structured summary with Introduction, Key Concepts, Important Points, and Conclusion.',
      cheatsheet: 'Create a cheat sheet with the most important things to remember. Organized, compact, exam-ready.'
    };

    const prompt = `${source}Generate ${typeInstructions[type] || typeInstructions.revision}

Topic: ${topic || 'General Engineering'}
Subject: ${subject || 'Engineering'}

Format with proper markdown:
- Use # ## ### for headings
- Use **bold** for important terms
- Use code blocks for formulas/code
- Use tables where helpful
- Make it exam-ready and comprehensive`;

    const notes = await aiGenerate(prompt, apiKey);
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== GENERATE QUIZ ====================
app.post('/api/quiz', async (req, res) => {
  try {
    const { topic, subject, difficulty = 'medium', count = 10, type = 'mcq', textContent, apiKey, excludeQuestions = [] } = req.body;
    const source = textContent ? `Based on this content:\n${textContent.substring(0, 6000)}\n\n` : '';

    const prompt = `${source}Generate ${count} ${difficulty} difficulty ${type.toUpperCase()} questions on:
Topic: ${topic || subject || 'Engineering'}
Subject: ${subject || 'Engineering'}

Return ONLY a valid JSON array in this exact format (no markdown, no extra text):
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Why this answer is correct",
    "difficulty": "${difficulty}",
    "marks": 1
  }
]

${type === 'fill' ? 'For fill-in-the-blank, use "___" in the question for the blank.' : ''}
${type === 'tf' ? 'For true/false, options should be ["True", "False"]' : ''}
Make questions exam-relevant, accurate, and educational.${Array.isArray(excludeQuestions) && excludeQuestions.length ? `\nDo not repeat these previously used questions:\n${excludeQuestions.slice(-30).join('\n')}` : ''}`;

    const response = await aiGenerate(prompt, apiKey);

    // Parse JSON from response
    let questions;
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      questions = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch {
      // If JSON parsing fails, create structured questions from text
      questions = [{ question: 'Quiz generated - please check your API key and try again', options: ['A', 'B', 'C', 'D'], correct: 0, explanation: response.substring(0, 200), difficulty, marks: 1 }];
    }

    res.json({ questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== GENERATE FLASHCARDS ====================
app.post('/api/flashcards', async (req, res) => {
  try {
    const { topic, subject, count = 15, textContent, apiKey } = req.body;
    const source = textContent ? `Based on this content:\n${textContent.substring(0, 6000)}\n\n` : '';

    const prompt = `${source}Generate ${count} flashcards for:
Topic: ${topic || subject || 'Engineering'}
Subject: ${subject || 'Engineering'}

Return ONLY a valid JSON array (no markdown):
[
  {
    "front": "Question or term on front of card",
    "back": "Answer or definition on back of card",
    "category": "Category name",
    "difficulty": "easy|medium|hard"
  }
]

Make flashcards concise, memorable, and exam-focused.`;

    const response = await aiGenerate(prompt, apiKey);

    let flashcards;
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      flashcards = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch {
      flashcards = [{ front: 'Error generating flashcards', back: 'Please check your API key', category: 'Error', difficulty: 'easy' }];
    }

    res.json({ flashcards });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== GENERATE MIND MAP ====================
app.post('/api/mindmap', async (req, res) => {
  try {
    const { topic, textContent, apiKey } = req.body;
    const source = textContent ? `Based on this content:\n${textContent.substring(0, 5000)}\n\n` : '';

    const prompt = `${source}Create a detailed mind map structure for: "${topic || 'Engineering'}"

Return ONLY valid JSON (no markdown, no extra text). Convert the user's full prompt into a concise visual hierarchy. Every label and every sub-topic MUST be a plain string; never return nested objects inside "subs".
{
  "center": "Concise central title (maximum 5 words)",
  "nodes": [
    {
      "label": "Main Branch 1 (maximum 4 words)",
      "color": "#2563EB",
      "subs": ["Short sub-topic 1", "Short sub-topic 2", "Short sub-topic 3"]
    },
    {
      "label": "Main Branch 2",
      "color": "#7C3AED",
      "subs": ["Sub-topic 1", "Sub-topic 2"]
    }
  ]
}

Include 5-6 main branches, each with 2-3 short sub-topics. Colors should be hex codes from: #2563EB, #7C3AED, #06B6D4, #10B981, #F59E0B, #EF4444, #8B5CF6, #EC4899`;

    const response = await aiGenerate(prompt, apiKey);

    let mindmap;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      mindmap = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch {
      mindmap = {
        center: topic || 'Topic',
        nodes: [
          { label: 'Definition', color: '#2563EB', subs: ['Core Concept', 'History', 'Purpose'] },
          { label: 'Types', color: '#7C3AED', subs: ['Type A', 'Type B', 'Type C'] },
          { label: 'Applications', color: '#06B6D4', subs: ['Industry', 'Research', 'Education'] },
          { label: 'Advantages', color: '#10B981', subs: ['Speed', 'Accuracy', 'Cost'] },
          { label: 'Challenges', color: '#F59E0B', subs: ['Complexity', 'Resources'] },
          { label: 'Future', color: '#EF4444', subs: ['Trends', 'Innovations'] }
        ]
      };
    }

    res.json({ mindmap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SEMESTER PLANNER ====================
app.post('/api/planner', async (req, res) => {
  try {
    const { university, semester, branch, subjects, examDate, hoursPerDay, apiKey } = req.body;

    const prompt = `Create a detailed personalized semester study plan for an engineering student.

University: ${university || 'Engineering University'}
Semester: ${semester || '6th'}
Branch: ${branch || 'Computer Science'}
Subjects: ${subjects || 'DSA, DBMS, Computer Networks, OS, Theory of Computation'}
Exam Date: ${examDate || '45 days from now'}
Study Hours per Day: ${hoursPerDay || 4}

Create a comprehensive study plan with:
1. **Week-by-Week Breakdown** - What to study each week
2. **Daily Schedule Template** - Hour-by-hour timetable
3. **Subject-wise Strategy** - How to approach each subject
4. **Revision Plan** - Last 2 weeks revision schedule
5. **Important Tips** - Memory techniques, exam strategies
6. **Mock Test Schedule** - When to take practice tests

Use markdown formatting with tables, bullet points, and clear headings. Make it practical and achievable.`;

    const plan = await aiGenerate(prompt, apiKey);
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== VIVA QUESTIONS ====================
app.post('/api/viva', async (req, res) => {
  try {
    const { subject, topic, difficulty = 'medium', count = 10, textContent, apiKey, excludeQuestions = [] } = req.body;
    const source = textContent ? `Based on: ${textContent.substring(0, 4000)}\n\n` : '';

    const prompt = `${source}Generate ${count} viva voce (oral exam) questions for:
Subject: ${subject || 'Computer Science'}
Topic: ${topic || 'General'}
Difficulty: ${difficulty}

Return ONLY valid JSON array:
[
  {
    "question": "Oral exam question",
    "expectedAnswer": "Complete expected answer the student should give",
    "followUp": "Possible follow-up question",
    "tips": "Tips for answering confidently",
    "difficulty": "${difficulty}"
  }
]

Questions should test deep understanding, not just memorization. Include practical examples and applications.`;

    const avoid = Array.isArray(excludeQuestions) && excludeQuestions.length
      ? `\nDo not repeat these already-used questions:\n${excludeQuestions.slice(-30).join('\n')}`
      : '';
    const response = await aiGenerate(prompt + avoid, apiKey);

    let questions;
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      questions = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch {
      questions = [{ question: 'Error generating questions', expectedAnswer: response.substring(0, 200), followUp: '', tips: 'Check API key', difficulty }];
    }

    res.json({ questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CODE REVIEW ====================
app.post('/api/code/review', async (req, res) => {
  try {
    const { code, language, apiKey } = req.body;
    const prompt = `Perform a comprehensive code review for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Provide:
1. **Code Quality Score** (1-10)
2. **Time Complexity** - Big O analysis
3. **Space Complexity** - Big O analysis  
4. **Bugs Found** - List any bugs or issues
5. **Security Issues** - Any security concerns
6. **Style Issues** - Naming, formatting, conventions
7. **Optimization Suggestions** - How to improve performance
8. **Best Practices** - What's done well, what needs improvement
9. **Improved Version** - Provide optimized code

Be specific with line numbers and examples.`;

    const review = await aiGenerate(prompt, apiKey);
    res.json({ review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CODE EXPLAIN ====================
app.post('/api/code/explain', async (req, res) => {
  try {
    const { code, language, apiKey } = req.body;
    const prompt = `Explain this ${language} code in detail, line by line:

\`\`\`${language}
${code}
\`\`\`

Provide:
1. **Overview** - What this code does in 2-3 sentences
2. **Line-by-Line Explanation** - Explain each important line
3. **Key Concepts Used** - Data structures, algorithms, patterns
4. **Flowchart** (in text/ASCII) - How the code flows
5. **Example Run** - Walk through with sample input/output
6. **Use Cases** - When would you use this code

Make it understandable for a student learning programming.`;

    const explanation = await aiGenerate(prompt, apiKey);
    res.json({ explanation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CODE OPTIMIZE ====================
app.post('/api/code/optimize', async (req, res) => {
  try {
    const { code, language, apiKey } = req.body;
    const prompt = `Optimize this ${language} code for better performance:

\`\`\`${language}
${code}
\`\`\`

Provide:
1. **Current Complexity** - Time and space
2. **Bottlenecks** - What's slowing it down
3. **Optimized Code** - Improved version with comments
4. **Improved Complexity** - After optimization
5. **Explanation** - What changes were made and why
6. **Benchmarks** - Expected performance improvement

Show the optimized code in a code block.`;

    const optimized = await aiGenerate(prompt, apiKey);
    res.json({ optimized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CODE BUG FIX ====================
app.post('/api/code/fix', async (req, res) => {
  try {
    const { code, language, error: errorMsg, apiKey } = req.body;
    const prompt = `Debug and fix this ${language} code:

\`\`\`${language}
${code}
\`\`\`

${errorMsg ? `Error message: ${errorMsg}` : ''}

Provide:
1. **Bugs Found** - List all bugs with line numbers
2. **Root Cause** - Why each bug occurs
3. **Fixed Code** - Complete corrected code in a code block
4. **What Changed** - Detailed explanation of fixes
5. **Prevention Tips** - How to avoid similar bugs

Make sure the fixed code is complete and runnable.`;

    const fix = await aiGenerate(prompt, apiKey);
    res.json({ fix });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CODE GENERATE ====================
app.post('/api/code/generate', async (req, res) => {
  try {
    const { prompt: userPrompt, language, apiKey } = req.body;
    const prompt = `Generate clean, well-commented ${language} code for:
${userPrompt}

Requirements:
- Write production-quality code
- Add clear comments explaining each section
- Handle edge cases
- Include example usage
- Follow best practices for ${language}

Provide only the code in a code block, then a brief explanation.`;

    const generatedCode = await aiGenerate(prompt, apiKey);
    res.json({ code: generatedCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CODE EXECUTION ====================
// Using Judge0 CE public API (free, no API key needed)
const JUDGE0_URL = 'https://judge0-ce.p.rapidapi.com';

// Judge0 language IDs
const JUDGE0_LANGS = {
  python:     { id: 71,  name: 'Python (3.8.1)' },
  javascript: { id: 63,  name: 'JavaScript (Node.js 12.14.0)' },
  java:       { id: 62,  name: 'Java (OpenJDK 13.0.1)' },
  c:          { id: 50,  name: 'C (GCC 9.2.0)' },
  cpp:        { id: 54,  name: 'C++ (GCC 9.2.0)' },
  rust:       { id: 73,  name: 'Rust (1.40.0)' },
  go:         { id: 60,  name: 'Go (1.13.5)' },
  php:        { id: 68,  name: 'PHP (7.4.1)' },
  ruby:       { id: 72,  name: 'Ruby (2.7.0)' },
  typescript: { id: 74,  name: 'TypeScript (3.7.4)' },
};

// Alternative: use Groq to simulate code execution when Judge0 unavailable
async function runCodeWithGroq(code, language, stdin, apiKey) {
  const prompt = `You are a code interpreter. Execute the following ${language} code and show ONLY the exact output that would be printed to stdout. Do not explain anything, just show the output exactly as it would appear in a terminal.

Code:
\`\`\`${language}
${code}
\`\`\`
${stdin ? `\nStdin input:\n${stdin}` : ''}

OUTPUT (show only what would be printed, nothing else):`;

  const text = await aiGenerate(prompt, apiKey);
  return text.trim();
}

app.post('/api/code/run', async (req, res) => {
  try {
    const { code, language, stdin = '', apiKey } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'Code is required' });

    const langInfo = JUDGE0_LANGS[language] || JUDGE0_LANGS.python;
    const rapidApiKey = process.env.RAPIDAPI_KEY || '';

    // Try Judge0 with RapidAPI key if available
    if (rapidApiKey) {
      try {
        // Submit
        const submitRes = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
          },
          body: JSON.stringify({
            source_code: code,
            language_id: langInfo.id,
            stdin: stdin || '',
            cpu_time_limit: 10,
            memory_limit: 262144
          })
        });
        const { token } = await submitRes.json();

        // Poll for result
        let result = null;
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 800));
          const pollRes = await fetch(`${JUDGE0_URL}/submissions/${token}?base64_encoded=false`, {
            headers: {
              'X-RapidAPI-Key': rapidApiKey,
              'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
            }
          });
          result = await pollRes.json();
          if (result.status?.id >= 3) break;
        }

        return res.json({
          stdout: result?.stdout || '',
          stderr: result?.stderr || result?.compile_output || '',
          code: result?.status?.id === 3 ? 0 : 1,
          compile_output: result?.compile_output || '',
          output: result?.stdout || result?.stderr || ''
        });
      } catch (e) {
        console.log('Judge0 failed, falling back to AI:', e.message);
      }
    }

    // Fallback: AI-simulated code execution via Groq
    console.log(`Running ${language} code via AI simulation`);
    const start = Date.now();
    const simulatedOutput = await runCodeWithGroq(code, language, stdin, process.env.GROQ_API_KEY);
    const elapsed = Date.now() - start;

    res.json({
      stdout: simulatedOutput + '\n',
      stderr: '',
      code: 0,
      compile_output: '',
      output: simulatedOutput,
      note: 'AI-simulated execution'
    });

  } catch (err) {
    console.error('Code run error:', err.message);
    res.status(500).json({ error: `Code execution failed: ${err.message}` });
  }
});



// ==================== VIDEO SUMMARIZER ====================

app.post('/api/video', async (req, res) => {
  try {
    const { url, topic, apiKey } = req.body;
    const videoId = url?.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1];

    const prompt = `Summarize and create study notes for this YouTube educational video:
URL: ${url || 'Engineering lecture'}
Topic/Title: ${topic || 'Engineering Lecture'}
${videoId ? `Video ID: ${videoId}` : ''}

Since I cannot access the video directly, create comprehensive study notes based on what is likely covered in an engineering lecture about: "${topic || 'Engineering'}"

Provide:
1. **Video Overview** - What this topic covers
2. **Key Concepts** - Main ideas and explanations
3. **Important Points** - Critical things to remember
4. **Formulas & Algorithms** - If applicable
5. **Quiz Questions** - 5 practice questions
6. **Summary** - 5-bullet point summary
7. **Further Reading** - Related topics to explore

Use rich markdown formatting.`;

    const summary = await aiGenerate(prompt, apiKey);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== TRANSLATE ====================
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLanguage, apiKey } = req.body;
    const prompt = `Translate the following educational content to ${targetLanguage}.
Maintain all technical terms, formulas, and code snippets in their original form.
Only translate the explanatory text.

Content to translate:
${text.substring(0, 5000)}

Provide the translation while preserving markdown formatting.`;

    const translation = await aiGenerate(prompt, apiKey);
    res.json({ translation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== RESUME BUILDER ====================
app.post('/api/resume', async (req, res) => {
  try {
    const { name, email, phone, college, branch, semester, skills, projects, internships, apiKey } = req.body;

    const prompt = `Create a professional ATS-optimized resume for an engineering student:

Name: ${name}
Email: ${email}
Phone: ${phone}
College: ${college}
Branch: ${branch}
Semester: ${semester}
Skills: ${skills}
Projects: ${projects}
Internships: ${internships || 'None'}

Generate a complete resume in markdown format that:
1. Is ATS (Applicant Tracking System) optimized
2. Highlights technical skills prominently
3. Has strong action verbs
4. Includes all standard sections
5. Is formatted professionally

Also provide:
- **ATS Score**: Estimated ATS compatibility score (out of 100)
- **Improvement Tips**: 5 specific ways to improve
- **Missing Sections**: What should be added`;

    const resume = await aiGenerate(prompt, apiKey);
    res.json({ resume });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== MOCK INTERVIEW ====================
app.post('/api/interview', async (req, res) => {
  try {
    const { company, role, round, experience, apiKey } = req.body;

    const prompt = `Generate a realistic mock interview for:
Company: ${company || 'Top Tech Company'}
Role: ${role || 'Software Engineer'}
Round: ${round || 'Technical Round 1'}
Experience: ${experience || 'Fresher'}

Provide:
1. **Interview Introduction** - How the interviewer starts
2. **Warm-up Questions** (3 questions with ideal answers)
3. **Technical Questions** (5 coding/concept questions with solutions)
4. **HR Questions** (3 questions with sample answers)
5. **Questions to Ask Interviewer** (3 smart questions)
6. **Interview Tips** - Company-specific preparation advice
7. **Red Flags** - Common mistakes to avoid

Format as a realistic interview conversation with Q&A format.`;

    const interview = await aiGenerate(prompt, apiKey);
    res.json({ interview });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== AI CAMERA (Image Analysis) ====================
app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const { apiKey, type = 'explain' } = req.body;

    const imageData = fs.readFileSync(filePath);
    const base64Image = imageData.toString('base64');

    const prompts = {
      explain: 'Analyze this image. If it contains a question, solve it step by step. If it contains notes or diagrams, explain everything clearly. If it\'s a circuit diagram, explain its components and working. Provide detailed educational content.',
      solve: 'Solve the problem shown in this image step by step. Show all working and explain each step.',
      summarize: 'Summarize the content in this image. Create study notes from what you see.',
      translate: 'Describe and explain all content visible in this image in English, even if it\'s in another language.'
    };

    // Groq doesn't support vision - return message about limitation
    const analysis = `Image analysis is not available with Groq API as it doesn't support vision capabilities. Please upload PDFs, text files, or use the text-based AI features for content analysis.\n\nTo use image analysis, you would need to switch to a vision-capable AI provider.`;
    deleteFile(filePath);
    res.json({ analysis });
  } catch (err) {
    if (filePath) deleteFile(filePath);
    res.status(500).json({ error: err.message });
  }
});

// ==================== SAVE API KEY ====================
app.post('/api/save-key', (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API key is required' });

    // Write to .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
      envContent = envContent.replace(/GROQ_API_KEY=.*/g, '');
    }
    envContent = `GROQ_API_KEY=${apiKey}\nPORT=${process.env.PORT || 3000}\n`;
    fs.writeFileSync(envPath, envContent);
    process.env.GROQ_API_KEY = apiKey;

    res.json({ success: true, message: 'API key saved successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SERVE FRONTEND ====================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log('\n🎓 ============================');
  console.log('   EduVerse AI Backend Server');
  console.log('==============================');
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`🤖 Groq: ${process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here' ? '✅ Configured' : '❌ Not configured (add key in app)'}`);
  console.log(`📁 Uploads: ${uploadsDir}`);
  console.log('==============================\n');
});

module.exports = app;
