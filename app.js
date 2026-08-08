/* ===== EDUVERSE AI — FULL FEATURED APP.JS ===== */
/* All features wired to real backend APIs */

// ===================== CONFIG =====================
// Use the local server during development and the Render backend after deployment.
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://eduverseai-1.onrender.com';

let SERVER_ONLINE = false;

// ===================== STATE =====================
const state = {
  theme: localStorage.getItem('theme') || 'dark',
  currentSection: 'hero',
  currentSubject: 'Computer Science',
  apiKey: localStorage.getItem('groqApiKey') || '',
  chatHistory: [],
  currentPDFText: '',
  currentPDFName: '',
  quizData: [],
  quizCurrentQ: 0,
  quizScore: 0,
  quizTopic: '',
  quizSubject: '',
  quizDifficulty: 'medium',
  quizBatchSize: 10,
  placementQuestionHistory: {},
  isVoiceRecording: false,
  ttsEnabled: true,
  speechRequestId: 0,
  speechSafetyTimer: null,
  lastSpokenText: '',
  lastSpokenAt: 0,
  studyData: JSON.parse(localStorage.getItem('studyData') || '{"hours":142,"xp":2840,"streak":21,"rank":47,"activity":{"week":[2,3.5,1.5,4,3,5,2.5],"month":[14,18,12,20,16,22,19,25],"year":[40,35,50,45,60,55,70,65,80,75,90,85]},"subjects":{"Data Structures":87,"Algorithms":72,"DBMS":91,"Computer Networks":65,"Operating Systems":58}}'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  flashcards: [],
  currentFlashcard: 0,
  vivaQuestions: [],
  vivaCurrentQ: 0,
  vivaSubject: '',
  vivaTopic: '',
  mockInterviewCurrent: 0,
  mockInterviewAnswers: [],
  dsaSelectedTopic: 'All Topics',
};

// ===================== API SERVICE =====================
const api = {
  async call(endpoint, method = 'GET', body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const authToken = localStorage.getItem('authToken');
    if (authToken) opts.headers.Authorization = `Bearer ${authToken}`;
    // Only send API key if it's not 'backend-configured' (backend has its own key)
    if (body) {
      const bodyToSend = { ...body };
      if (state.apiKey && state.apiKey !== 'backend-configured') {
        bodyToSend.apiKey = state.apiKey;
      }
      opts.body = JSON.stringify(bodyToSend);
    }
    const resp = await fetch(`${API_BASE}${endpoint}`, opts);
    const raw = await resp.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`Server returned an invalid response (${resp.status}).`); }
    if (!resp.ok) throw new Error(data.error || 'Server error');
    return data;
  },

  async upload(endpoint, formData) {
    const resp = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', body: formData });
    const raw = await resp.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`Upload server returned an invalid response (${resp.status}).`); }
    if (!resp.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  async checkHealth() {
    try {
      const data = await this.call('/api/health');
      SERVER_ONLINE = data.status === 'ok';
      // If backend has Groq configured, we don't need frontend API key
      if (data.groqConfigured && !state.apiKey) {
        state.apiKey = 'backend-configured';
      }
      return data;
    } catch {
      SERVER_ONLINE = false;
      return null;
    }
  },

  chat: (message, subject, history, documentText, documentName) => api.call('/api/chat', 'POST', {
    message, subject, history, documentText, documentName
  }),
  generateNotes: (topic, subject, type, textContent) => api.call('/api/notes', 'POST', { topic, subject, type, textContent }),
  generateQuiz: (topic, subject, difficulty, count, textContent, excludeQuestions = []) => api.call('/api/quiz', 'POST', { topic, subject, difficulty, count, textContent, excludeQuestions }),
  generateFlashcards: (topic, subject, count, textContent) => api.call('/api/flashcards', 'POST', { topic, subject, count, textContent }),
  generateMindmap: (topic, textContent) => api.call('/api/mindmap', 'POST', { topic, textContent }),
  generatePlan: (data) => api.call('/api/planner', 'POST', data),
  generateViva: (subject, topic, count, textContent, excludeQuestions = []) => api.call('/api/viva', 'POST', { subject, topic, count, textContent, excludeQuestions }),
  codeReview: (code, language) => api.call('/api/code/review', 'POST', { code, language }),
  codeExplain: (code, language) => api.call('/api/code/explain', 'POST', { code, language }),
  codeOptimize: (code, language) => api.call('/api/code/optimize', 'POST', { code, language }),
  codeFix: (code, language, error) => api.call('/api/code/fix', 'POST', { code, language, error }),
  codeRun: async (code, language) => {
    const resp = await fetch(`${API_BASE}/api/code/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language })
    });
    return resp.json();
  },
  summarizeVideo: (url, topic) => api.call('/api/video', 'POST', { url, topic }),
  translate: (text, targetLanguage) => api.call('/api/translate', 'POST', { text, targetLanguage }),
  generateResume: (data) => api.call('/api/resume', 'POST', data),
  mockInterview: (data) => api.call('/api/interview', 'POST', data),
  saveApiKey: (apiKey) => api.call('/api/save-key', 'POST', { apiKey }),
  signup: (data) => api.call('/api/auth/signup', 'POST', data),
  login: (email, password) => api.call('/api/auth/login', 'POST', { email, password }),
  me: () => api.call('/api/auth/me'),
  logout: () => api.call('/api/auth/logout', 'POST'),
};

// ===================== LOADING =====================
const LOADING_MSGS = [
  'Initializing AI Systems...',
  'Connecting to Backend...',
  'Loading 3D Scene...',
  'Preparing Study Modules...',
  'Checking Groq API...',
  'EduVerse AI Ready! 🚀',
];

async function initLoading() {
  const bar = document.getElementById('loadingProgress');
  const text = document.getElementById('loadingText');
  const screen = document.getElementById('loadingScreen');

  let progress = 0;
  let msgIdx = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 20 + 5;
    if (progress > 100) progress = 100;
    if (bar) bar.style.width = progress + '%';
    if (text && msgIdx < LOADING_MSGS.length && progress > msgIdx * 17)
      text.textContent = LOADING_MSGS[msgIdx++];
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(async () => {
        screen?.classList.add('hidden');
        await initApp();
      }, 500);
    }
  }, 150);
}

// ===================== APP INIT =====================
async function initApp() {
  // Apply saved theme
  document.documentElement.setAttribute('data-theme', state.theme);

  // Check backend
  await api.checkHealth();
  if (!SERVER_ONLINE) {
    showToast('⚠️ Backend offline. Run: npm start', 'warning');
  }

  initThree();
  initParticles();
  initCursorGlow();
  initNavScroll();
  initTypingEffect();
  initCounterAnimation();

  await restoreAuthentication();
}

// ===================== THREE.JS =====================
let threeScene, threeCamera, threeRenderer, threeObjects = [];

function initThree() {
  if (typeof THREE === 'undefined') return;
  const canvas = document.getElementById('three-canvas');
  threeScene = new THREE.Scene();
  threeCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  threeCamera.position.z = 5;
  threeRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  threeRenderer.setSize(window.innerWidth, window.innerHeight);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  threeScene.add(new THREE.AmbientLight(0x2563eb, 0.5));
  const l1 = new THREE.PointLight(0x7c3aed, 1.5, 50);
  l1.position.set(5, 5, 3);
  threeScene.add(l1);
  const l2 = new THREE.PointLight(0x06b6d4, 1, 50);
  l2.position.set(-5, -3, 2);
  threeScene.add(l2);

  const geos = [
    [new THREE.OctahedronGeometry(0.4), 0x2563eb, [-4, 2, -2]],
    [new THREE.TetrahedronGeometry(0.35), 0x7c3aed, [4, 3, -3]],
    [new THREE.IcosahedronGeometry(0.3), 0x06b6d4, [3, -2, -1.5]],
    [new THREE.TorusGeometry(0.25, 0.08, 8, 20), 0x10b981, [-3, -2, -2]],
    [new THREE.DodecahedronGeometry(0.3), 0xf59e0b, [0, 3.5, -3]],
    [new THREE.TorusKnotGeometry(0.2, 0.06, 40, 8), 0xef4444, [-4, 0, -3]],
    [new THREE.BoxGeometry(0.4, 0.4, 0.4), 0x06b6d4, [2.5, 1.5, -2.5]],
    [new THREE.SphereGeometry(0.25, 12, 12), 0x10b981, [-1, -3, -2]],
  ];

  geos.forEach(([geo, color, pos]) => {
    const mat = new THREE.MeshPhongMaterial({ color, wireframe: Math.random() > 0.5, transparent: true, opacity: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.userData = { rx: (Math.random() - 0.5) * 0.02, ry: (Math.random() - 0.5) * 0.02, rz: (Math.random() - 0.5) * 0.01, fo: Math.random() * Math.PI * 2, fs: 0.3 + Math.random() * 0.4 };
    threeScene.add(mesh);
    threeObjects.push(mesh);
  });

  // Neural network
  const pts = Array.from({ length: 40 }, () => new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 3 - 4));
  for (let i = 0; i < 60; i++) {
    const a = Math.floor(Math.random() * pts.length), b = Math.floor(Math.random() * pts.length);
    if (a !== b && pts[a].distanceTo(pts[b]) < 3) {
      threeScene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pts[a], pts[b]]), new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.15 })));
    }
  }
  pts.forEach(p => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshBasicMaterial({ color: 0x06b6d4 })); m.position.copy(p); threeScene.add(m); });

  let mouseX = 0, mouseY = 0, t = 0;
  document.addEventListener('mousemove', e => { mouseX = (e.clientX / window.innerWidth - 0.5) * 0.3; mouseY = -(e.clientY / window.innerHeight - 0.5) * 0.3; });

  (function animate() {
    requestAnimationFrame(animate);
    t += 0.01;
    threeObjects.forEach(o => {
      o.rotation.x += o.userData.rx; o.rotation.y += o.userData.ry; o.rotation.z += o.userData.rz;
      o.position.y += Math.sin(t * o.userData.fs + o.userData.fo) * 0.003;
    });
    threeCamera.position.x += (mouseX - threeCamera.position.x) * 0.05;
    threeCamera.position.y += (mouseY - threeCamera.position.y) * 0.05;
    threeCamera.lookAt(threeScene.position);
    threeRenderer.render(threeScene, threeCamera);
  })();

  window.addEventListener('resize', () => {
    threeCamera.aspect = window.innerWidth / window.innerHeight;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ===================== PARTICLES =====================
function initParticles() {
  const c = document.getElementById('particles');
  const colors = ['#2563EB', '#7C3AED', '#06B6D4', '#10B981', '#F59E0B'];
  for (let i = 0; i < (window.innerWidth < 768 ? 20 : 40); i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const s = Math.random() * 4 + 1;
    p.style.cssText = `width:${s}px;height:${s}px;background:${colors[i % 5]};left:${Math.random() * 100}%;animation-duration:${Math.random() * 20 + 10}s;animation-delay:-${Math.random() * 20}s;--drift:${(Math.random() - 0.5) * 200}px`;
    c.appendChild(p);
  }
}

// ===================== CURSOR GLOW =====================
function initCursorGlow() {
  const glow = document.getElementById('cursorGlow');
  document.addEventListener('mousemove', e => { if (glow) { glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; } });
}

// ===================== NAV SCROLL =====================
function initNavScroll() {
  window.addEventListener('scroll', () => document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 50));
}

// ===================== TYPING EFFECT =====================
const PHRASES = ['AI-powered study assistant...', 'Generate smart notes instantly...', 'Practice with real AI quiz...', 'Code, debug, and learn...', 'Prepare for placements...', 'Study in 11 Indian languages...', 'Track your learning progress...'];
function initTypingEffect() {
  const el = document.getElementById('typingText');
  if (!el) return;
  let pi = 0, ci = 0, del = false;
  function type() {
    const ph = PHRASES[pi];
    el.textContent = del ? ph.substring(0, ci - 1) : ph.substring(0, ci + 1);
    del ? ci-- : ci++;
    if (!del && ci === ph.length) { del = true; setTimeout(type, 2000); return; }
    if (del && ci === 0) { del = false; pi = (pi + 1) % PHRASES.length; }
    setTimeout(type, del ? 40 : 80);
  }
  type();
}

// ===================== COUNTER ANIMATION =====================
function initCounterAnimation() {
  const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { animateCounter(e.target); obs.unobserve(e.target); } }), { threshold: 0.5 });
  document.querySelectorAll('.stat-number').forEach(c => obs.observe(c));
}
function animateCounter(el) {
  const target = parseInt(el.dataset.target), duration = 2000;
  let current = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    current += step;
    if (current >= target) { current = target; clearInterval(timer); }
    el.textContent = Math.floor(current).toLocaleString();
  }, 16);
}

// ===================== NAVIGATION =====================
function navigateTo(id) {
  // Login is optional — guests can access all sections freely
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  state.currentSection = id;
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.getAttribute('onclick')?.includes(id)));
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.toggle('active', b.getAttribute('onclick')?.includes(id)));
  if (id === 'dashboard') { setTimeout(initActivityChart, 100); updateDashboardData(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeMenu();
}

// ===================== THEME =====================
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  localStorage.setItem('theme', state.theme);
  showToast(`${state.theme === 'dark' ? '🌙' : '☀️'} Switched to ${state.theme} mode`, 'info');
}

// ===================== MOBILE MENU =====================
function toggleMenu() {
  const links = document.getElementById('navLinks');
  const isOpen = links.classList.toggle('mobile-open');
  links.style.cssText = isOpen ? 'display:flex;flex-direction:column;position:fixed;top:70px;left:0;right:0;background:rgba(3,7,18,0.98);padding:20px;border-bottom:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(20px);z-index:999' : '';
}
function closeMenu() {
  const links = document.getElementById('navLinks');
  if (links) { links.classList.remove('mobile-open'); links.style.cssText = ''; }
}

// ===================== MODALS =====================
function showModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
function closeModalOutside(e, id) { if (e.target === document.getElementById(id)) closeModal(id); }
function switchModal(from, to) { closeModal(from); setTimeout(() => showModal(to), 200); }

// ===================== AUTH =====================
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail')?.value;
  if (!email) return;
  state.user = { email, name: email.split('@')[0], xp: state.studyData.xp };
  localStorage.setItem('user', JSON.stringify(state.user));
  closeModal('loginModal');
  updateUserNav();
  showToast('Welcome back! 🎉', 'success');
  navigateTo('dashboard');
}

function handleSignup(e) {
  e.preventDefault();
  state.user = { email: 'student@edu.in', name: 'Student', xp: 0 };
  localStorage.setItem('user', JSON.stringify(state.user));
  closeModal('signupModal');
  updateUserNav();
  showToast('Account created! Welcome to EduVerse AI 🎓', 'success');
  navigateTo('ai-tutor');
}




function updateUserNav() {
  const btn = document.querySelector('.nav-actions .btn-secondary');
  if (btn && state.user) { btn.textContent = state.user.name?.split(' ')[0] || 'Profile'; btn.onclick = () => showModal('profileModal'); }
}

function logout() {
  state.user = null; localStorage.removeItem('user');
  closeModal('profileModal');
  showToast('Signed out. See you soon! 👋', 'info');
  navigateTo('hero');
}

// Server-backed authentication overrides the original demo handlers above.
async function handleLogin(e) {
  e.preventDefault();
  try {
    const result = await api.login(document.getElementById('loginEmail')?.value || '', document.getElementById('loginPassword')?.value || '');
    completeAuthentication(result);
    closeModal('loginModal'); showToast('Welcome back!', 'success'); navigateTo('dashboard');
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleSignup(e) {
  e.preventDefault();
  try {
    const result = await api.signup({
      firstName: document.getElementById('signupFirstName')?.value || '', lastName: document.getElementById('signupLastName')?.value || '',
      email: document.getElementById('signupEmail')?.value || '', password: document.getElementById('signupPassword')?.value || '',
      college: document.getElementById('signupCollege')?.value || '', branch: document.getElementById('signupBranch')?.value || ''
    });
    completeAuthentication(result);
    closeModal('signupModal'); showToast('Account created. Welcome to EduVerse AI!', 'success'); navigateTo('dashboard');
  } catch (err) { showToast(err.message, 'error'); }
}

function socialLogin(provider) {
  if (provider !== 'google') { showToast('This sign-in provider is not available yet.', 'info'); return; }
  window.location.assign(`${API_BASE}/api/auth/google`);
}

function completeAuthentication(result) {
  state.user = result.user;
  localStorage.setItem('user', JSON.stringify(state.user));
  if (result.token) localStorage.setItem('authToken', result.token);
  updateUserNav();
  hideAuthGate();
}

function showAuthGate() { document.getElementById('authGate')?.classList.add('visible'); }
function hideAuthGate() { document.getElementById('authGate')?.classList.remove('visible'); }

async function restoreAuthentication() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('authToken');
  const error = params.get('authError');
  if (token) { localStorage.setItem('authToken', token); window.history.replaceState({}, '', window.location.pathname); }
  if (error) { window.history.replaceState({}, '', window.location.pathname); showToast('Google sign-in could not be completed.', 'error'); }
  // If no token saved — just run as guest, no blocking gate
  if (!localStorage.getItem('authToken')) {
    state.user = null;
    localStorage.removeItem('user');
    // Show auth gate only if not already dismissed as guest
    if (!sessionStorage.getItem('guestMode')) {
      showAuthGate();
    }
    return;
  }
  try { completeAuthentication({ user: (await api.me()).user }); }
  catch { state.user = null; localStorage.removeItem('user'); localStorage.removeItem('authToken'); }
}

// Guest mode — skip login entirely
function continueAsGuest() {
  sessionStorage.setItem('guestMode', 'true');
  hideAuthGate();
  showToast('Welcome, Guest! All features are available — sign in anytime to save your progress.', 'info');
  navigateTo('hero');
}

async function logout() {
  try { await api.logout(); } catch {}
  state.user = null; localStorage.removeItem('user'); localStorage.removeItem('authToken');
  sessionStorage.removeItem('guestMode');
  closeModal('profileModal');
  const btn = document.querySelector('.nav-actions .btn-secondary');
  if (btn) { btn.textContent = 'Log In'; btn.onclick = () => showModal('loginModal'); }
  showToast('Signed out. See you soon!', 'info');
  navigateTo('hero');
}

function togglePassword(id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

// ===================== AI CHAT (REAL API) =====================
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input?.value?.trim();
  if (!message) return;

  appendChatMsg(message, 'user');
  state.chatHistory.push({ role: 'user', content: message });
  input.value = '';
  autoResize(input);
  showTypingIndicator();

  try {
    let response;
    if (SERVER_ONLINE) {
      const data = await api.chat(
        message,
        state.currentSubject,
        state.chatHistory.slice(-8),
        state.currentPDFText,
        state.currentPDFName
      );
      response = data.response;
    } else {
      response = getFallbackResponse(message);
    }
    hideTypingIndicator();
    appendChatMsg(response, 'ai');
    state.chatHistory.push({ role: 'ai', content: response });

    // TTS if enabled
    if (state.ttsEnabled) speakText(response.replace(/[#*`|]/g, '').substring(0, 300));
    updateXP(5);
  } catch (err) {
    hideTypingIndicator();
    const errMsg = `I encountered an error: ${err.message}. ${!SERVER_ONLINE ? 'Backend not connected. Run: npm start' : 'Please check your connection.'}`;
    appendChatMsg(errMsg, 'ai');
    showToast(err.message, 'error');
  }
}

function getFallbackResponse(message) {
  const lower = message.toLowerCase();
  const responses = {
    'machine learning': `**Machine Learning** is a subset of AI.\n\n**Types:**\n- Supervised Learning\n- Unsupervised Learning\n- Reinforcement Learning\n\n> ⚠️ Connect backend with Groq API for detailed responses.`,
    'data structure': `**Data Structures** organize data efficiently.\n\n- **Array** — O(1) access\n- **Stack** — LIFO\n- **Queue** — FIFO\n- **Tree** — Hierarchical\n\n> ⚠️ Add Groq API key for full AI responses.`,
  };
  for (const [key, val] of Object.entries(responses)) {
    if (lower.includes(key)) return val;
  }
  return `I received your question about **"${message}"**.\n\n⚠️ **Backend not connected or API key missing.**\n\nTo get real AI responses:\n1. Run: \`npm start\` in your project folder\n2. Add your Groq API key in ⚙️ Settings\n3. Get free API key at: **console.groq.com**`;
}

function appendChatMsg(content, role) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="msg-avatar">${role === 'ai' ? '🤖' : '👤'}</div>
    <div class="msg-bubble">${role === 'ai' ? formatMarkdown(content) : `<p>${escapeHtml(content)}</p>`}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="code-block"><div class="code-lang">${lang || 'code'}</div><code>${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$2</h2>'.replace('$2', '$1'))
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\| (.+) \|$/gm, (match) => {
      if (match.includes('---')) return '';
      const cells = match.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .replace(/(<tr>[\s\S]*?<\/tr>)+/g, m => `<table class="md-table">${m}</table>`)
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ol-item"><span>$1.</span> $2</li>')
    .replace(/^[-•] (.+)$/gm, '<li class="ul-item">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>')
    .replace(/^(.)/m, '<p>$1')
    .replace(/(.)$/m, '$1</p>');
}

function showTypingIndicator() {
  const c = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.id = 'typingIndicator';
  div.className = 'chat-msg ai';
  div.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
  c?.appendChild(div);
  c && (c.scrollTop = c.scrollHeight);
}
function hideTypingIndicator() { document.getElementById('typingIndicator')?.remove(); }

function handleChatKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

function sendQuickPrompt(p) {
  const input = document.getElementById('chatInput');
  if (input) { input.value = p; sendMessage(); }
}

function selectSubject(s) {
  state.currentSubject = s;
  document.querySelectorAll('.subj-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  const el = document.getElementById('currentSubject');
  if (el) el.textContent = `${getSubjectEmoji(s)} ${s}`;
  showToast(`Switched to ${s}`, 'info');
}

function getSubjectEmoji(s) {
  const map = { 'Computer Science': '💻', 'Mathematics': '📐', 'Physics': '⚡', 'Chemistry': '🧪', 'AI & ML': '🧠', 'Cyber Security': '🔒', 'Data Science': '📊', 'Electronics': '🔌', 'Mechanical': '⚙️', 'Civil': '🏗️' };
  return map[s] || '📚';
}

function clearChat() {
  const c = document.getElementById('chatMessages');
  if (c) c.innerHTML = `<div class="chat-msg ai"><div class="msg-avatar">🤖</div><div class="msg-bubble"><p>Chat cleared! I'm ready for your next question. What would you like to learn? 🚀</p></div></div>`;
  state.chatHistory = [];
  showToast('Chat cleared', 'info');
}

function exportChat() {
  if (!state.chatHistory.length) {
    showToast('There are no chat messages to download yet.', 'warning');
    return;
  }

  const exportedAt = new Date();
  const content = [
    'PRINCE AI Tutor - Chat Export',
    `Subject: ${state.currentSubject}`,
    `Downloaded: ${exportedAt.toLocaleString()}`,
    '',
    ...state.chatHistory.map(message => {
      const speaker = message.role === 'user' ? 'You' : 'PRINCE';
      return `${speaker}:\n${message.content.trim()}`;
    }),
    '',
  ].join('\n\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = exportedAt.toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `PRINCE_Chat_${stamp}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast('Chat downloaded successfully.', 'success');
}

// ===================== VOICE =====================
function toggleVoice() {
  const btn = document.getElementById('voiceBtn');
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Voice recognition not supported in this browser', 'warning'); return;
  }
  if (state.isVoiceRecording) return;
  state.isVoiceRecording = true;
  btn?.classList.add('recording');
  showToast('🎤 Listening... Speak now!', 'info');

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new SR();
  r.lang = 'en-IN'; r.interimResults = false;
  r.start();
  r.onresult = e => {
    const text = e.results[0][0].transcript;
    const input = document.getElementById('chatInput');
    if (input) { input.value = text; sendMessage(); }
    state.isVoiceRecording = false;
    btn?.classList.remove('recording');
  };
  r.onerror = r.onend = () => { state.isVoiceRecording = false; btn?.classList.remove('recording'); };
}

function speakText(text, force = false, immediate = false) {
  const synthesis = window.speechSynthesis;
  if (!text) return;
  if (!synthesis || !window.SpeechSynthesisUtterance) {
    showToast('Text-to-speech is not supported in this browser.', 'warning');
    return;
  }
  if (!state.ttsEnabled && !force) return;

  // Remove consecutive duplicate words and short phrases before they ever
  // reach the browser speech engine (for example: "Seeko Seeko Seeko").
  // Markdown heading dividers such as "======" are visual only.  Do not
  // send them to speech, otherwise the voice says "equal" many times.
  const speakableText = text
    .replace(/^[=\-_*]{3,}\s*$/gm, ' ')
    .replace(/={3,}/g, ' ')
    .replace(/-{3,}/g, ' ');
  const words = speakableText.replace(/\s+/g, ' ').trim().split(' ');
  const uniqueWords = [];
  for (const word of words) {
    if (word.toLowerCase() !== uniqueWords.at(-1)?.toLowerCase()) uniqueWords.push(word);
  }
  let cleanText = uniqueWords.join(' ');
  for (let phraseLength = 4; phraseLength >= 1; phraseLength--) {
    const pattern = new RegExp(`\\b((?:\\S+\\s+){${phraseLength - 1}}\\S+)(?:\\s+\\1)+`, 'gi');
    cleanText = cleanText.replace(pattern, '$1');
  }
  cleanText = cleanText.substring(0, 300);
  if (!cleanText) return;

  // Do not queue the same phrase again if the browser retries it immediately.
  const now = Date.now();
  if (cleanText === state.lastSpokenText && now - state.lastSpokenAt < 2000) return;

  const requestId = ++state.speechRequestId;
  window.clearTimeout(state.speechSafetyTimer);
  state.lastSpokenText = cleanText;
  state.lastSpokenAt = now;
  synthesis.cancel();

  // Chrome and Edge need a moment to clear a cancelled utterance; without it,
  // an old phrase can be re-queued and repeat several times.
  const startSpeech = () => {
    if ((!state.ttsEnabled && !force) || requestId !== state.speechRequestId) return;
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.rate = 0.9; utter.pitch = 1.1; utter.volume = 0.8;
    const voices = synthesis.getVoices();
    const preferred = voices.find(v => v.lang.includes('en') && (v.name.includes('Female') || v.name.includes('Google')));
    if (preferred) utter.voice = preferred;
    utter.onend = () => {
      if (requestId === state.speechRequestId) {
        window.clearTimeout(state.speechSafetyTimer);
        state.speechRequestId = 0;
      }
    };
    utter.onerror = event => {
      if (requestId === state.speechRequestId) {
        window.clearTimeout(state.speechSafetyTimer);
        state.speechRequestId = 0;
      }
      if (event.error !== 'interrupted' && event.error !== 'canceled') showToast('Speaker could not play. Check browser sound settings.', 'error');
    };
    synthesis.resume();
    synthesis.speak(utter);
    // Hard-stop a browser voice that ignores its normal end event and loops.
    const maximumSpeechTime = Math.max(5000, Math.min(30000, cleanText.length * 140 + 2500));
    state.speechSafetyTimer = window.setTimeout(() => {
      if (requestId === state.speechRequestId) {
        synthesis.cancel();
        state.speechRequestId = 0;
      }
    }, maximumSpeechTime);
  };
  if (immediate) startSpeech(); else window.setTimeout(startSpeech, 250);
}

function toggleTextToSpeech() {
  state.ttsEnabled = !state.ttsEnabled;
  const button = document.getElementById('ttsToggleBtn');
  if (!state.ttsEnabled) {
    ++state.speechRequestId;
    window.clearTimeout(state.speechSafetyTimer);
    window.speechSynthesis?.cancel();
    if (button) {
      button.title = 'Turn speaker on';
      button.setAttribute('aria-label', 'Turn speaker on');
      button.setAttribute('aria-pressed', 'false');
      button.classList.add('is-muted');
    }
    showToast('Speaker is off. PRINCE will not read replies aloud.', 'info');
    return;
  }

  if (button) {
    button.title = 'Turn speaker off';
    button.setAttribute('aria-label', 'Turn speaker off');
    button.setAttribute('aria-pressed', 'true');
    button.classList.remove('is-muted');
  }
  showToast('Speaker is on. PRINCE will read new replies aloud.', 'success');
}

// ===================== FEATURE MODALS =====================
async function openFeature(feature) {
  const modal = document.getElementById('featureModal');
  const content = document.getElementById('featureModalContent');
  if (!modal || !content) { console.error('Feature modal elements not found'); return; }

  const renders = {
    'coding': renderCodingLab,
    'quiz': renderQuizFeature,
    'ai-pdf': renderPDFAssistant,
    'mindmap': renderMindMap,
    'placement': renderPlacement,
    'viva': renderViva,
    'planner': renderPlanner,
    'notes': renderNotesGenerator,
    'flashcards': renderFlashcards,
    'video': renderVideoLearning,
  };

  if (renders[feature]) {
    content.innerHTML = renders[feature]();
    modal.classList.add('open');
    content.scrollTop = 0; // Always scroll to top on open

    if (feature === 'ai-pdf') setupPDFAssistantUpload();

    // Auto-trigger AI for immediate-response features
    if (feature === 'mindmap') setTimeout(() => drawMindMap(null), 100);
    // Note: quiz, flashcards, viva wait for user to click generate
  }
}


// ===================== NOTES GENERATOR (REAL) =====================
function renderNotesGenerator() {
  return `
    <button class="modal-close" onclick="closeModal('featureModal')">✕</button>
    <div class="feature-modal-header">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700">📝 Smart Notes Generator</h2>
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">AI-powered notes from any topic</p>
    </div>
    <div class="feature-modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="form-group">
          <label>Topic</label>
          <input id="notesTopic" type="text" placeholder="e.g., Binary Trees" />
        </div>
        <div class="form-group">
          <label>Subject</label>
          <input id="notesSubject" type="text" placeholder="e.g., Data Structures" value="${state.currentSubject}" />
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        ${[['revision','📝 Revision Notes'],['short','⚡ Short Notes'],['long','📖 Long Notes'],['formula','🔢 Formula Sheet'],['summary','📊 Summary'],['cheatsheet','🎯 Cheat Sheet']].map(([val, label]) =>
          `<button class="note-type-btn" data-type="${val}" onclick="selectNoteType(this,'${val}')" style="padding:8px 14px;background:var(--bg-glass);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:600;color:var(--text-secondary);transition:all 0.3s;font-family:'Inter',sans-serif">${label}</button>`
        ).join('')}
      </div>
      <input type="hidden" id="selectedNoteType" value="revision">
      <button onclick="generateRealNotes()" class="btn-generate" style="width:100%;padding:13px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:0.95rem;font-family:'Inter',sans-serif;margin-bottom:16px">
        🚀 Generate AI Notes
      </button>
      <div id="notesOutput" style="display:none;max-height:400px;overflow-y:auto;padding:20px;background:var(--bg-glass);border:1px solid var(--border);border-radius:12px;line-height:1.7;font-size:0.9rem"></div>
      <div style="display:flex;gap:8px;margin-top:10px" id="notesActions" style="display:none">
        <button onclick="copyNotes()" style="padding:8px 16px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;color:var(--success);cursor:pointer;font-size:0.8rem;font-weight:600;font-family:'Inter',sans-serif">📋 Copy</button>
        <button onclick="downloadNotes()" style="padding:8px 16px;background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.3);border-radius:8px;color:var(--primary-light);cursor:pointer;font-size:0.8rem;font-weight:600;font-family:'Inter',sans-serif">📥 Download</button>
        <button onclick="speakNotes()" style="padding:8px 16px;background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.3);border-radius:8px;color:#a78bfa;cursor:pointer;font-size:0.8rem;font-weight:600;font-family:'Inter',sans-serif">🔊 Read Aloud</button>
      </div>
    </div>
  `;
}

function selectNoteType(btn, type) {
  document.querySelectorAll('.note-type-btn').forEach(b => { b.style.background = 'var(--bg-glass)'; b.style.borderColor = 'var(--border)'; b.style.color = 'var(--text-secondary)'; });
  btn.style.background = 'rgba(37,99,235,0.15)';
  btn.style.borderColor = 'rgba(37,99,235,0.4)';
  btn.style.color = 'var(--primary-light)';
  document.getElementById('selectedNoteType').value = type;
}

async function generateRealNotes() {
  const topic = document.getElementById('notesTopic')?.value?.trim() || state.currentSubject;
  const subject = document.getElementById('notesSubject')?.value?.trim() || state.currentSubject;
  const type = document.getElementById('selectedNoteType')?.value || 'revision';
  const output = document.getElementById('notesOutput');
  const actions = document.getElementById('notesActions');

  if (!output) return;
  output.style.display = 'block';
  output.innerHTML = `<div style="text-align:center;padding:20px"><div class="loading-spinner"></div><p style="color:var(--text-muted);margin-top:12px">Generating ${type} notes for "${topic}"...</p></div>`;

  try {
    if (!SERVER_ONLINE) throw new Error('Backend not connected');
    const data = await api.generateNotes(topic, subject, type, state.currentPDFText);
    output.innerHTML = formatMarkdown(data.notes);
    if (actions) actions.style.display = 'flex';
    output.dataset.rawNotes = data.notes;
    updateXP(20);
    showToast('📝 Notes generated!', 'success');
  } catch (err) {
    output.innerHTML = `<div style="color:var(--danger)">❌ ${err.message}</div><div style="margin-top:12px;color:var(--text-secondary)">Make sure:<br/>1. Backend is running: <code>npm start</code><br/>2. Groq API key is set in ⚙️ Settings</div>`;
    showToast(err.message, 'error');
  }
}

function copyNotes() {
  const raw = document.getElementById('notesOutput')?.dataset?.rawNotes || '';
  navigator.clipboard.writeText(raw).then(() => showToast('📋 Copied to clipboard!', 'success'));
}

function downloadNotes() {
  const raw = document.getElementById('notesOutput')?.dataset?.rawNotes || '';
  const blob = new Blob([raw], { type: 'text/markdown' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `EduVerse_Notes_${Date.now()}.md`; a.click();
  showToast('📥 Downloaded!', 'success');
}

function speakNotes() {
  const raw = document.getElementById('notesOutput')?.dataset?.rawNotes || '';
  speakText(raw.replace(/[#*`|]/g, ''));
  showToast('🔊 Reading aloud...', 'info');
}

// ===================== PDF ASSISTANT (REAL) =====================
function renderPDFAssistant() {
  const markup = `
    <button class="modal-close" onclick="closeModal('featureModal')">✕</button>
    <div class="feature-modal-header">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700">📚 AI PDF Assistant</h2>
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">Upload any document for instant AI analysis</p>
    </div>
    <div class="feature-modal-body">
      <div id="pdfUploadZone" class="upload-zone" onclick="triggerFileInput()">
        <input type="file" id="pdfFileInput" accept=".pdf,.txt,.docx,.pptx,.jpg,.jpeg,.png,.webp" style="display:none" onchange="handleFileUpload(this)">
        <div class="upload-icon">📄</div>
        <h3>Drop file here or click to upload</h3>
        <p>PDF, DOCX, PPTX, TXT, Images (Max 25MB)</p>
        <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:12px">
          ${['PDF','PPTX','DOCX','TXT','JPG','PNG'].map(f => `<span class="file-badge">.${f}</span>`).join('')}
        </div>
      </div>
      <div id="pdfProgress" style="display:none;margin-top:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span id="pdfFileName" style="font-size:0.85rem;font-weight:600"></span>
          <span id="pdfPercent" style="font-size:0.78rem;color:var(--primary-light)">0%</span>
        </div>
        <div style="height:4px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
          <div id="pdfProgressBar" style="height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));width:0%;transition:width 0.3s;border-radius:4px"></div>
        </div>
        <div id="pdfStatusMsg" style="font-size:0.78rem;color:var(--text-muted);margin-top:6px">Processing...</div>
      </div>
      <div id="pdfSummaryBox" style="display:none;margin-top:16px;padding:16px;background:rgba(37,99,235,0.05);border:1px solid rgba(37,99,235,0.2);border-radius:12px">
        <div style="font-weight:700;color:var(--primary-light);margin-bottom:8px">📋 AI Summary</div>
        <div id="pdfSummaryText" style="font-size:0.88rem;color:var(--text-secondary);line-height:1.6"></div>
      </div>
      <div id="pdfActions" style="display:none;margin-top:16px">
        <div style="font-weight:700;margin-bottom:12px;font-size:0.9rem">AI Actions on Your Document:</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          ${[
            {icon:'📝',label:'Smart Notes',action:'pdfGenerateNotes()'},
            {icon:'🃏',label:'Flashcards',action:"pdfAction('flashcards')"},
            {icon:'🎯',label:'Quiz',action:"pdfAction('quiz')"},
            {icon:'🗺️',label:'Mind Map',action:"pdfAction('mindmap')"},
            {icon:'❓',label:'Viva Q&A',action:"pdfAction('viva')"},
            {icon:'📊',label:'PYQ Analysis',action:"pdfPYQ()"},
          ].map(i => `<button onclick="${i.action}" class="pdf-action-btn">${i.icon}<br/><span>${i.label}</span></button>`).join('')}
        </div>
        <div id="pdfActionOutput" style="display:none;margin-top:16px;max-height:350px;overflow-y:auto;padding:16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:12px;font-size:0.88rem;line-height:1.7"></div>
      </div>
    </div>
  `;

  return markup;
}

function setupPDFAssistantUpload() {
  const zone = document.getElementById('pdfUploadZone');
  if (zone) {
    ['dragenter', 'dragover'].forEach(eventName => zone.addEventListener(eventName, event => {
      event.preventDefault();
      zone.classList.add('drag-active');
    }));
    ['dragleave', 'drop'].forEach(eventName => zone.addEventListener(eventName, event => {
      event.preventDefault();
      zone.classList.remove('drag-active');
    }));
    zone.addEventListener('drop', event => {
      const file = event.dataTransfer?.files?.[0];
      if (file) handleSelectedFile(file);
    });
  }
}

function triggerFileInput() {
  document.getElementById('pdfFileInput')?.click();
}

async function handleFileUpload(input) {
  const file = input.files[0];
  if (file) await handleSelectedFile(file);
  // Allow selecting the same file again after an upload error.
  input.value = '';
}

async function handleSelectedFile(file) {
  if (!file) return;
  if (!SERVER_ONLINE) { showToast('Backend not running. Run: npm start', 'error'); return; }

  const zone = document.getElementById('pdfUploadZone');
  const progress = document.getElementById('pdfProgress');
  const fileNameEl = document.getElementById('pdfFileName');
  const percentEl = document.getElementById('pdfPercent');
  const barEl = document.getElementById('pdfProgressBar');
  const statusEl = document.getElementById('pdfStatusMsg');
  const acceptedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
  const acceptedByExtension = /\.(pdf|txt|docx|pptx|jpe?g|png|webp)$/i.test(file.name);

  if (!acceptedTypes.includes(file.type) && !file.type.startsWith('image/') && !acceptedByExtension) {
    showToast('Use a PDF, TXT, DOCX, PPTX, JPG, PNG, or WEBP file.', 'error');
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    showToast('This file is larger than the 25 MB limit.', 'error');
    return;
  }

  if (zone) zone.style.display = 'none';
  if (progress) progress.style.display = 'block';
  if (fileNameEl) fileNameEl.textContent = file.name;

  // Simulate progress while uploading
  let pct = 0;
  const steps = ['Uploading file...', 'Extracting text...', 'AI analyzing...', 'Building index...', 'Complete!'];
  const prog = setInterval(() => {
    pct = Math.min(pct + 15, 90);
    if (barEl) barEl.style.width = pct + '%';
    if (percentEl) percentEl.textContent = pct + '%';
    if (statusEl) statusEl.textContent = steps[Math.floor(pct / 20)] || 'Processing...';
  }, 400);

  try {
    const formData = new FormData();
    formData.append('file', file);
    if (state.apiKey) formData.append('apiKey', state.apiKey);

    const data = await api.upload('/api/upload', formData);
    clearInterval(prog);
    if (barEl) barEl.style.width = '100%';
    if (percentEl) percentEl.textContent = '100%';
    if (statusEl) statusEl.textContent = '✅ Ready!';

    state.currentPDFText = data.textContent || '';
    state.currentPDFName = file.name;

    if (data.summary) {
      const sb = document.getElementById('pdfSummaryBox');
      const st = document.getElementById('pdfSummaryText');
      if (sb) sb.style.display = 'block';
      if (st) st.textContent = data.summary;
    }

    const actions = document.getElementById('pdfActions');
    if (actions) actions.style.display = 'block';
    showToast(`✅ "${file.name}" processed! Ask questions in AI Tutor — answers will use this document.`, 'success');
    updateXP(10);
  } catch (err) {
    clearInterval(prog);
    if (zone) zone.style.display = 'block';
    if (progress) progress.style.display = 'none';
    if (statusEl) statusEl.textContent = `Upload failed: ${err.message}`;
    showToast('Upload failed: ' + err.message, 'error');
  }
}

async function pdfGenerateNotes() {
  const output = document.getElementById('pdfActionOutput');
  if (!output) return;
  output.style.display = 'block';
  output.innerHTML = '<div style="text-align:center;padding:20px">⏳ Generating notes from your document...</div>';
  try {
    const data = await api.generateNotes(state.currentPDFName, state.currentSubject, 'revision', state.currentPDFText);
    output.innerHTML = formatMarkdown(data.notes);
    showToast('📝 Notes generated from PDF!', 'success');
  } catch (err) {
    output.innerHTML = `<span style="color:var(--danger)">Error: ${err.message}</span>`;
    showToast(err.message, 'error');
  }
}

async function pdfAction(type) {
  const output = document.getElementById('pdfActionOutput');
  if (!output || !state.currentPDFText) { showToast('Please upload a file first', 'warning'); return; }
  output.style.display = 'block';
  output.innerHTML = `<div style="text-align:center;padding:20px">⏳ Generating ${type} from your document...</div>`;
  try {
    let data;
    if (type === 'flashcards') {
      data = await api.generateFlashcards(state.currentPDFName, state.currentSubject, 15, state.currentPDFText);
      state.flashcards = data.flashcards;
      state.currentFlashcard = 0;
      output.innerHTML = `
        <div style="font-weight:700;margin-bottom:12px">🃏 Interactive Flashcards (${data.flashcards.length} cards):</div>
        <div id="pdfFlashcardContainer"></div>
      `;
      renderPDFFlashcard();
    } else if (type === 'quiz') {
      data = await api.generateQuiz(state.currentPDFName, state.currentSubject, 'medium', 10, state.currentPDFText);
      state.quizData = data.questions;
      state.quizCurrentQ = 0;
      state.quizScore = 0;
      output.innerHTML = `
        <div style="font-weight:700;margin-bottom:12px">🎯 Interactive (${data.questions.length} questions):</div>
        <div id="pdfQuizContainer"></div>
      `;
      renderPDFQuizQuestion();
    } else if (type === 'mindmap') {
      data = await api.generateMindmap(state.currentPDFName, state.currentPDFText);
      output.innerHTML = `
        <div style="font-weight:700;margin-bottom:12px">🗺️ Interactive Mind Map:</div>
        <canvas id="pdfMindmapCanvas" style="width:100%;height:350px;border-radius:8px;background:#080e1a;cursor:move"></canvas>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:12px">
          <button onclick="regeneratePDFMindmap()" style="padding:10px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🔄 Regenerate</button>
          <button onclick="downloadMindmap()" style="padding:10px 20px;background:var(--bg-glass);border:1px solid var(--border);border-radius:8px;font-weight:600;cursor:pointer;color:var(--text-primary);font-family:'Inter',sans-serif">📥 Download</button>
        </div>
      `;
      setTimeout(() => drawMindMapData(data.mindmap, 'pdfMindmapCanvas'), 100);
      setupMindmapInteractivity('pdfMindmapCanvas');
    } else if (type === 'viva') {
      data = await api.generateViva(state.currentSubject, state.currentPDFName, 10, state.currentPDFText);
      state.vivaQuestions = data.questions;
      state.vivaCurrentQ = 0;
      output.innerHTML = `
        <div style="font-weight:700;margin-bottom:12px">❓ Interactive Viva Practice (${data.questions.length} questions):</div>
        <div id="pdfVivaContainer"></div>
      `;
      renderPDFVivaQuestion();
    }
    showToast(`✅ ${type} generated from PDF!`, 'success');
  } catch (err) {
    output.innerHTML = `<span style="color:var(--danger)">Error: ${err.message}</span>`;
    showToast(err.message, 'error');
  }
}

async function pdfPYQ() {
  const output = document.getElementById('pdfActionOutput');
  if (!output || !state.currentPDFText) { showToast('Please upload a file first', 'warning'); return; }
  output.style.display = 'block';
  output.innerHTML = `<div style="text-align:center;padding:20px">⏳ Analyzing your document as Previous Year Questions...</div>`;
  try {
    const data = await api.call('/api/pyq', 'POST', {
      subject: state.currentSubject,
      textContent: state.currentPDFText,
      apiKey: state.apiKey
    });
    output.innerHTML = formatMarkdown(data.analysis);
    showToast('📊 PYQ Analysis complete!', 'success');
  } catch (err) {
    output.innerHTML = `<span style="color:var(--danger)">Error: ${err.message}</span>`;
    showToast(err.message, 'error');
  }
}

function renderPDFQuizQuestion() {
  const container = document.getElementById('pdfQuizContainer');
  if (!container || !state.quizData.length) return;

  if (state.quizCurrentQ >= state.quizData.length) {
    const pct = Math.round((state.quizScore / state.quizData.length) * 100);
    container.innerHTML = `
      <div style="text-align:center;padding:20px;background:var(--bg-glass);border-radius:12px">
        <div style="font-size:2.5rem;margin-bottom:8px">${pct >= 80 ? '🏆' : pct >= 60 ? '⭐' : '📚'}</div>
        <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700;margin-bottom:8px">${pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good Job!' : 'Keep Practicing!'}</h3>
        <div style="font-size:2rem;font-weight:800;background:linear-gradient(135deg,var(--primary),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent">${pct}%</div>
        <p style="color:var(--text-secondary);margin:8px 0">Score: ${state.quizScore}/${state.quizData.length}</p>
        <button onclick="pdfAction('quiz')" style="margin-top:12px;padding:10px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🔄 Retry Quiz</button>
      </div>
    `;
    return;
  }

  const q = state.quizData[state.quizCurrentQ];
  const pct = ((state.quizCurrentQ + 1) / state.quizData.length) * 100;

  container.innerHTML = `
    <div style="margin-bottom:12px;padding:10px;background:var(--bg-tertiary);border-radius:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-weight:600">Q${state.quizCurrentQ + 1}/${state.quizData.length}</span>
        <span style="color:var(--primary-light)">Score: ${state.quizScore}</span>
      </div>
      <div style="height:4px;background:var(--bg-glass);border-radius:2px;overflow:hidden">
        <div style="height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));width:${pct}%"></div>
      </div>
    </div>
    <div style="font-weight:600;margin-bottom:12px">${q.question}</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${q.options.map((opt, i) => `
        <button class="pdf-quiz-option" onclick="selectPDFQuizAnswer(${i}, ${q.correct})" id="pdfqopt${i}" style="padding:10px 14px;background:var(--bg-glass);border:1px solid var(--border);border-radius:8px;text-align:left;cursor:pointer;font-size:0.85rem;color:var(--text-primary);font-family:'Inter',sans-serif;transition:all 0.2s">
          <span style="font-weight:700;margin-right:8px">${String.fromCharCode(65 + i)}.</span> ${opt}
        </button>
      `).join('')}
    </div>
    <div id="pdfQuizExplain" style="display:none;margin-top:12px;padding:12px;background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.2);border-radius:8px;font-size:0.82rem;color:var(--text-secondary)"></div>
    <button id="pdfQuizNextBtn" style="display:none;margin-top:12px;padding:10px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif" onclick="nextPDFQuizQuestion()">
      ${state.quizCurrentQ < state.quizData.length - 1 ? 'Next →' : 'See Results'}
    </button>
  `;
}

function selectPDFQuizAnswer(selected, correct) {
  document.querySelectorAll('.pdf-quiz-option').forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) {
      btn.style.background = 'rgba(16,185,129,0.2)';
      btn.style.borderColor = 'rgba(16,185,129,0.5)';
      btn.style.color = 'var(--success)';
    } else if (i === selected && i !== correct) {
      btn.style.background = 'rgba(239,68,68,0.2)';
      btn.style.borderColor = 'rgba(239,68,68,0.5)';
      btn.style.color = 'var(--danger)';
    }
  });

  const isRight = selected === correct;
  if (isRight) {
    state.quizScore++;
    updateXP(20);
  }

  const q = state.quizData[state.quizCurrentQ];
  const explain = document.getElementById('pdfQuizExplain');
  const next = document.getElementById('pdfQuizNextBtn');
  if (explain) {
    explain.style.display = 'block';
    explain.innerHTML = `<strong>${isRight ? '✅ Correct!' : '❌ Incorrect'}</strong><br/>${q.explanation || ''}`;
  }
  if (next) next.style.display = 'block';
}

function nextPDFQuizQuestion() {
  state.quizCurrentQ++;
  renderPDFQuizQuestion();
}

function renderPDFFlashcard() {
  const container = document.getElementById('pdfFlashcardContainer');
  if (!container || !state.flashcards.length) return;

  if (state.currentFlashcard >= state.flashcards.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:20px;background:var(--bg-glass);border-radius:12px">
        <div style="font-size:2.5rem;margin-bottom:8px">🎉</div>
        <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700;margin-bottom:8px">All cards reviewed!</h3>
        <p style="color:var(--text-secondary);margin:8px 0">You've gone through ${state.flashcards.length} flashcards</p>
        <button onclick="pdfAction('flashcards')" style="margin-top:12px;padding:10px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🔄 Start Over</button>
      </div>
    `;
    return;
  }

  const card = state.flashcards[state.currentFlashcard];
  
  container.innerHTML = `
    <div style="perspective:1000px;margin-bottom:16px">
      <div id="pdfCardInner" style="position:relative;width:100%;min-height:200px;transition:transform 0.6s;transform-style:preserve-3d;cursor:pointer" onclick="flipPDFCard()">
        <div style="position:absolute;width:100%;height:100%;backface-visibility:hidden;padding:20px;background:var(--bg-glass);border:2px solid var(--border);border-radius:12px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">CARD ${state.currentFlashcard + 1}/${state.flashcards.length}</div>
          <div style="font-size:0.8rem;color:var(--primary-light);margin-bottom:12px">${card.category || 'General'}</div>
          <div style="font-weight:600;font-size:1rem;color:var(--text-primary)">${card.front}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:12px">Click to flip</div>
        </div>
        <div id="pdfCardBack" style="position:absolute;width:100%;height:100%;backface-visibility:hidden;padding:20px;background:rgba(37,99,235,0.1);border:2px solid var(--primary);border-radius:12px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;transform:rotateY(180deg)">
          <div style="font-weight:600;font-size:1rem;color:var(--text-primary)">${card.back}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:12px">Click to flip back</div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button onclick="prevPDFFlashcard()" ${state.currentFlashcard === 0 ? 'disabled style="opacity:0.5"' : ''} style="padding:10px 20px;background:var(--bg-glass);border:1px solid var(--border);border-radius:8px;font-weight:600;cursor:pointer;color:var(--text-primary);font-family:'Inter',sans-serif">← Previous</button>
      <button onclick="markPDFFlashcard('easy')" style="padding:10px 20px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);border-radius:8px;font-weight:600;cursor:pointer;color:var(--success);font-family:'Inter',sans-serif">😊 Easy</button>
      <button onclick="markPDFFlashcard('hard')" style="padding:10px 20px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:8px;font-weight:600;cursor:pointer;color:var(--danger);font-family:'Inter',sans-serif">😰 Hard</button>
      <button onclick="nextPDFFlashcard()" style="padding:10px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Next →</button>
    </div>
  `;
}

function flipPDFCard() {
  const inner = document.getElementById('pdfCardInner');
  if (inner) {
    const isFlipped = inner.style.transform === 'rotateY(180deg)';
    inner.style.transform = isFlipped ? '' : 'rotateY(180deg)';
  }
}

function prevPDFFlashcard() {
  if (state.currentFlashcard > 0) {
    state.currentFlashcard--;
    renderPDFFlashcard();
  }
}

function nextPDFFlashcard() {
  if (state.currentFlashcard < state.flashcards.length - 1) {
    state.currentFlashcard++;
    renderPDFFlashcard();
  }
}

function markPDFFlashcard(difficulty) {
  showToast(difficulty === 'easy' ? '😊 Marked as easy!' : '😰 Will review this again', 'info');
  updateXP(5);
  if (state.currentFlashcard < state.flashcards.length - 1) {
    state.currentFlashcard++;
    renderPDFFlashcard();
  }
}

function regeneratePDFMindmap() {
  pdfAction('mindmap');
}

function downloadMindmap() {
  const canvas = document.getElementById('pdfMindmapCanvas');
  if (canvas) {
    const link = document.createElement('a');
    link.download = `MindMap_${state.currentPDFName}_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    showToast('📥 Mind map downloaded!', 'success');
  }
}

function setupMindmapInteractivity(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  let isDragging = false;
  let lastX, lastY;
  
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    // Pan effect could be added here
  });
  
  canvas.addEventListener('mouseup', () => isDragging = false);
  canvas.addEventListener('mouseleave', () => isDragging = false);
}

function renderPDFVivaQuestion() {
  const container = document.getElementById('pdfVivaContainer');
  if (!container || !state.vivaQuestions.length) return;

  if (state.vivaCurrentQ >= state.vivaQuestions.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:20px;background:var(--bg-glass);border-radius:12px">
        <div style="font-size:2.5rem;margin-bottom:8px">🎓</div>
        <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700;margin-bottom:8px">Viva Practice Complete!</h3>
        <p style="color:var(--text-secondary);margin:8px 0">You've practiced ${state.vivaQuestions.length} viva questions</p>
        <button onclick="pdfAction('viva')" style="margin-top:12px;padding:10px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🔄 Practice Again</button>
      </div>
    `;
    return;
  }

  const q = state.vivaQuestions[state.vivaCurrentQ];
  
  container.innerHTML = `
    <div style="margin-bottom:12px;padding:10px;background:var(--bg-tertiary);border-radius:8px">
      <span style="font-weight:600">Question ${state.vivaCurrentQ + 1}/${state.vivaQuestions.length}</span>
      <span style="float:right;color:var(--primary-light)">Difficulty: ${q.difficulty || 'Medium'}</span>
    </div>
    <div style="margin-bottom:16px;padding:16px;background:var(--bg-glass);border:2px solid var(--border);border-radius:12px">
      <div style="font-weight:700;color:var(--primary-light);margin-bottom:8px">Q${state.vivaCurrentQ + 1}:</div>
      <div style="font-size:1rem;color:var(--text-primary)">${q.question}</div>
    </div>
    <div id="vivaAnswerSection" style="display:none;margin-bottom:16px">
      <div style="padding:16px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:12px">
        <div style="font-weight:700;color:var(--success);margin-bottom:8px">✓ Expected Answer:</div>
        <div style="font-size:0.9rem;color:var(--text-secondary);line-height:1.6">${q.expectedAnswer}</div>
      </div>
      ${q.followUp ? `
        <div style="margin-top:12px;padding:12px;background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.3);border-radius:12px">
          <div style="font-weight:700;color:#a78bfa;margin-bottom:6px">Follow-up:</div>
          <div style="font-size:0.85rem;color:var(--text-secondary)">${q.followUp}</div>
        </div>
      ` : ''}
      ${q.tips ? `
        <div style="margin-top:12px;padding:12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:12px">
          <div style="font-weight:700;color:var(--warning);margin-bottom:6px">💡 Tips:</div>
          <div style="font-size:0.85rem;color:var(--text-secondary)">${q.tips}</div>
        </div>
      ` : ''}
    </div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button id="vivaShowAnswerBtn" onclick="showVivaAnswer()" style="padding:10px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">👁️ Show Answer</button>
      <button id="vivaNextBtn" style="display:none;padding:10px 20px;background:var(--bg-glass);border:1px solid var(--border);border-radius:8px;font-weight:600;cursor:pointer;color:var(--text-primary);font-family:'Inter',sans-serif" onclick="nextPDFVivaQuestion()">Next →</button>
    </div>
  `;
}

function showVivaAnswer() {
  const answerSection = document.getElementById('vivaAnswerSection');
  const showBtn = document.getElementById('vivaShowAnswerBtn');
  const nextBtn = document.getElementById('vivaNextBtn');
  
  if (answerSection) answerSection.style.display = 'block';
  if (showBtn) showBtn.style.display = 'none';
  if (nextBtn) nextBtn.style.display = 'block';
  updateXP(10);
}

function nextPDFVivaQuestion() {
  state.vivaCurrentQ++;
  renderPDFVivaQuestion();
}

// ===================== CODING LAB (REAL EXECUTION) =====================
function renderCodingLab() {
  return `
    <button class="modal-close" onclick="closeModal('featureModal')">✕</button>
    <div class="feature-modal-header">
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700">💻 Coding Lab</h2>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">Real execution • AI Review • 10+ Languages</p>
      </div>
      <div id="runStatusBadge" style="font-size:0.75rem;font-weight:700;padding:5px 12px;border-radius:8px;background:var(--bg-tertiary);color:var(--text-muted)">⏸ Ready</div>
    </div>
    <div class="feature-modal-body">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select id="languageSelect" onchange="updateCodeTemplate()" style="padding:7px 12px;background:#1e2433;border:1px solid rgba(255,255,255,0.12);color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:0.82rem;border-radius:8px;outline:none;cursor:pointer">
          <option value="python">🐍 Python</option>
          <option value="javascript">🌐 JavaScript</option>
          <option value="java">☕ Java</option>
          <option value="c">⚙️ C</option>
          <option value="cpp">⚡ C++</option>
          <option value="go">🔵 Go</option>
          <option value="ruby">💎 Ruby</option>
          <option value="php">🐘 PHP</option>
        </select>
        <button class="run-code-btn" onclick="runRealCode()" style="padding:7px 20px;font-size:0.85rem">▶ Run Code</button>
        <button onclick="generateCodeFromPrompt()" style="padding:7px 14px;background:rgba(124,58,237,0.18);border:1px solid rgba(124,58,237,0.4);border-radius:8px;color:#a78bfa;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">✨ AI Generate</button>
        <button onclick="clearEditorAndOutput()" style="padding:7px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:8px;color:var(--danger);font-size:0.78rem;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">🗑 Clear</button>
        <span style="font-size:0.72rem;color:var(--text-muted);margin-left:auto">Ctrl+Enter to run • Tab = indent</span>
      </div>
      <div class="code-editor-container" style="height:350px">
        <div class="code-editor-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.07)">
            <span style="color:#6e7681;font-size:0.72rem;font-family:'JetBrains Mono',monospace">📝 Code Editor</span>
          </div>
          <textarea class="code-textarea" id="codeEditor" spellcheck="false" onkeydown="handleEditorKey(event)">${codeTemplates.python}</textarea>
        </div>
        <div class="output-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(255,255,255,0.07)">
            <span style="color:#6e7681;font-size:0.72rem;font-family:'JetBrains Mono',monospace">📤 Output</span>
            <button onclick="clearOutput()" style="background:none;border:none;cursor:pointer;color:#6e7681;font-size:0.72rem;font-family:'Inter',sans-serif">Clear</button>
          </div>
          <div class="output-content" id="codeOutput"><span style="color:#6e7681">▶ Press Run Code or Ctrl+Enter to execute</span></div>
        </div>
      </div>
      <div style="margin-top:10px">
        <div style="font-size:0.75rem;font-weight:600;color:var(--text-muted);margin-bottom:4px">📥 Standard Input (stdin) — for input(), Scanner, cin</div>
        <textarea id="stdinInput" placeholder="Enter input values here (one per line)" style="width:100%;height:48px;padding:8px 12px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:0.78rem;resize:vertical;outline:none;box-sizing:border-box"></textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button onclick="aiCodeAction('review')" class="ai-code-btn blue">🤖 AI Review</button>
        <button onclick="aiCodeAction('explain')" class="ai-code-btn purple">📖 Explain</button>
        <button onclick="aiCodeAction('optimize')" class="ai-code-btn green">⚡ Optimize</button>
        <button onclick="aiCodeAction('fix')" class="ai-code-btn red">🐛 Fix Bugs</button>
        <button onclick="aiCodeAction('generate')" class="ai-code-btn cyan">✨ Write Code</button>
      </div>
      <div id="codeAIOutput" style="display:none;margin-top:12px;padding:16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:10px;font-size:0.85rem;line-height:1.7"></div>
    </div>
  `;
}


const codeTemplates = {
  python: `# ===== Python — Working Examples with Output =====
from collections import Counter

# 1. Top K Frequent (LeetCode #347)
def topKFrequent(nums, k):
    count = Counter(nums)
    return sorted(count, key=count.get, reverse=True)[:k]

# 2. Binary Search
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target: return mid
        elif arr[mid] < target: lo = mid + 1
        else: hi = mid - 1
    return -1

# 3. Fibonacci (DP)
def fib(n):
    if n <= 1: return n
    a, b = 0, 1
    for _ in range(2, n + 1): a, b = b, a + b
    return b

# ===== OUTPUT =====
nums = [1,1,1,2,2,3,4,4,4,4]
print("Top 2 frequent:", topKFrequent(nums, 2))

arr = [1, 3, 5, 7, 9, 11, 13, 15]
print("Binary search 7 -> index:", binary_search(arr, 7))
print("Binary search 6 -> index:", binary_search(arr, 6))

print("Fibonacci(10):", [fib(i) for i in range(10)])
print("Done! ✅")`,

  javascript: `// ===== JavaScript — Working Examples =====

// 1. Two Sum (LeetCode #1)
function twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const comp = target - nums[i];
        if (map.has(comp)) return [map.get(comp), i];
        map.set(nums[i], i);
    }
    return [];
}

// 2. Quick Sort
const quickSort = arr => {
    if (arr.length <= 1) return arr;
    const pivot = arr[Math.floor(arr.length / 2)];
    return [...quickSort(arr.filter(x => x < pivot)),
            ...arr.filter(x => x === pivot),
            ...quickSort(arr.filter(x => x > pivot))];
};

// 3. Fibonacci
const fib = n => n <= 1 ? n : fib(n-1) + fib(n-2);

// ===== OUTPUT =====
console.log("Two Sum [2,7,11,15] target=9:", twoSum([2,7,11,15], 9));
console.log("QuickSort:", quickSort([3,6,8,10,1,2,1]));
console.log("Fibonacci:", Array.from({length: 10}, (_, i) => fib(i)));
console.log("Unique:", [...new Set([1,2,2,3,3,4])]);
console.log("Done! ✅");`,

  java: `public class Main {
    // Merge Sort
    static void mergeSort(int[] a, int l, int r) {
        if (l >= r) return;
        int m = (l + r) / 2;
        mergeSort(a, l, m); mergeSort(a, m+1, r);
        int[] tmp = new int[r - l + 1];
        int i = l, j = m + 1, k = 0;
        while (i <= m && j <= r)
            tmp[k++] = a[i] <= a[j] ? a[i++] : a[j++];
        while (i <= m) tmp[k++] = a[i++];
        while (j <= r) tmp[k++] = a[j++];
        for (int x = 0; x < tmp.length; x++) a[l + x] = tmp[x];
    }
    
    static long factorial(int n) {
        return n <= 1 ? 1 : n * factorial(n - 1);
    }
    
    static boolean isPrime(int n) {
        if (n < 2) return false;
        for (int i = 2; i * i <= n; i++)
            if (n % i == 0) return false;
        return true;
    }
    
    public static void main(String[] args) {
        int[] arr = {64, 34, 25, 12, 22, 11, 90};
        mergeSort(arr, 0, arr.length - 1);
        System.out.print("Merge Sorted: ");
        for (int x : arr) System.out.print(x + " ");
        System.out.println();
        
        System.out.println("5! = " + factorial(5));
        System.out.println("10! = " + factorial(10));
        
        System.out.print("Primes < 20: ");
        for (int i = 2; i < 20; i++)
            if (isPrime(i)) System.out.print(i + " ");
        System.out.println("\\nDone! ✅");
    }
}`,

  c: `#include <stdio.h>

void selectionSort(int arr[], int n) {
    for (int i = 0; i < n-1; i++) {
        int minIdx = i;
        for (int j = i+1; j < n; j++)
            if (arr[j] < arr[minIdx]) minIdx = j;
        int temp = arr[minIdx]; arr[minIdx] = arr[i]; arr[i] = temp;
    }
}

int binarySearch(int arr[], int n, int target) {
    int lo = 0, hi = n - 1;
    while (lo <= hi) {
        int mid = (lo + hi) / 2;
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}

int main() {
    int arr[] = {64, 25, 12, 22, 11, 45, 78, 3};
    int n = sizeof(arr)/sizeof(arr[0]);
    selectionSort(arr, n);
    
    printf("Selection Sorted: ");
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    
    int idx = binarySearch(arr, n, 45);
    printf("Binary search 45: index %d\\n", idx);
    
    // Fibonacci
    int a = 0, b = 1;
    printf("Fibonacci: ");
    for (int i = 0; i < 10; i++) {
        printf("%d ", a);
        int t = a + b; a = b; b = t;
    }
    printf("\\nDone! ✅\\n");
    return 0;
}`,

  cpp: `#include <iostream>
#include <vector>
#include <unordered_map>
#include <algorithm>
using namespace std;

// Two Sum
vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int,int> mp;
    for (int i = 0; i < (int)nums.size(); i++) {
        int comp = target - nums[i];
        if (mp.count(comp)) return {mp[comp], i};
        mp[nums[i]] = i;
    }
    return {};
}

// Check palindrome
bool isPalindrome(string s) {
    int l = 0, r = s.size()-1;
    while (l < r) if (s[l++] != s[r--]) return false;
    return true;
}

// Sieve of Eratosthenes
vector<int> sieve(int n) {
    vector<bool> p(n+1, true);
    p[0] = p[1] = false;
    for (int i = 2; i*i <= n; i++)
        if (p[i]) for (int j = i*i; j <= n; j += i) p[j] = false;
    vector<int> res;
    for (int i = 2; i <= n; i++) if (p[i]) res.push_back(i);
    return res;
}

int main() {
    vector<int> nums = {2, 7, 11, 15};
    auto res = twoSum(nums, 9);
    cout << "Two Sum: [" << res[0] << ", " << res[1] << "]" << endl;
    
    cout << "racecar: " << (isPalindrome("racecar") ? "palindrome" : "not") << endl;
    cout << "hello: " << (isPalindrome("hello") ? "palindrome" : "not") << endl;
    
    auto primes = sieve(30);
    cout << "Primes <= 30: ";
    for (int p : primes) cout << p << " ";
    cout << "\\nDone! ✅" << endl;
    return 0;
}`,

  go: `package main

import (
    "fmt"
    "sort"
)

func binarySearch(arr []int, target int) int {
    lo, hi := 0, len(arr)-1
    for lo <= hi {
        mid := (lo + hi) / 2
        if arr[mid] == target { return mid }
        if arr[mid] < target { lo = mid + 1 } else { hi = mid - 1 }
    }
    return -1
}

func fibonacci(n int) []int {
    if n == 0 { return []int{} }
    fib := make([]int, n)
    fib[0] = 0
    if n > 1 { fib[1] = 1 }
    for i := 2; i < n; i++ { fib[i] = fib[i-1] + fib[i-2] }
    return fib
}

func main() {
    arr := []int{3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 7}
    sort.Ints(arr)
    fmt.Println("Sorted:", arr)
    fmt.Println("Search 5:", binarySearch(arr, 5))
    fmt.Println("Search 8:", binarySearch(arr, 8))
    fmt.Println("Fibonacci(12):", fibonacci(12))
    fmt.Println("Done! ✅")
}`,

  ruby: `# Ruby — Working Examples
def merge_sort(arr)
  return arr if arr.length <= 1
  mid = arr.length / 2
  left  = merge_sort(arr[0...mid])
  right = merge_sort(arr[mid..])
  merge(left, right)
end

def merge(l, r)
  result = []
  until l.empty? || r.empty?
    result << (l.first <= r.first ? l.shift : r.shift)
  end
  result + l + r
end

def prime?(n)
  return false if n < 2
  (2..Math.sqrt(n)).none? { |i| n % i == 0 }
end

arr = [38, 27, 43, 3, 9, 82, 10, 55]
puts "Merge Sorted: #{merge_sort(arr)}"
puts "Primes < 20: #{(2..20).select { |n| prime?(n) }}"
puts "String: #{'EduVerse AI'.upcase.chars.sort.join}"
puts "Map: #{[1,2,3,4,5].map { |x| x**2 }}"
puts "Done! ✅"`,

  php: `<?php
function bubbleSort($arr) {
    $n = count($arr);
    for ($i = 0; $i < $n-1; $i++)
        for ($j = 0; $j < $n-$i-1; $j++)
            if ($arr[$j] > $arr[$j+1])
                [$arr[$j], $arr[$j+1]] = [$arr[$j+1], $arr[$j]];
    return $arr;
}

function fibonacci($n) {
    $seq = [0, 1];
    for ($i = 2; $i < $n; $i++)
        $seq[] = $seq[$i-1] + $seq[$i-2];
    return array_slice($seq, 0, $n);
}

function isPrime($n) {
    if ($n < 2) return false;
    for ($i = 2; $i <= sqrt($n); $i++)
        if ($n % $i == 0) return false;
    return true;
}

$arr = [64, 34, 25, 12, 22, 11, 90, 3];
echo "Bubble Sorted: " . implode(", ", bubbleSort($arr)) . "\n";
echo "Fibonacci(10): " . implode(", ", fibonacci(10)) . "\n";
$primes = array_filter(range(2, 30), 'isPrime');
echo "Primes <= 30: " . implode(", ", $primes) . "\n";
echo "Done! ✅\n";
?>`
};

function handleEditorKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault(); runRealCode();
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const el = e.target, s = el.selectionStart;
    el.value = el.value.substring(0, s) + '  ' + el.value.substring(el.selectionEnd);
    el.selectionStart = el.selectionEnd = s + 2;
  }
}

function clearEditorAndOutput() {
  const editor = document.getElementById('codeEditor');
  if (editor) editor.value = '';
  clearOutput();
}

async function runRealCode() {
  const output = document.getElementById('codeOutput');
  const badge = document.getElementById('runStatusBadge');
  const code = document.getElementById('codeEditor')?.value || '';
  const lang = document.getElementById('languageSelect')?.value || 'python';
  const stdin = document.getElementById('stdinInput')?.value || '';
  if (!output) return;
  if (!code.trim()) { showToast('Write some code first!', 'warning'); return; }

  output.innerHTML = '<span style="color:#f59e0b">⚡ Running your code...</span>';
  if (badge) { badge.textContent = '⏳ Running...'; badge.style.color = '#f59e0b'; }
  const start = Date.now();

  try {
    if (!SERVER_ONLINE) throw new Error('Backend offline. Run: node server.js in the project folder');

    const resp = await fetch(`${API_BASE}/api/code/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language: lang, stdin })
    });
    const data = await resp.json();
    const elapsed = Date.now() - start;
    const exitCode = data.code ?? 0;
    const hasCompileErr = data.compile_output && data.compile_output.trim();
    const hasRuntimeErr = data.stderr && data.stderr.trim() && exitCode !== 0;
    const isError = exitCode !== 0 || hasCompileErr;

    let html = '';
    html += `<span style="color:${isError ? '#ef4444' : '#10b981'};font-weight:700">${isError ? '❌ Error' : '✅ Success'} | Exit: ${exitCode} | ${elapsed}ms</span>\n`;
    html += '<span style="color:#374151">──────────────────────────────────────</span>\n';

    if (hasCompileErr) {
      html += `<span style="color:#ef4444">🔨 Compile Error:\n${data.compile_output.trim()}</span>\n`;
    }
    if (hasRuntimeErr) {
      html += `<span style="color:#f97316">🚨 Runtime Error:\n${data.stderr.trim()}</span>\n`;
    }
    if (data.stdout && data.stdout.trim()) {
      html += `\n${data.stdout}`;
    } else if (!isError) {
      html += `\n<span style="color:#6b7280">💡 No output detected.\nTip: Add print() / console.log() / System.out.println() to see results.\n\nExample in Python:\n  result = your_function(...)\n  print(result)    # ← This line produces output!</span>`;
    }

    output.innerHTML = html;
    if (badge) { badge.textContent = isError ? `❌ ${elapsed}ms` : `✅ ${elapsed}ms`; badge.style.color = isError ? '#ef4444' : '#10b981'; }
    if (!isError) updateXP(5);
  } catch (err) {
    output.innerHTML = `<span style="color:#ef4444">❌ ${err.message}</span>`;
    if (badge) { badge.textContent = '❌ Error'; badge.style.color = '#ef4444'; }
    showToast(err.message, 'error');
  }
}

async function aiCodeAction(type) {
  const code = document.getElementById('codeEditor')?.value || '';
  const lang = document.getElementById('languageSelect')?.value || 'python';
  const outputDiv = document.getElementById('codeAIOutput');
  if (!outputDiv) return;

  outputDiv.style.display = 'block';
  outputDiv.innerHTML = `<div style="text-align:center;padding:16px">⏳ AI is analyzing your ${lang} code...</div>`;

  if (!SERVER_ONLINE) {
    outputDiv.innerHTML = `<div style="color:var(--warning)">⚠️ Backend not connected.<br/>Run <code>npm start</code></div>`;
    return;
  }

  try {
    let data;
    const prompts = {
      review: () => api.codeReview(code, lang),
      explain: () => api.codeExplain(code, lang),
      optimize: () => api.codeOptimize(code, lang),
      fix: () => api.codeFix(code, lang, ''),
    };

    if (type === 'generate') {
      const userPrompt = prompt('What code do you want to generate?');
      if (!userPrompt) return;
      data = await api.call('/api/code/generate', 'POST', { prompt: userPrompt, language: lang });
      outputDiv.innerHTML = formatMarkdown(data.code);
      return;
    }

    data = await prompts[type]();
    const key = { review: 'review', explain: 'explanation', optimize: 'optimized', fix: 'fix' }[type];
    outputDiv.innerHTML = formatMarkdown(data[key] || data.response || 'Done');
    showToast(`✅ AI ${type} complete!`, 'success');
    updateXP(10);
  } catch (err) {
    outputDiv.innerHTML = `<span style="color:var(--danger)">Error: ${err.message}</span>`;
    showToast(err.message, 'error');
  }
}

function generateCodeFromPrompt() { aiCodeAction('generate'); }
function clearOutput() {
  const o = document.getElementById('codeOutput');
  if (o) o.textContent = 'Output cleared. Click ▶ Run to execute.';
}

// ===================== QUIZ (REAL AI) =====================
function renderQuizFeature() {
  return `
    <button class="modal-close" onclick="closeModal('featureModal')">✕</button>
    <div class="feature-modal-header">
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700">🎯 AI Quiz Generator</h2>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">Adaptive quiz with real AI questions</p>
      </div>
      <div id="quizScoreDisplay" style="font-family:'Space Grotesk',sans-serif;font-size:1.5rem;font-weight:700;color:var(--primary-light)">0/0</div>
    </div>
    <div class="feature-modal-body">
      <div id="quizSetup">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div class="form-group"><label>Topic</label><input id="quizTopic" type="text" placeholder="e.g., Binary Trees" value="${state.currentSubject}" /></div>
          <div class="form-group"><label>Subject</label><input id="quizSubject" type="text" placeholder="e.g., DSA" value="${state.currentSubject}" /></div>
          <div class="form-group">
            <label>Difficulty</label>
            <select id="quizDiff"><option value="easy">🟢 Easy</option><option value="medium" selected>🟡 Medium</option><option value="hard">🔴 Hard</option></select>
          </div>
          <div class="form-group">
            <label>Questions</label>
            <select id="quizCount"><option value="5">5</option><option value="10" selected>10</option><option value="15">15</option><option value="20">20</option></select>
          </div>
        </div>
        <button onclick="loadRealQuiz()" style="width:100%;padding:13px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🚀 Generate AI Quiz</button>
      </div>
      <div id="quizLoading" style="display:none;text-align:center;padding:32px">
        <div style="font-size:2.5rem;margin-bottom:12px;animation:loadingPulse 1s infinite">🤖</div>
        <p style="color:var(--text-secondary)">Generating personalized questions...</p>
      </div>
      <div id="quizContainer" style="display:none"></div>
    </div>
  `;
}

async function loadRealQuiz() {
  const setup = document.getElementById('quizSetup');
  const loading = document.getElementById('quizLoading');
  const container = document.getElementById('quizContainer');
  const topic = document.getElementById('quizTopic')?.value || state.currentSubject;
  const subject = document.getElementById('quizSubject')?.value || state.currentSubject;
  const difficulty = document.getElementById('quizDiff')?.value || 'medium';
  const count = parseInt(document.getElementById('quizCount')?.value || '10');

  if (setup) setup.style.display = 'none';
  if (loading) loading.style.display = 'block';

  try {
    let questions;
    if (SERVER_ONLINE) {
      const data = await api.generateQuiz(topic, subject, difficulty, count, state.currentPDFText);
      questions = data.questions;
    } else {
      questions = getDefaultQuiz();
      showToast('Using demo quiz. Add API key for AI-generated questions.', 'info');
    }

    state.quizData = questions;
    state.quizCurrentQ = 0;
    state.quizScore = 0;
    state.quizTopic = topic;
    state.quizSubject = subject;
    state.quizDifficulty = difficulty;
    state.quizBatchSize = count;

    if (loading) loading.style.display = 'none';
    if (container) container.style.display = 'block';
    renderQuizQuestion();
    updateXP(5);
  } catch (err) {
    if (loading) loading.style.display = 'none';
    if (setup) setup.style.display = 'block';
    showToast('Quiz generation failed: ' + err.message, 'error');
  }
}

function getDefaultQuiz() {
  return [
    { question: "What is the time complexity of Binary Search?", options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"], correct: 1, explanation: "Binary search divides the search space by half each step." },
    { question: "Which data structure uses LIFO principle?", options: ["Queue", "Stack", "Array", "Linked List"], correct: 1, explanation: "Stack follows Last In First Out." },
    { question: "What does SQL stand for?", options: ["Structured Query Language", "Simple Query Language", "Standard Query Lookup", "System Query Language"], correct: 0, explanation: "SQL = Structured Query Language for databases." },
    { question: "Which layer handles routing in OSI model?", options: ["Data Link", "Transport", "Network", "Physical"], correct: 2, explanation: "Network Layer (Layer 3) handles routing." },
    { question: "What is the output of 5 % 3?", options: ["1", "2", "0", "5"], correct: 1, explanation: "Modulo returns remainder: 5÷3 = 1 remainder 2." },
  ];
}

function renderQuizQuestion() {
  const container = document.getElementById('quizContainer');
  const score = document.getElementById('quizScoreDisplay');
  if (!container || !state.quizData.length) return;

  if (state.quizCurrentQ >= state.quizData.length) { showQuizResults(); return; }

  const q = state.quizData[state.quizCurrentQ];
  const pct = ((state.quizCurrentQ + 1) / state.quizData.length) * 100;

  if (score) score.textContent = `${state.quizScore}/${state.quizData.length}`;

  container.innerHTML = `
    <div class="quiz-progress">
      <div class="quiz-meta">
        <span>Question ${state.quizCurrentQ + 1} of ${state.quizData.length}</span>
        <span style="color:${q.difficulty === 'hard' ? 'var(--danger)' : q.difficulty === 'medium' ? 'var(--warning)' : 'var(--success)'}">${q.difficulty || 'Medium'} • +20 XP</span>
      </div>
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="quiz-question">${state.quizCurrentQ + 1}. ${q.question}</div>
    <div class="quiz-options">
      ${q.options.map((opt, i) => `
        <button class="quiz-option" onclick="selectQuizAnswer(${i}, ${q.correct})" id="qopt${i}">
          <span class="opt-letter">${String.fromCharCode(65 + i)}</span> ${opt}
        </button>
      `).join('')}
    </div>
    <div id="quizExplain" style="display:none;margin-top:12px;padding:12px 16px;background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.2);border-radius:10px;font-size:0.85rem;color:var(--text-secondary)"></div>
    <button id="quizNextBtn" style="display:none;margin-top:14px;padding:11px 24px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif" onclick="nextQuizQuestion()">
      ${state.quizCurrentQ < state.quizData.length - 1 ? 'Next Question →' : 'See Results 🏆'}
    </button>
  `;
}

function selectQuizAnswer(selected, correct) {
  document.querySelectorAll('.quiz-option').forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) btn.classList.add('correct');
    else if (i === selected && i !== correct) btn.classList.add('wrong');
  });
  const isRight = selected === correct;
  if (isRight) { state.quizScore++; updateXP(20); recordPerformanceActivity(state.quizSubject || state.quizTopic, 0.25, true); showToast('🎉 Correct! +20 XP', 'success'); }
  else showToast('❌ Incorrect! Study the explanation.', 'warning');

  const q = state.quizData[state.quizCurrentQ];
  const explain = document.getElementById('quizExplain');
  const next = document.getElementById('quizNextBtn');
  const score = document.getElementById('quizScoreDisplay');
  if (explain) { explain.style.display = 'block'; explain.innerHTML = `💡 <strong>Explanation:</strong> ${q.explanation || 'See the correct answer above.'}`; }
  if (next) next.style.display = 'block';
  if (score) score.textContent = `${state.quizScore}/${state.quizData.length}`;
}

function nextQuizQuestion() {
  state.quizCurrentQ++;
  renderQuizQuestion();
}

async function loadMoreQuizQuestions() {
  const container = document.getElementById('quizContainer');
  if (!container) return;
  const nextIndex = state.quizData.length;
  container.innerHTML = '<div style="text-align:center;padding:28px">Generating fresh questions for your topic...</div>';
  try {
    if (!SERVER_ONLINE) throw new Error('Unlimited AI quizzes need the backend connection.');
    const existing = state.quizData.map(question => question.question);
    const data = await api.generateQuiz(state.quizTopic || state.currentSubject, state.quizSubject || state.currentSubject, state.quizDifficulty, state.quizBatchSize, '', existing);
    const fresh = (data.questions || []).filter(question => !existing.includes(question.question));
    if (!fresh.length) throw new Error('No new questions were generated. Try again.');
    state.quizData.push(...fresh);
    state.quizCurrentQ = nextIndex;
    renderQuizQuestion();
    showToast(`Added ${fresh.length} fresh questions on ${state.quizTopic}.`, 'success');
  } catch (err) {
    showQuizResults();
    showToast(err.message, 'error');
  }
}

function renderQuizFromData(questions) {
  return `<div style="font-weight:700;margin-bottom:12px">Quiz (${questions.length} questions):</div>` +
    questions.slice(0, 5).map((q, i) => `
      <div style="margin-bottom:12px;padding:12px;background:var(--bg-glass);border:1px solid var(--border);border-radius:8px">
        <div style="font-weight:600;margin-bottom:8px">${i + 1}. ${q.question}</div>
        ${q.options.map((o, j) => `<div style="padding:4px 8px;font-size:0.82rem;color:${j === q.correct ? 'var(--success)' : 'var(--text-secondary)'}">${String.fromCharCode(65 + j)}) ${o} ${j === q.correct ? '✅' : ''}</div>`).join('')}
      </div>
    `).join('');
}

function showQuizResults() {
  const container = document.getElementById('quizContainer');
  if (!container) return;
  const pct = Math.round((state.quizScore / state.quizData.length) * 100);
  const xp = state.quizScore * 20;
  updateXP(xp);
  container.innerHTML = `
    <div style="text-align:center;padding:24px">
      <div style="font-size:3.5rem;margin-bottom:12px">${pct >= 80 ? '🏆' : pct >= 60 ? '⭐' : '📚'}</div>
      <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1.6rem;font-weight:700;margin-bottom:8px">${pct >= 80 ? 'Excellent! 🎉' : pct >= 60 ? 'Good Job! 👍' : 'Keep Practicing! 💪'}</h3>
      <div style="font-size:3rem;font-weight:800;background:linear-gradient(135deg,var(--primary),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent">${pct}%</div>
      <p style="color:var(--text-secondary);margin:8px 0">Score: ${state.quizScore}/${state.quizData.length} • ${xp} XP Earned!</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;flex-wrap:wrap">
        <button onclick="loadMoreQuizQuestions()" style="padding:11px 20px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">∞ Continue with new questions</button>
        <button onclick="state.quizCurrentQ=0;state.quizScore=0;renderQuizQuestion();document.getElementById('quizContainer').style.display='block'" style="padding:11px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🔄 Retry Quiz</button>
        <button onclick="document.getElementById('quizSetup').style.display='block';document.getElementById('quizContainer').style.display='none'" style="padding:11px 20px;background:var(--bg-glass);border:1px solid var(--border);border-radius:10px;font-weight:600;cursor:pointer;color:var(--text-primary);font-family:'Inter',sans-serif">📝 New Quiz</button>
      </div>
    </div>
  `;
}

// ===================== FLASHCARDS (REAL AI) =====================
function renderFlashcards() {
  return `
    <button class="modal-close" onclick="closeModal('featureModal')">✕</button>
    <div class="feature-modal-header">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700">🃏 AI Flashcard Generator</h2>
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">Spaced repetition learning cards</p>
    </div>
    <div class="feature-modal-body">
      <div id="flashcardSetup" style="display:flex;gap:10px;margin-bottom:16px">
        <input id="flashcardTopic" type="text" placeholder="Topic (e.g., OS Concepts)" value="${state.currentSubject}" style="flex:1;padding:9px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-family:'Inter',sans-serif;outline:none;font-size:0.88rem" />
        <select id="flashcardCount" style="padding:9px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-family:'Inter',sans-serif;outline:none">
          <option value="10">10 cards</option><option value="15" selected>15 cards</option><option value="20">20 cards</option>
        </select>
        <button onclick="loadRealFlashcards()" style="padding:9px 18px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;white-space:nowrap">Generate</button>
      </div>
      <div id="flashcardContainer"></div>
    </div>
  `;
}

async function loadRealFlashcards() {
  const container = document.getElementById('flashcardContainer');
  const topic = document.getElementById('flashcardTopic')?.value || state.currentSubject;
  const count = parseInt(document.getElementById('flashcardCount')?.value || '15');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:24px">⏳ Generating flashcards with AI...</div>';

  try {
    let flashcards;
    if (SERVER_ONLINE) {
      const data = await api.generateFlashcards(topic, state.currentSubject, count, state.currentPDFText);
      flashcards = data.flashcards;
    } else {
      flashcards = [
        { front: 'What is a Stack?', back: 'A LIFO data structure. push() adds, pop() removes from top.', category: 'DS', difficulty: 'easy' },
        { front: 'Time complexity of BFS?', back: 'O(V + E) where V = vertices, E = edges', category: 'Algorithms', difficulty: 'medium' },
        { front: 'What is Normalization?', back: 'Process of organizing DB to reduce redundancy. 1NF→2NF→3NF→BCNF', category: 'DBMS', difficulty: 'medium' },
        { front: 'What is TCP?', back: 'Transmission Control Protocol. Connection-oriented, reliable delivery via 3-way handshake.', category: 'Networks', difficulty: 'medium' },
        { front: 'What is Deadlock?', back: 'A state where processes wait for each other indefinitely. Conditions: Mutual exclusion, Hold & Wait, No preemption, Circular wait.', category: 'OS', difficulty: 'hard' },
      ];
      showToast('Demo cards loaded. Add API key for AI cards.', 'info');
    }

    state.flashcards = flashcards;
    state.currentFlashcard = 0;
    container.innerHTML = renderFlashcardView();
    showToast(`✅ ${flashcards.length} flashcards ready!`, 'success');
    updateXP(15);
  } catch (err) {
    container.innerHTML = `<span style="color:var(--danger)">Error: ${err.message}</span>`;
    showToast(err.message, 'error');
  }
}

function renderFlashcardView() {
  const cards = state.flashcards;
  if (!cards.length) return '<p>No cards generated.</p>';
  return `
    <div style="text-align:center;margin-bottom:12px;font-size:0.82rem;color:var(--text-muted)">${state.currentFlashcard + 1} / ${cards.length}</div>
    <div class="flashcard" id="flashcard" onclick="flipCard()" style="perspective:1000px;cursor:pointer;height:200px;margin-bottom:16px">
      <div class="flashcard-inner" id="flashcardInner" style="width:100%;height:100%;position:relative;transition:transform 0.6s;transform-style:preserve-3d">
        <div class="flashcard-front" style="position:absolute;width:100%;height:100%;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,rgba(37,99,235,0.1),rgba(124,58,237,0.1));border:1px solid rgba(37,99,235,0.3);border-radius:16px;text-align:center">
          <div>
            <div style="font-size:0.72rem;font-weight:700;color:var(--primary-light);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">📖 QUESTION</div>
            <div style="font-size:1.05rem;font-weight:600;line-height:1.5">${cards[state.currentFlashcard].front}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:12px">Click to reveal answer</div>
          </div>
        </div>
        <div class="flashcard-back" style="position:absolute;width:100%;height:100%;backface-visibility:hidden;transform:rotateY(180deg);display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(6,182,212,0.1));border:1px solid rgba(16,185,129,0.3);border-radius:16px;text-align:center">
          <div>
            <div style="font-size:0.72rem;font-weight:700;color:var(--success);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px">✅ ANSWER</div>
            <div style="font-size:0.95rem;line-height:1.6">${cards[state.currentFlashcard].back}</div>
          </div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button onclick="prevCard()" style="padding:10px 20px;background:var(--bg-glass);border:1px solid var(--border);border-radius:10px;font-weight:600;cursor:pointer;color:var(--text-primary);font-family:'Inter',sans-serif" ${state.currentFlashcard === 0 ? 'disabled style="opacity:0.4"' : ''}>← Prev</button>
      <button onclick="markCard('easy')" style="padding:10px 16px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;font-weight:600;cursor:pointer;color:var(--success);font-family:'Inter',sans-serif">😊 Easy</button>
      <button onclick="markCard('hard')" style="padding:10px 16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;font-weight:600;cursor:pointer;color:var(--danger);font-family:'Inter',sans-serif">😰 Hard</button>
      <button onclick="nextCard()" style="padding:10px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));border:none;border-radius:10px;font-weight:700;cursor:pointer;color:white;font-family:'Inter',sans-serif" ${state.currentFlashcard === cards.length - 1 ? 'disabled style="opacity:0.4"' : ''}>Next →</button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;justify-content:center">
      ${cards.map((_, i) => `<div style="width:10px;height:10px;border-radius:50%;background:${i === state.currentFlashcard ? 'var(--primary)' : 'var(--bg-tertiary)'};transition:all 0.3s"></div>`).join('')}
    </div>
  `;
}

function renderFlashcardsHTML(flashcards) {
  return flashcards.slice(0, 6).map((f, i) => `
    <div style="padding:12px;background:var(--bg-glass);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
      <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px">Q:</div>
      <div style="font-weight:600;margin-bottom:6px">${f.front}</div>
      <div style="font-size:0.72rem;color:var(--success);margin-bottom:4px">A:</div>
      <div style="font-size:0.85rem;color:var(--text-secondary)">${f.back}</div>
    </div>
  `).join('');
}

function flipCard() {
  const inner = document.getElementById('flashcardInner');
  if (inner) {
    const isFlipped = inner.style.transform === 'rotateY(180deg)';
    inner.style.transform = isFlipped ? '' : 'rotateY(180deg)';
  }
}

function nextCard() {
  if (state.currentFlashcard < state.flashcards.length - 1) {
    state.currentFlashcard++;
    document.getElementById('flashcardContainer').innerHTML = renderFlashcardView();
  }
}

function prevCard() {
  if (state.currentFlashcard > 0) {
    state.currentFlashcard--;
    document.getElementById('flashcardContainer').innerHTML = renderFlashcardView();
  }
}

function markCard(difficulty) {
  showToast(difficulty === 'easy' ? '😊 Marked as easy!' : '😰 Will repeat this one!', 'info');
  nextCard();
}

// ===================== MIND MAP (REAL AI) =====================
function renderMindMap() {
  return `
    <button class="modal-close" onclick="closeModal('featureModal')">✕</button>
    <div class="feature-modal-header">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700">🗺️ AI Mind Map Generator</h2>
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">Interactive visual mind maps from any topic</p>
    </div>
    <div class="feature-modal-body" style="padding-top:16px">
      <div style="display:flex;gap:10px;margin-bottom:16px">
        <textarea id="mindmapTopic" placeholder="Write a complete prompt, topic, notes, or learning goal. Example: Create a visual mind map for a fresher preparing for software engineering placements, including DSA, projects, aptitude, communication, and interview preparation." style="flex:1;min-height:86px;padding:12px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-family:'Inter',sans-serif;outline:none;font-size:.88rem;resize:vertical">${state.currentSubject}</textarea>
        <button onclick="generateAIMindMap()" style="padding:9px 18px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🤖 Generate</button>
        <button onclick="exportMindMap()" style="padding:9px 14px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;color:var(--success);cursor:pointer;font-size:0.8rem;font-weight:600;font-family:'Inter',sans-serif">📥 PNG</button>
      </div>
      <div class="mindmap-container">
        <canvas id="mindmapCanvas"></canvas>
      </div>
    </div>
  `;
}

async function generateAIMindMap() {
  const topic = document.getElementById('mindmapTopic')?.value.trim() || state.currentSubject;
  showToast('Generating mind map...', 'info');
  try {
    if (SERVER_ONLINE) {
      // This tool is driven by the user's typed topic, not an older uploaded document.
      const data = await api.generateMindmap(topic, '');
      drawMindMapData(data.mindmap, 'mindmapCanvas');
    } else {
      drawMindMap(topic);
    }
    showToast('🗺️ Mind map generated!', 'success');
    updateXP(10);
  } catch (err) {
    drawMindMap(topic); // Fallback to default
    showToast('Using default mind map. ' + err.message, 'warning');
  }
}

function drawMindMap(topicOverride) {
  const topic = topicOverride || document.getElementById('mindmapTopic')?.value || state.currentSubject;
  const defaultData = {
    center: topic,
    nodes: [
      { label: 'Definition', color: '#2563EB', subs: ['Core Concept', 'Origin', 'Purpose'] },
      { label: 'Types', color: '#7C3AED', subs: ['Type A', 'Type B', 'Type C'] },
      { label: 'Applications', color: '#06B6D4', subs: ['Industry', 'Research', 'Education'] },
      { label: 'Advantages', color: '#10B981', subs: ['Speed', 'Accuracy', 'Scalability'] },
      { label: 'Challenges', color: '#F59E0B', subs: ['Complexity', 'Cost', 'Maintenance'] },
      { label: 'Algorithms', color: '#EF4444', subs: ['Method 1', 'Method 2'] },
      { label: 'Examples', color: '#8B5CF6', subs: ['Example 1', 'Example 2', 'Example 3'] },
    ]
  };
  drawMindMapData(defaultData, 'mindmapCanvas');
}

function drawMindMapData(data, canvasId = 'mindmapCanvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data) return;
  const container = canvas.parentElement;
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  // One vertical lane per branch prevents labels from colliding on large maps.
  const requiredHeight = Math.max(560, nodes.length * 118 + 90);
  container.style.height = `${requiredHeight}px`;
  canvas.width = container.offsetWidth || 700;
  canvas.height = requiredHeight;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  const background = ctx.createLinearGradient(0, 0, w, h);
  background.addColorStop(0, '#07101f'); background.addColorStop(.5, '#0b1020'); background.addColorStop(1, '#100a24');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);

  const cx = Math.max(140, w * .16), cy = h / 2;
  const branchX = w * .46, subX = w * .79;
  const rowGap = (h - 80) / Math.max(nodes.length, 1);
  drawMindNode(ctx, cx, cy, mindMapText(data.center) || 'Topic', '#2563EB', 20, true);

  nodes.forEach((node, i) => {
    const nx = branchX;
    const ny = 40 + rowGap * (i + .5);
    const color = node.color || '#2563EB';

    const grad = ctx.createLinearGradient(cx, cy, nx, ny);
    grad.addColorStop(0, 'rgba(37,99,235,0.4)');
    grad.addColorStop(1, color + '80');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke();

    drawMindNode(ctx, nx, ny, mindMapText(node.label || node), color, 14, false);

    const subs = Array.isArray(node.subs) ? node.subs.slice(0, 3) : [];
    subs.forEach((sub, j) => {
      const sx = subX;
      const sy = ny + (j - (subs.length - 1) / 2) * 34;
      ctx.strokeStyle = color + '50';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.setLineDash([]);
      drawMindNode(ctx, sx, sy, mindMapText(sub), color, 10, false);
    });
  });
}

function mindMapText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';
  const label = value.label || value.name || value.title || value.text || 'Concept';
  const children = Array.isArray(value.subs) ? value.subs : (Array.isArray(value.children) ? value.children : []);
  if (!children.length) return String(label);
  const childText = children.slice(0, 3).map(mindMapText).filter(Boolean).join(', ');
  return childText ? `${label}: ${childText}` : String(label);
}

function drawMindNode(ctx, x, y, text, color, fontSize, isCenter) {
  ctx.font = `${isCenter ? 'bold ' : ''}${fontSize}px Inter,sans-serif`;
  const pad = isCenter ? 18 : 10;
  const maxWidth = isCenter ? 300 : (fontSize <= 10 ? 175 : 210);
  const lines = wrapMindText(ctx, text, maxWidth - pad * 2);
  const lineHeight = fontSize * 1.35;
  const tw = Math.min(maxWidth - pad * 2, Math.max(...lines.map(line => ctx.measureText(line).width), 30));
  const bw = tw + pad * 2, bh = lines.length * lineHeight + pad * 2;
  ctx.shadowColor = color; ctx.shadowBlur = isCenter ? 20 : 8;
  ctx.fillStyle = color + '18';
  ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 6); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = isCenter ? 2 : 1.2; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = isCenter ? '#fff' : '#e2e8f0';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((line, index) => ctx.fillText(line, x, y - ((lines.length - 1) * lineHeight) / 2 + index * lineHeight));
}

function wrapMindText(ctx, value, maxWidth) {
  const words = String(value || 'Concept').split(/\s+/); const lines = []; let line = '';
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; }
    else line = candidate;
  });
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function exportMindMap() {
  const canvas = document.getElementById('mindmapCanvas');
  if (!canvas) return;
  const a = document.createElement('a');
  a.download = `EduVerse_MindMap_${Date.now()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  showToast('📥 Mind map exported!', 'success');
}

// ===================== VIVA (REAL AI) =====================
function renderViva() {
  return `
    <button class="modal-close" onclick="closeModal('featureModal')">✕</button>
    <div class="feature-modal-header">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700">🎤 AI Viva Preparation</h2>
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">Practice with AI examiner • Voice mode</p>
    </div>
    <div class="feature-modal-body">
      <div id="vivaSetup" style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <input id="vivaSubject" type="text" placeholder="Subject (e.g., DBMS)" value="${state.currentSubject}" style="flex:1;min-width:140px;padding:9px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-family:'Inter',sans-serif;outline:none;font-size:0.88rem" />
        <input id="vivaTopic" type="text" placeholder="Topic (optional)" style="flex:1;min-width:140px;padding:9px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-family:'Inter',sans-serif;outline:none;font-size:0.88rem" />
        <button onclick="loadVivaQuestions()" style="padding:9px 18px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Load Questions</button>
      </div>
      <div id="vivaContainer"></div>
    </div>
  `;
}

async function loadVivaQuestions() {
  const container = document.getElementById('vivaContainer');
  const subject = document.getElementById('vivaSubject')?.value || state.currentSubject;
  const topic = document.getElementById('vivaTopic')?.value || '';
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:24px">⏳ Generating viva questions...</div>';

  try {
    let questions;
    if (SERVER_ONLINE) {
      const data = await api.generateViva(subject, topic, 10, state.currentPDFText);
      questions = data.questions;
    } else {
      questions = [
        { question: 'Explain ACID properties in DBMS with examples.', expectedAnswer: 'Atomicity (all or nothing), Consistency (valid state), Isolation (transactions independent), Durability (changes permanent). Example: Bank transfer.', followUp: 'How does isolation prevent dirty reads?', tips: 'Use real-world examples like banking transactions.' },
        { question: 'What is the difference between Stack and Heap memory?', expectedAnswer: 'Stack: local variables, LIFO, fast, limited size. Heap: dynamic memory, slower, larger, managed with malloc/free or GC.', followUp: 'What causes a stack overflow?', tips: 'Mention time and space complexity differences.' },
        { question: 'Explain the concept of Virtual Memory.', expectedAnswer: 'Virtual memory extends RAM using disk space. Uses paging/segmentation. Allows processes to use more memory than physically available.', followUp: 'What is a page fault?', tips: 'Draw a memory hierarchy diagram mentally.' },
      ];
      showToast('Demo viva questions loaded. Add API key for AI questions.', 'info');
    }

    state.vivaQuestions = questions;
    state.vivaCurrentQ = 0;
    state.vivaSubject = subject;
    state.vivaTopic = topic;
    renderVivaQuestion();
    showToast(`✅ ${questions.length} viva questions ready!`, 'success');
    updateXP(10);
  } catch (err) {
    container.innerHTML = `<span style="color:var(--danger)">Error: ${err.message}</span>`;
    showToast(err.message, 'error');
  }
}

function renderVivaQuestion() {
  const container = document.getElementById('vivaContainer');
  if (!container || !state.vivaQuestions.length) return;

  const q = state.vivaQuestions[state.vivaCurrentQ];
  const total = state.vivaQuestions.length;

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span style="font-size:0.82rem;color:var(--text-muted)">Question ${state.vivaCurrentQ + 1}/${total} • Unlimited practice</span>
      <div style="display:flex;gap:8px">
        <button onclick="speakVivaQuestion()" style="padding:6px 12px;background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.2);border-radius:8px;color:var(--primary-light);cursor:pointer;font-size:0.75rem;font-weight:600;font-family:'Inter',sans-serif">🔊 Read</button>
        <button onclick="recordVivaAnswer()" style="padding:6px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;color:var(--danger);cursor:pointer;font-size:0.75rem;font-weight:600;font-family:'Inter',sans-serif" id="vivaRecordBtn">🎤 Answer</button>
      </div>
    </div>
    <div style="padding:20px;background:linear-gradient(135deg,rgba(37,99,235,0.05),rgba(124,58,237,0.05));border:1px solid rgba(37,99,235,0.2);border-radius:12px;margin-bottom:14px">
      <div style="font-size:0.75rem;font-weight:700;color:var(--primary-light);margin-bottom:8px">🤖 AI EXAMINER ASKS:</div>
      <div style="font-size:1rem;font-weight:600;line-height:1.5">${q.question}</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button onclick="toggleVivaAnswer()" style="padding:10px 16px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;color:var(--success);cursor:pointer;font-size:0.82rem;font-weight:600;font-family:'Inter',sans-serif">💡 Model Answer</button>
      <button onclick="toggleVivaFollowUp()" style="padding:10px 16px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;color:var(--warning);cursor:pointer;font-size:0.82rem;font-weight:600;font-family:'Inter',sans-serif">❓ Follow-up</button>
      <button onclick="toggleVivaTips()" style="padding:10px 16px;background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.3);border-radius:8px;color:#a78bfa;cursor:pointer;font-size:0.82rem;font-weight:600;font-family:'Inter',sans-serif">💡 Tips</button>
    </div>
    <div id="vivaAnswer" style="display:none;padding:14px;background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.2);border-radius:10px;font-size:0.88rem;line-height:1.6;margin-bottom:8px">
      <strong style="color:var(--success)">Expected Answer:</strong><br/>${q.expectedAnswer}
    </div>
    <div id="vivaFollowUp" style="display:none;padding:14px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:10px;font-size:0.88rem;line-height:1.6;margin-bottom:8px">
      <strong style="color:var(--warning)">Follow-up:</strong> ${q.followUp || 'No follow-up question.'}
    </div>
    <div id="vivaTips" style="display:none;padding:14px;background:rgba(124,58,237,0.07);border:1px solid rgba(124,58,237,0.2);border-radius:10px;font-size:0.88rem;line-height:1.6;margin-bottom:8px">
      <strong style="color:#a78bfa">Tips:</strong> ${q.tips || 'Be clear and use examples.'}
    </div>
    <div style="display:flex;gap:10px;margin-top:8px">
      <button onclick="prevVivaQ()" style="padding:10px 20px;background:var(--bg-glass);border:1px solid var(--border);border-radius:10px;font-weight:600;cursor:pointer;color:var(--text-primary);font-family:'Inter',sans-serif" ${state.vivaCurrentQ === 0 ? 'disabled' : ''}>← Previous</button>
      <button onclick="nextVivaQ()" style="padding:10px 20px;background:linear-gradient(135deg,var(--primary),var(--secondary));border:none;border-radius:10px;font-weight:700;cursor:pointer;color:white;font-family:'Inter',sans-serif" ${state.vivaCurrentQ === total - 1 ? 'disabled' : ''}>Next →</button>
    </div>
    <button onclick="loadMoreVivaQuestions()" style="margin-top:12px;padding:10px 18px;background:rgba(124,58,237,.14);border:1px solid rgba(124,58,237,.45);border-radius:10px;color:#a78bfa;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">∞ Load 10 New Questions</button>
  `;
}

function toggleVivaAnswer() { const el = document.getElementById('vivaAnswer'); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function toggleVivaFollowUp() { const el = document.getElementById('vivaFollowUp'); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function toggleVivaTips() { const el = document.getElementById('vivaTips'); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function speakVivaQuestion() { const q = state.vivaQuestions[state.vivaCurrentQ]; if (q) speakText(q.question); }

function recordVivaAnswer() {
  const btn = document.getElementById('vivaRecordBtn');
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('Voice not supported in this browser', 'warning'); return;
  }
  btn.textContent = '⏹ Stop';
  showToast('🎤 Listening to your answer...', 'info');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new SR(); r.lang = 'en-IN';
  r.start();
  r.onresult = e => {
    const text = e.results[0][0].transcript;
    showToast(`Your answer recorded: "${text.substring(0, 50)}..."`, 'success');
    btn.textContent = '🎤 Answer';
    const q = state.vivaQuestions[state.vivaCurrentQ];
    if (q && text.toLowerCase().includes(q.expectedAnswer.toLowerCase().split(' ')[0])) {
      showToast('✅ Great answer! Moving to next.', 'success');
      setTimeout(nextVivaQ, 1500);
    }
  };
  r.onerror = r.onend = () => { btn.textContent = '🎤 Answer'; };
}

function renderVivaHTML(questions) {
  return questions.slice(0, 5).map((q, i) => `
    <div style="margin-bottom:12px;padding:12px;background:var(--bg-glass);border:1px solid var(--border);border-radius:8px">
      <div style="font-weight:700;color:var(--primary-light);margin-bottom:6px">Q${i+1}: ${q.question}</div>
      <div style="font-size:0.82rem;color:var(--text-secondary)">${q.expectedAnswer}</div>
    </div>
  `).join('');
}

function prevVivaQ() { if (state.vivaCurrentQ > 0) { state.vivaCurrentQ--; renderVivaQuestion(); } }
function nextVivaQ() { if (state.vivaCurrentQ < state.vivaQuestions.length - 1) { state.vivaCurrentQ++; renderVivaQuestion(); } }

async function loadMoreVivaQuestions() {
  const container = document.getElementById('vivaContainer');
  if (!container) return;
  const nextIndex = state.vivaQuestions.length;
  container.innerHTML = '<div style="text-align:center;padding:24px">⏳ Generating 10 fresh viva questions…</div>';
  try {
    if (!SERVER_ONLINE) throw new Error('Unlimited AI questions need the backend connection.');
    const existing = state.vivaQuestions.map(question => question.question);
    const data = await api.generateViva(state.vivaSubject || state.currentSubject, state.vivaTopic, 10, '', existing);
    const fresh = (data.questions || []).filter(question => !existing.includes(question.question));
    if (!fresh.length) throw new Error('No new questions were generated. Please try again.');
    state.vivaQuestions.push(...fresh);
    state.vivaCurrentQ = nextIndex;
    renderVivaQuestion();
    showToast(`✅ Added ${fresh.length} new questions. Keep practicing!`, 'success');
  } catch (err) {
    renderVivaQuestion();
    showToast(err.message, 'error');
  }
}

// ===================== PLANNER (REAL AI) =====================
function renderPlanner() {
  return `
    <button class="modal-close" onclick="closeModal('featureModal')">✕</button>
    <div class="feature-modal-header">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700">📅 AI Semester Planner</h2>
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">Personalized AI-generated study plan</p>
    </div>
    <div class="feature-modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="form-group"><label>University</label><input id="planUniversity" type="text" placeholder="e.g., VTU, Anna University" /></div>
        <div class="form-group"><label>Semester</label><select id="planSemester">${[1,2,3,4,5,6,7,8].map(s => `<option>${s}${s===1?'st':s===2?'nd':s===3?'rd':'th'} Semester</option>`).join('')}</select></div>
        <div class="form-group"><label>Branch</label><select id="planBranch"><option>Computer Science</option><option>ECE</option><option>Mechanical</option><option>Civil</option><option>AI/ML</option><option>Data Science</option></select></div>
        <div class="form-group"><label>Subjects (comma separated)</label><input id="planSubjects" type="text" placeholder="DSA, DBMS, OS, CN, TOC" /></div>
        <div class="form-group"><label>Exam Date</label><input id="planExamDate" type="date" /></div>
        <div class="form-group"><label>Hours per Day</label><input id="planHours" type="number" min="1" max="12" value="4" /></div>
      </div>
      <button onclick="generateRealPlan()" style="width:100%;padding:13px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:0.95rem;font-family:'Inter',sans-serif;margin-bottom:16px">🚀 Generate AI Study Plan</button>
      <div id="planOutput" style="display:none;max-height:450px;overflow-y:auto;padding:20px;background:var(--bg-glass);border:1px solid var(--border);border-radius:12px;line-height:1.7;font-size:0.9rem"></div>
    </div>
  `;
}

async function generateRealPlan() {
  const output = document.getElementById('planOutput');
  if (!output) return;
  output.style.display = 'block';
  output.innerHTML = '<div style="text-align:center;padding:24px">⏳ AI is creating your personalized study plan...</div>';
  try {
    if (!SERVER_ONLINE) throw new Error('Backend not connected');
    const data = await api.generatePlan({
      university: document.getElementById('planUniversity')?.value,
      semester: document.getElementById('planSemester')?.value,
      branch: document.getElementById('planBranch')?.value,
      subjects: document.getElementById('planSubjects')?.value,
      examDate: document.getElementById('planExamDate')?.value,
      hoursPerDay: document.getElementById('planHours')?.value,
    });
    output.innerHTML = formatMarkdown(data.plan);
    showToast('📅 Study plan generated!', 'success');
    updateXP(25);
  } catch (err) {
    output.innerHTML = `<div style="color:var(--danger)">❌ ${err.message}</div><div style="margin-top:12px;color:var(--text-secondary)">Start backend: <code>npm start</code> and add API key.</div>`;
    showToast(err.message, 'error');
  }
}

// ===================== PLACEMENT SUBJECT MASTERY =====================
const placementSubjects = {
  'Data Structures': { explanation: 'Data structures organize data so programs can store, search, and update it efficiently.', chapters: ['Arrays and Strings', 'Linked Lists', 'Stacks and Queues', 'Hashing', 'Trees and BST', 'Heaps', 'Graphs', 'Tries'], questions: ['When would you use an array instead of a linked list?', 'How does a hash table handle collisions?', 'Explain BFS versus DFS and their use cases.'] },
  'Algorithms': { explanation: 'Algorithms are step-by-step methods for solving problems efficiently and correctly.', chapters: ['Complexity Analysis', 'Sorting', 'Binary Search', 'Two Pointers', 'Sliding Window', 'Recursion', 'Greedy', 'Dynamic Programming', 'Backtracking'], questions: ['Explain time and space complexity using an example.', 'When is dynamic programming better than recursion?', 'How does binary search work and what are its requirements?'] },
  'DBMS': { explanation: 'A DBMS stores and manages structured data while keeping it consistent, secure, and easy to query.', chapters: ['ER Model', 'Keys and Constraints', 'SQL Queries', 'Joins', 'Normalization', 'Indexes', 'Transactions and ACID', 'Concurrency Control'], questions: ['Explain ACID properties with a banking example.', 'What is normalization and why is it needed?', 'What is the difference between clustered and non-clustered indexes?'] },
  'Operating Systems': { explanation: 'An operating system manages hardware resources and provides services to programs.', chapters: ['Processes and Threads', 'CPU Scheduling', 'Synchronization', 'Deadlocks', 'Memory Management', 'Virtual Memory', 'File Systems', 'Paging and Segmentation'], questions: ['What is the difference between a process and a thread?', 'Explain deadlock conditions and prevention.', 'What happens during a page fault?'] },
  'Computer Networks': { explanation: 'Computer networks let devices communicate using protocols, addressing, and reliable data transfer.', chapters: ['OSI and TCP/IP Models', 'IP Addressing', 'Routing', 'TCP and UDP', 'HTTP and HTTPS', 'DNS', 'Sockets', 'Network Security'], questions: ['Compare TCP and UDP.', 'What happens when you enter a URL in a browser?', 'Explain the purpose of DNS.'] },
  'OOP': { explanation: 'Object-oriented programming structures software around objects that contain data and behavior.', chapters: ['Classes and Objects', 'Encapsulation', 'Inheritance', 'Polymorphism', 'Abstraction', 'Interfaces', 'SOLID Principles', 'Design Patterns'], questions: ['Explain all four pillars of OOP.', 'What is the difference between abstraction and encapsulation?', 'When would you prefer composition over inheritance?'] },
  'System Design': { explanation: 'System design plans reliable, scalable software services and the components that support them.', chapters: ['Requirements', 'Load Balancing', 'Caching', 'Databases', 'Message Queues', 'Microservices', 'Scalability', 'Monitoring'], questions: ['How would you design a URL shortener?', 'When should you use caching and what are its trade-offs?', 'How would you handle a sudden traffic spike?'] },
  'Software Engineering': { explanation: 'Software engineering is the disciplined process of designing, building, testing, and maintaining software.', chapters: ['SDLC', 'Agile and Scrum', 'Git and Version Control', 'Testing', 'CI/CD', 'Code Reviews', 'Requirements', 'Design Principles'], questions: ['Explain the stages of SDLC.', 'What is the difference between unit, integration, and end-to-end testing?', 'How does a pull request improve code quality?'] },
  'Aptitude': { explanation: 'Aptitude tests measure numerical, logical, verbal, and problem-solving ability used in placement assessments.', chapters: ['Percentages', 'Profit and Loss', 'Time and Work', 'Speed and Distance', 'Probability', 'Logical Reasoning', 'Verbal Ability', 'Data Interpretation'], questions: ['How do you calculate percentage increase?', 'What approach do you use for time-and-work questions?', 'How do you solve a logical syllogism?'] }
};

function showPlacementSubject(subject) {
  const data = placementSubjects[subject]; const target = document.getElementById('placementSubjectDetails');
  if (!data || !target) return;
  document.querySelectorAll('.placement-subject-card').forEach(card => card.classList.toggle('active', card.querySelector('strong')?.textContent === subject));
  target.innerHTML = `<h3 style="margin-bottom:8px">${subject}</h3><p style="color:var(--text-secondary);line-height:1.6"><b>Simple explanation:</b> ${data.explanation}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:16px"><div><h4>Important chapters</h4><ol style="color:var(--text-secondary);line-height:1.8;padding-left:20px">${data.chapters.map(chapter => `<li>${chapter}</li>`).join('')}</ol></div><div><h4>Common interview questions</h4><ol style="color:var(--text-secondary);line-height:1.8;padding-left:20px">${data.questions.map(question => `<li>${question}</li>`).join('')}</ol></div></div><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:16px"><button onclick="loadPlacementSubjectQuestions('${subject}', true)" class="ai-code-btn blue">Generate important questions</button><button onclick="loadPlacementSubjectQuestions('${subject}', false)" class="ai-code-btn purple">∞ Load 10 more questions</button><button onclick="openFeature('placement');setTimeout(()=>showPlacementTab('interview', document.querySelector('.ptab-btn:nth-child(2)')),150)" class="ai-code-btn green">Practice interview questions</button></div><div id="placementQuestions" style="margin-top:16px"></div>`;
  target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function loadPlacementSubjectQuestions(subject, reset = false) {
  const output = document.getElementById('placementQuestions');
  if (!output) return;
  if (reset) state.placementQuestionHistory[subject] = [];
  const previous = state.placementQuestionHistory[subject] || [];
  output.innerHTML = '<div style="padding:14px;color:var(--text-muted)">Generating important questions for this subject...</div>';
  try {
    if (!SERVER_ONLINE) throw new Error('Connect the backend to generate unlimited AI questions.');
    const data = await api.chat(`Create 10 important placement and interview questions for the subject: ${subject}. Cover different chapters and difficulty levels. For every question provide a concise expected answer and one interview tip. Use clear markdown headings. Do not repeat these already-used questions: ${previous.slice(-20).join(' | ')}`, `${subject} Placement Preparation`);
    state.placementQuestionHistory[subject] = [...previous, data.response];
    output.innerHTML = `<div style="font-size:.8rem;color:var(--primary-light);margin-bottom:8px">Question batch ${state.placementQuestionHistory[subject].length} • Unlimited questions</div>` + state.placementQuestionHistory[subject].map((batch, index) => `<div style="margin:10px 0;padding:14px;border:1px solid var(--border);border-radius:10px"><b>Batch ${index + 1}</b>${formatMarkdown(batch)}</div>`).join('');
  } catch (err) {
    output.innerHTML = `<span style="color:var(--danger)">Error: ${err.message}</span>`;
  }
}

// ===================== PLACEMENT HUB =====================
function renderPlacement() {
  return `
    <button class="modal-close" onclick="closeModal('featureModal')">✕</button>
    <div class="feature-modal-header">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700">🏆 Placement Hub</h2>
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">Complete placement preparation toolkit</p>
    </div>
    <div class="feature-modal-body">
      <div id="placementTabs" style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
        ${[['resume','📄 Resume','showPlacementTab'],['interview','🤝 Mock Interview','showPlacementTab'],['coding','💻 DSA Practice','showPlacementTab'],['aptitude','🧠 Aptitude','showPlacementTab']].map(([id,label,fn]) =>
          `<button onclick="showPlacementTab('${id}',this)" class="ptab-btn" style="padding:8px 16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:8px;font-size:0.82rem;font-weight:600;color:var(--text-secondary);cursor:pointer;transition:all 0.3s;font-family:'Inter',sans-serif">${label}</button>`
        ).join('')}
      </div>
      <div id="placementContent">
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px">
          ${[{icon:'📄',title:'Resume Builder',desc:'ATS-optimized with AI feedback',color:'#2563EB'},{icon:'🤝',title:'Mock Interview',desc:'Company-specific AI practice',color:'#7C3AED'},{icon:'💻',title:'DSA Problems',desc:'1000+ coding problems',color:'#06B6D4'},{icon:'🧠',title:'Aptitude',desc:'Quant, Verbal, Logical',color:'#10B981'},{icon:'🏢',title:'Company Prep',desc:'Google, Amazon, TCS...',color:'#F59E0B'},{icon:'🗣️',title:'HR Questions',desc:'Common HR with AI answers',color:'#EF4444'}].map(i => `
            <div onclick="openPlacementFeature('${i.title}')" style="padding:20px;background:var(--bg-glass);border:1px solid var(--border);border-radius:12px;cursor:pointer;transition:all 0.3s;text-align:center" onmouseover="this.style.borderColor='${i.color}60';this.style.transform='translateY(-3px)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
              <div style="font-size:2rem;margin-bottom:8px">${i.icon}</div>
              <div style="font-family:'Space Grotesk',sans-serif;font-size:0.9rem;font-weight:700;margin-bottom:4px">${i.title}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${i.desc}</div>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:16px;padding:14px;background:linear-gradient(135deg,rgba(37,99,235,0.08),rgba(124,58,237,0.08));border:1px solid rgba(37,99,235,0.2);border-radius:12px">
          <div style="font-weight:700;margin-bottom:8px">📊 Placement Readiness</div>
          <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden;margin-bottom:6px"><div style="width:68%;height:100%;background:linear-gradient(90deg,var(--warning),var(--success));border-radius:4px"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-muted)"><span>68% Ready</span><span>Goal: 90%</span></div>
        </div>
      </div>
      <div id="placementOutput" style="display:none;margin-top:16px;max-height:400px;overflow-y:auto;padding:16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:12px;font-size:0.88rem;line-height:1.7"></div>
    </div>
  `;
}

async function openPlacementFeature(feature) {
  const output = document.getElementById('placementOutput');
  if (!output) return;
  output.style.display = 'block';
  output.innerHTML = `<div style="text-align:center;padding:16px">⏳ Loading ${feature}...</div>`;

  try {
    if (!SERVER_ONLINE) throw new Error('Backend not connected');

    if (feature === 'Mock Interview') {
      output.innerHTML = renderMockInterview();
      setTimeout(showMockInterviewQuestion, 0);
    } else if (feature === 'Resume Builder') {
      output.innerHTML = renderResumeBuilder();
    } else if (feature === 'DSA Problems') {
      output.innerHTML = renderDSAPractice();
      filterDSAProblems();
    } else if (feature === 'Aptitude') {
      output.innerHTML = renderAptitudePractice();
    } else {
      const prompt = `Generate ${feature} preparation content for engineering students. Include practice questions, tips, and strategies.`;
      const data = await api.call('/api/chat', 'POST', { message: prompt, subject: 'Placement Preparation' });
      output.innerHTML = formatMarkdown(data.response);
    }
    showToast(`✅ ${feature} loaded!`, 'success');
  } catch (err) {
    output.innerHTML = `<div style="color:var(--danger)">❌ ${err.message}</div>`;
  }
}

const dsaProblems = [
  ['Two Sum','Array','Easy','Find two indices whose values add to target.'],
  ['Valid Parentheses','Stack','Easy','Validate matching brackets using a stack.'],
  ['Reverse Linked List','Linked List','Easy','Reverse a singly linked list.'],
  ['Binary Search','Searching','Easy','Find a target in a sorted array.'],
  ['Longest Substring Without Repeating Characters','String','Medium','Sliding-window substring problem.'],
  ['Merge Intervals','Array','Medium','Merge overlapping time intervals.'],
  ['Number of Islands','Graph','Medium','Count islands using BFS or DFS.'],
  ['Lowest Common Ancestor','Tree','Medium','Find the common ancestor of two nodes.'],
  ['Coin Change','Dynamic Programming','Medium','Find the minimum coins for an amount.'],
  ['LRU Cache','Design','Hard','Design an O(1) least-recently-used cache.'],
  ['Trapping Rain Water','Two Pointers','Hard','Calculate water trapped between bars.'],
  ['Median of Two Sorted Arrays','Binary Search','Hard','Find median in logarithmic time.']
];

const mockInterviewQuestions = [
  'Tell me about yourself and why you are a good fit for this role.',
  'Describe a challenging project you worked on and the impact you made.',
  'Explain the difference between a process and a thread.',
  'How would you find a duplicate number in an array efficiently?',
  'Tell me about a time you received critical feedback. What did you do?',
  'How would you design a URL shortener at a high level?',
  'What are your strengths, and what skill are you currently improving?',
  'Why do you want to work for this company?'
];

// Curated placement-focused DSA bank across the most common interview patterns.
dsaProblems.push(
  ['Contains Duplicate','Array','Easy','Detect duplicate values in an array.'], ['Best Time to Buy and Sell Stock','Array','Easy','Maximize profit from one stock transaction.'],
  ['Product of Array Except Self','Array','Medium','Build products without division.'], ['Maximum Subarray','Array','Medium','Find the contiguous subarray with largest sum.'],
  ['3Sum','Two Pointers','Medium','Find unique triplets that sum to zero.'], ['Container With Most Water','Two Pointers','Medium','Maximize water held between two lines.'],
  ['Move Zeroes','Two Pointers','Easy','Move all zeroes to the end in place.'], ['Valid Palindrome','String','Easy','Check if text is a palindrome.'],
  ['Longest Palindromic Substring','String','Medium','Find the longest palindrome in a string.'], ['Group Anagrams','Hashing','Medium','Group strings with identical character counts.'],
  ['Minimum Window Substring','Sliding Window','Hard','Find the smallest substring containing target characters.'], ['Kth Largest Element','Heap','Medium','Find the kth largest value.'],
  ['Top K Frequent Elements','Heap','Medium','Return the k most frequent values.'], ['Merge Two Sorted Lists','Linked List','Easy','Merge two sorted linked lists.'],
  ['Linked List Cycle','Linked List','Easy','Detect a cycle with fast and slow pointers.'], ['Remove Nth Node From End','Linked List','Medium','Remove node using two pointers.'],
  ['Add Two Numbers','Linked List','Medium','Add numbers represented as linked lists.'], ['Min Stack','Stack','Medium','Design stack with constant-time minimum.'],
  ['Daily Temperatures','Monotonic Stack','Medium','Find days until a warmer temperature.'], ['Largest Rectangle in Histogram','Monotonic Stack','Hard','Find the largest rectangle area.'],
  ['Implement Queue Using Stacks','Queue','Easy','Build a queue using two stacks.'], ['Rotting Oranges','Queue','Medium','Use multi-source BFS on a grid.'],
  ['Invert Binary Tree','Tree','Easy','Swap left and right children recursively.'], ['Maximum Depth of Binary Tree','Tree','Easy','Find tree height.'],
  ['Validate Binary Search Tree','Tree','Medium','Check BST ordering constraints.'], ['Binary Tree Level Order Traversal','Tree','Medium','Traverse a tree level by level.'],
  ['Serialize and Deserialize Binary Tree','Tree','Hard','Encode and restore a binary tree.'], ['Course Schedule','Graph','Medium','Detect cycle in prerequisite graph.'],
  ['Clone Graph','Graph','Medium','Deep-copy a graph.'], ['Word Ladder','Graph','Hard','Find shortest transformation sequence.'],
  ['Flood Fill','Graph','Easy','Recolor connected grid cells.'], ['Find Peak Element','Binary Search','Medium','Find any peak in logarithmic time.'],
  ['Search in Rotated Sorted Array','Binary Search','Medium','Search a rotated sorted array.'], ['Find First and Last Position','Binary Search','Medium','Find target boundaries.'],
  ['House Robber','Dynamic Programming','Medium','Maximize non-adjacent house values.'], ['Longest Increasing Subsequence','Dynamic Programming','Medium','Find longest increasing subsequence.'],
  ['Longest Common Subsequence','Dynamic Programming','Medium','Find shared subsequence length.'], ['Edit Distance','Dynamic Programming','Hard','Minimum edits to transform strings.'],
  ['Unique Paths','Dynamic Programming','Medium','Count grid paths.'], ['Word Break','Dynamic Programming','Medium','Segment string using dictionary words.'],
  ['Subsets','Backtracking','Medium','Generate all subsets.'], ['Permutations','Backtracking','Medium','Generate all permutations.'],
  ['Combination Sum','Backtracking','Medium','Find combinations reaching target.'], ['N Queens','Backtracking','Hard','Place queens without attacks.'],
  ['Trie Implementation','Trie','Medium','Implement prefix tree operations.'], ['Merge K Sorted Lists','Divide and Conquer','Hard','Merge multiple sorted linked lists.'],
  ['Median Finder','Heap','Hard','Maintain running median.'], ['Disjoint Set Union','Graph','Medium','Implement union-find for connectivity.'],
  ['Shortest Path in Binary Matrix','Graph','Medium','Find shortest 8-direction grid path.'], ['Dijkstra Algorithm','Graph','Medium','Find shortest weighted paths.']
);

const aptitudeChapters = {
  'Percentages': [['A value rises from 200 to 250. What is the percentage increase?',['20%','25%','30%','50%'],1],['A discount of 15% on ₹800 gives what selling price?',['₹620','₹680','₹700','₹720'],1]],
  'Profit & Loss': [['Cost price is ₹500 and selling price is ₹575. Profit percentage?',['10%','12%','15%','20%'],2],['A 20% loss on ₹900 gives selling price?',['₹680','₹700','₹720','₹750'],2]],
  'Time & Work': [['A completes work in 10 days. One day work is?',['1/5','1/10','1/15','10'],1],['A and B complete work in 6 and 3 days. Together they take?',['1 day','2 days','3 days','4 days'],1]],
  'Time, Speed & Distance': [['A train travels 120 km in 2 hours. Speed?',['40 km/h','50 km/h','60 km/h','70 km/h'],2],['Speed of 54 km/h equals?',['10 m/s','12 m/s','15 m/s','18 m/s'],2]],
  'Ratio & Proportion': [['Ratio 2:3 has total 50. Smaller part?',['15','20','25','30'],1],['If 5 pens cost ₹60, 8 pens cost?',['₹84','₹90','₹96','₹100'],2]],
  'Number System': [['Smallest prime number?',['0','1','2','3'],2],['Remainder when 17 is divided by 5?',['1','2','3','4'],1]],
  'Logical Reasoning': [['All cats are animals. Some animals are pets. Which is certain?',['All cats are pets','Some cats are pets','Cats are animals','No cats are pets'],2],['Find next: 2, 6, 12, 20, ?',['25','28','30','32'],2]],
  'Verbal Ability': [['Choose the synonym of “brief”.',['Long','Short','Loud','Slow'],1],['Choose the correct sentence.',['She do work','She does work','She doing work','She done work'],1]]
};

Object.assign(aptitudeChapters, {
  'Average': [['The average of 10, 20, and 30 is?',['15','20','25','30'],1]],
  'Simple Interest': [['Simple interest on ₹1000 at 10% per year for 2 years is?',['₹100','₹150','₹200','₹250'],2]],
  'Compound Interest': [['Compound interest on ₹1000 at 10% for 2 years is?',['₹200','₹210','₹220','₹230'],1]],
  'Mixtures & Allegations': [['A 20 L mixture has milk and water in ratio 3:2. Milk is?',['8 L','10 L','12 L','15 L'],2]],
  'Partnership': [['A invests ₹10,000 and B ₹20,000 for equal time. Profit ratio is?',['1:1','1:2','2:1','1:3'],1]],
  'Ages': [['A father is 30 years older than his son. If son is 12, father is?',['32','36','40','42'],3]],
  'Pipes & Cisterns': [['A pipe fills a tank in 4 hours. It fills in one hour?',['1/2','1/3','1/4','1/5'],2]],
  'Boats & Streams': [['Boat speed in still water is 10 km/h and stream speed 2 km/h. Downstream speed?',['8','10','12','14'],2]],
  'Permutation & Combination': [['How many ways can 3 items be arranged?',['3','5','6','9'],2]],
  'Probability': [['Probability of getting a head on one fair coin toss?',['0','1/4','1/2','1'],2]],
  'Data Interpretation': [['Sales rise from 400 to 500. Increase is?',['20%','25%','30%','40%'],1]],
  'Algebra': [['If x + 5 = 12, x equals?',['5','7','12','17'],1]],
  'Geometry & Mensuration': [['Area of a square with side 6 cm is?',['12','24','30','36'],3]],
  'Clocks': [['At 3:00, the angle between clock hands is?',['0°','30°','60°','90°'],3]],
  'Calendars': [['How many days are there in a leap year?',['364','365','366','367'],2]],
  'Number Series': [['Find next: 3, 6, 12, 24, ?',['30','36','42','48'],3]],
  'Coding-Decoding': [['If CAT is coded as DBU, DOG is coded as?',['EPF','EOG','CPH','FPH'],0]],
  'Direction Sense': [['Face north, turn right, then right again. Now facing?',['North','South','East','West'],1]],
  'Blood Relations': [['Your mother’s brother is your?',['Cousin','Uncle','Nephew','Grandfather'],1]],
  'Syllogisms': [['All pens are blue. All blue things are useful. Therefore?',['All pens are useful','All useful things are pens','Some pens are not useful','No conclusion'],0]],
  'Seating Arrangement': [['In a row, A is left of B. B is left of C. Who is in the middle?',['A','B','C','Cannot say'],1]],
  'Analogy': [['Book : Read :: Food : ?',['Cook','Eat','Buy','Serve'],1]],
  'Classification': [['Choose the odd one out: Square, Triangle, Circle, Cube.',['Square','Triangle','Circle','Cube'],3]],
  'Grammar': [['Choose the correct form: “He ___ to school daily.”',['go','goes','going','gone'],1]],
  'Reading Comprehension': [['The main purpose of a passage is best found by identifying its?',['Longest word','Central idea','First sentence only','Author name'],1]],
  'Para Jumbles': [['What helps arrange jumbled sentences correctly?',['Random order','Logical flow and connectors','Alphabetical order','Longest sentence first'],1]]
});

function showPlacementTab(tab, button) {
  document.querySelectorAll('.ptab-btn').forEach(btn => { btn.style.background = 'var(--bg-glass)'; btn.style.color = 'var(--text-secondary)'; });
  if (button) { button.style.background = 'rgba(37,99,235,0.18)'; button.style.color = 'var(--primary-light)'; }
  const output = document.getElementById('placementOutput');
  if (!output) return;
  output.style.display = 'block';
  if (tab === 'resume') output.innerHTML = renderResumeBuilder();
  if (tab === 'interview') { output.innerHTML = renderMockInterview(); setTimeout(showMockInterviewQuestion, 0); }
  if (tab === 'coding') { output.innerHTML = renderDSAPractice(); filterDSAProblems(); }
  if (tab === 'aptitude') output.innerHTML = renderAptitudePractice();
}

function renderMockInterview() {
  state.mockInterviewCurrent = 0; state.mockInterviewAnswers = [];
  return `<h3>Mock Interview — Voice or Text</h3><p style="color:var(--text-muted);font-size:.82rem">Answer with your keyboard or microphone. The AI evaluates your answer and asks the next question.</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0"><input id="interviewCompany" value="Google" placeholder="Company"><input id="interviewRole" value="Software Engineer" placeholder="Role"></div>
  <div id="interviewQuestion" style="padding:14px;background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.3);border-radius:10px;margin:12px 0"></div>
  <textarea id="interviewAnswer" placeholder="Type your answer here, or use the microphone..." style="width:100%;min-height:100px;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-family:Inter;resize:vertical"></textarea>
  <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button onclick="startInterviewVoice()" class="ai-code-btn red">🎤 Speak answer</button><button onclick="submitInterviewAnswer()" class="ai-code-btn blue">✓ Submit Answer & Get Score</button><button onclick="speakInterviewQuestion()" class="ai-code-btn purple">🔊 Read question</button></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px"><button id="interviewPrev" onclick="changeInterviewQuestion(-1)" class="ai-code-btn blue">← Previous</button><span id="interviewCounter" style="font-size:.82rem;color:var(--text-muted)"></span><button id="interviewNext" onclick="changeInterviewQuestion(1)" class="ai-code-btn blue">Next →</button></div><div id="interviewFeedback" style="display:none;margin-top:12px;padding:14px;background:rgba(37,99,235,.06);border:1px solid rgba(37,99,235,.25);border-radius:10px"></div>`;
}

function showMockInterviewQuestion() {
  const question = document.getElementById('interviewQuestion'); const answer = document.getElementById('interviewAnswer');
  const index = state.mockInterviewCurrent; if (!question || !answer) return;
  question.innerHTML = `<b>Question ${index + 1}:</b> ${mockInterviewQuestions[index]}`;
  answer.value = state.mockInterviewAnswers[index] || '';
  const counter = document.getElementById('interviewCounter'); if (counter) counter.textContent = `${index + 1} of ${mockInterviewQuestions.length}`;
  const prev = document.getElementById('interviewPrev'); const next = document.getElementById('interviewNext');
  if (prev) prev.disabled = index === 0; if (next) next.disabled = index === mockInterviewQuestions.length - 1;
}

function changeInterviewQuestion(direction) {
  const answer = document.getElementById('interviewAnswer');
  if (answer) state.mockInterviewAnswers[state.mockInterviewCurrent] = answer.value;
  const target = state.mockInterviewCurrent + direction;
  if (target < 0 || target >= mockInterviewQuestions.length) return;
  state.mockInterviewCurrent = target; showMockInterviewQuestion();
  const feedback = document.getElementById('interviewFeedback'); if (feedback) { feedback.innerHTML = ''; feedback.style.display = 'none'; }
}

function startInterviewVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return showToast('Voice input needs Chrome or Edge and microphone permission.', 'warning');
  const recognition = new SR(); recognition.lang = 'en-IN'; recognition.interimResults = false;
  showToast('Listening… speak your interview answer.', 'info'); recognition.start();
  recognition.onresult = e => { const answer = document.getElementById('interviewAnswer'); if (answer) { answer.value = e.results[0][0].transcript; submitInterviewAnswer(); } };
  recognition.onerror = () => showToast('Could not hear your answer. Check microphone permission.', 'error');
}

function speakInterviewQuestion() { speakText(document.getElementById('interviewQuestion')?.textContent || '', true, true); }

async function submitInterviewAnswer() {
  const answer = document.getElementById('interviewAnswer')?.value.trim(); const feedback = document.getElementById('interviewFeedback');
  if (!answer) return showToast('Type or speak an answer first.', 'warning');
  state.mockInterviewAnswers[state.mockInterviewCurrent] = answer;
  if (!feedback) return; feedback.style.display = 'block'; feedback.innerHTML = '<b>Interview feedback</b><div style="margin-top:8px">⏳ Reviewing your answer…</div>';
  try {
    const company = document.getElementById('interviewCompany')?.value || 'a technology company'; const role = document.getElementById('interviewRole')?.value || 'Software Engineer';
    const currentQuestion = mockInterviewQuestions[state.mockInterviewCurrent];
    const data = await api.chat(`You are a ${company} interviewer hiring a ${role}. Evaluate the candidate's answer to this question: "${currentQuestion}". Candidate answer: "${answer}".

Return this exact structure in clear markdown:
## Score
Give a score out of 10 and one-sentence overall assessment.
## What was good
List specific strengths in the candidate's answer.
## What to improve
List each missing, unclear, or weak point.
## How to improve it
Give concrete wording, structure, or examples the candidate should add.
## Strong sample answer
Write a concise, interview-ready model answer to the original question.

Be constructive and specific. Do not ask another question because the user navigates with Next and Previous buttons.`, 'Mock Interview');
    feedback.innerHTML = formatMarkdown(data.response);
  } catch (err) { feedback.innerHTML = `<span style="color:var(--danger)">❌ ${err.message}</span>`; }
}

function renderDSAPractice() {
  state.dsaSelectedTopic = 'All Topics';
  const topics = ['All Topics', ...new Set(dsaProblems.map(problem => problem[1]))];
  return `<h3>DSA Problem Library</h3><p style="font-size:.82rem;color:var(--text-muted)">Select a topic to view its complete important-question list, then click a question for its full solution.</p><div id="dsaTopics" style="display:flex;gap:7px;flex-wrap:wrap;margin:10px 0">${topics.map(topic => `<button onclick="filterDSAProblems('${topic}')" class="ai-code-btn ${topic === 'All Topics' ? 'blue' : 'cyan'}" style="padding:7px 10px">${topic}</button>`).join('')}</div><div style="display:flex;gap:8px;margin:10px 0"><input id="dsaSearch" oninput="filterDSAProblems()" onkeydown="if(event.key==='Enter') openCustomDSAProblem()" placeholder="Search or type any DSA problem…" style="flex:1;padding:11px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary)"><select id="dsaLanguage" style="padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary)"><option value="Python">Python</option><option value="JavaScript">JavaScript</option><option value="Java">Java</option><option value="C++">C++</option></select><button onclick="openCustomDSAProblem()" class="ai-code-btn blue">Open problem</button></div><div id="dsaResults"></div><div id="dsaProblemDetail" style="display:none;margin-top:14px;padding:16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:12px;line-height:1.7"></div>`;
}

function filterDSAProblems(topic) {
  if (typeof topic === 'string') state.dsaSelectedTopic = topic;
  const query = (document.getElementById('dsaSearch')?.value || '').toLowerCase(); const results = document.getElementById('dsaResults'); if (!results) return;
  const found = dsaProblems.filter(p => (state.dsaSelectedTopic === 'All Topics' || p[1] === state.dsaSelectedTopic) && p.join(' ').toLowerCase().includes(query));
  document.querySelectorAll('#dsaTopics button').forEach(button => { button.style.opacity = button.textContent === state.dsaSelectedTopic ? '1' : '.65'; });
  results.innerHTML = `<div style="font-size:.8rem;color:var(--text-muted);margin:8px 0"><b>${state.dsaSelectedTopic}</b>: ${found.length} important problems — click any question for its complete explanation.</div>` + found.map(([name,topic,difficulty,desc]) => `<button onclick="openDSAProblem('${name}')" style="display:block;width:100%;padding:12px;margin:8px 0;border:1px solid var(--border);border-radius:9px;background:var(--bg-glass);color:var(--text-primary);text-align:left;cursor:pointer"><b>${name}</b> <span style="color:var(--primary-light);font-size:.78rem">${topic} · ${difficulty}</span><div style="font-size:.8rem;color:var(--text-muted);margin-top:4px">${desc}</div></button>`).join('');
}

async function openDSAProblem(problemName) {
  const detail = document.getElementById('dsaProblemDetail');
  if (!detail) return;
  const problem = dsaProblems.find(item => item[0] === problemName);
  const language = document.getElementById('dsaLanguage')?.value || 'Python';
  detail.style.display = 'block';
  detail.innerHTML = `<div style="text-align:center;padding:18px">⏳ Building a complete solution for <b>${problemName}</b>…</div>`;
  try {
    if (!SERVER_ONLINE) throw new Error('Backend not connected. Start the server and try again.');
    const context = problem ? `Topic: ${problem[1]}\nDifficulty: ${problem[2]}\nBrief: ${problem[3]}` : '';
    const data = await api.chat(`Create a complete DSA learning solution for the problem "${problemName}". ${context}

Use exactly these markdown sections:
# Problem Statement
# Explanation and Key Insight
# Example and Dry Run
# Brute Force Approach
Include algorithm steps, ${language} code, time complexity, and space complexity.
# Optimal Approach
Include algorithm steps, ${language} code, time complexity, and space complexity.
# Edge Cases
# Interview Tips
# Line-by-Line Code Explanation
Explain every important line or block of the optimal code in beginner-friendly language.

Be technically correct, concise, and make code runnable.`, 'DSA Practice');
    detail.innerHTML = formatMarkdown(data.response);
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    detail.innerHTML = `<div style="color:var(--danger)">❌ ${err.message}</div>`;
  }
}

function openCustomDSAProblem() {
  const name = document.getElementById('dsaSearch')?.value.trim();
  if (!name) return showToast('Type a DSA problem name first.', 'warning');
  openDSAProblem(name);
}

function renderAptitudePractice() {
  return `<h3>Aptitude Chapters</h3><p style="font-size:.82rem;color:var(--text-muted)">Choose any topic to open its important practice questions.</p><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:9px">${Object.entries(aptitudeChapters).map(([chapter,questions]) => `<button onclick="showAptitudeChapter('${chapter}')" class="ai-code-btn green" style="text-align:left">${chapter}<br><small>${questions.length} ${questions.length === 1 ? 'question' : 'questions'}</small></button>`).join('')}</div><div id="aptitudeQuestions" style="margin-top:14px"></div>`;
}

function showAptitudeChapter(chapter) {
  const target = document.getElementById('aptitudeQuestions'); const questions = aptitudeChapters[chapter]; if (!target || !questions) return;
  target.innerHTML = `<h4>${chapter} — Important Questions</h4>` + questions.map(([question,options,correct], index) => `<div style="padding:12px;border:1px solid var(--border);border-radius:9px;margin:9px 0"><b>${index + 1}. ${question}</b>${options.map((option,i) => `<button onclick="this.parentElement.querySelector('.apt-answer').style.display='block'" style="display:block;width:100%;text-align:left;margin-top:7px;padding:7px;background:var(--bg-glass);border:1px solid var(--border);border-radius:6px;color:var(--text-primary)">${String.fromCharCode(65+i)}. ${option}</button>`).join('')}<div class="apt-answer" style="display:none;color:var(--success);margin-top:8px">Correct answer: ${String.fromCharCode(65 + correct)}. ${options[correct]}</div></div>`).join('') + `<button onclick="generateMoreAptitudeQuestions('${chapter}')" class="ai-code-btn blue" style="margin-top:8px">Generate more ${chapter} questions</button><div id="moreAptitudeQuestions" style="margin-top:10px"></div>`;
}

async function generateMoreAptitudeQuestions(chapter) {
  const output = document.getElementById('moreAptitudeQuestions'); if (!output) return;
  output.innerHTML = '⏳ Creating more practice questions…';
  try {
    const data = await api.chat(`Create 10 important placement aptitude multiple-choice questions about ${chapter}. For each, include four options, the correct answer, and a one-line explanation. Use clear markdown.`, 'Aptitude Preparation');
    output.innerHTML = formatMarkdown(data.response);
  } catch (err) { output.innerHTML = `<span style="color:var(--danger)">❌ ${err.message}</span>`; }
}

function renderResumeBuilder() {
  return `
    <h3 style="margin-bottom:16px;font-family:'Space Grotesk',sans-serif">📄 Resume Builder</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label>Full Name</label><input type="text" id="resumeName" placeholder="Arjun Kumar" /></div>
      <div class="form-group"><label>Email</label><input type="email" id="resumeEmail" placeholder="arjun@email.com" /></div>
      <div class="form-group"><label>College</label><input type="text" id="resumeCollege" placeholder="IIT/NIT/VTU..." /></div>
      <div class="form-group"><label>Branch & Year</label><input type="text" id="resumeBranch" placeholder="CSE, 4th Year" /></div>
      <div class="form-group" style="grid-column:1/-1"><label>Technical Skills</label><input type="text" id="resumeSkills" placeholder="Python, Java, React, SQL, DSA, Machine Learning..." /></div>
      <div class="form-group" style="grid-column:1/-1"><label>Projects</label><textarea id="resumeProjects" style="width:100%;height:80px;padding:8px 12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-family:'Inter',sans-serif;resize:vertical;outline:none;font-size:0.85rem" placeholder="Project 1: E-commerce web app using React + Node.js..."></textarea></div>
    </div>
    <button onclick="buildResume()" style="margin-top:12px;padding:11px 24px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🚀 Generate AI Resume</button>
  `;
}

async function buildResume() {
  const output = document.getElementById('placementOutput');
  if (!output) return;
  output.innerHTML = '<div style="text-align:center;padding:16px">⏳ Building your ATS-optimized resume...</div>';
  try {
    const data = await api.generateResume({
      name: document.getElementById('resumeName')?.value,
      email: document.getElementById('resumeEmail')?.value,
      college: document.getElementById('resumeCollege')?.value,
      branch: document.getElementById('resumeBranch')?.value,
      skills: document.getElementById('resumeSkills')?.value,
      projects: document.getElementById('resumeProjects')?.value,
    });
    output.innerHTML = formatMarkdown(data.resume);
    showToast('✅ Resume generated!', 'success');
  } catch (err) {
    output.innerHTML = `<div style="color:var(--danger)">Error: ${err.message}</div>`;
  }
}

// ===================== VIDEO LEARNING =====================
function renderVideoLearning() {
  return `
    <button class="modal-close" onclick="closeModal('featureModal')">✕</button>
    <div class="feature-modal-header">
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:700">🎥 AI Video Learning</h2>
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">Paste YouTube link for AI study notes</p>
    </div>
    <div class="feature-modal-body">
      <div style="margin-bottom:14px">
        <input id="videoUrl" type="text" placeholder="Paste YouTube URL here..." style="width:100%;padding:11px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-family:'Inter',sans-serif;outline:none;font-size:0.9rem;margin-bottom:8px" />
        <input id="videoTopic" type="text" placeholder="Video title or topic (helps AI understand better)..." style="width:100%;padding:11px 14px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-family:'Inter',sans-serif;outline:none;font-size:0.9rem;margin-bottom:10px" />
        <button onclick="summarizeVideo()" style="width:100%;padding:13px;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">🤖 Analyze & Summarize</button>
      </div>
      <div id="videoOutput" style="display:none;max-height:400px;overflow-y:auto;padding:16px;background:var(--bg-glass);border:1px solid var(--border);border-radius:12px;line-height:1.7;font-size:0.88rem"></div>
    </div>
  `;
}

async function summarizeVideo() {
  const url = document.getElementById('videoUrl')?.value?.trim();
  const topic = document.getElementById('videoTopic')?.value?.trim();
  const output = document.getElementById('videoOutput');
  if (!output) return;
  if (!url && !topic) { showToast('Please enter a YouTube URL or topic', 'warning'); return; }
  output.style.display = 'block';
  output.innerHTML = '<div style="text-align:center;padding:20px">⏳ AI is analyzing the video content...</div>';
  try {
    if (!SERVER_ONLINE) throw new Error('Backend not connected');
    const data = await api.summarizeVideo(url, topic);
    output.innerHTML = formatMarkdown(data.summary);
    showToast('🎥 Video summarized!', 'success');
    updateXP(15);
  } catch (err) {
    output.innerHTML = `<div style="color:var(--danger)">❌ ${err.message}</div>`;
    showToast(err.message, 'error');
  }
}

// ===================== DASHBOARD =====================
const dashboardDefaults = {
  activity: { week: [2, 3.5, 1.5, 4, 3, 5, 2.5], month: [14, 18, 12, 20, 16, 22, 19, 25], year: [40, 35, 50, 45, 60, 55, 70, 65, 80, 75, 90, 85] },
  subjects: { 'Data Structures': 87, Algorithms: 72, DBMS: 91, 'Computer Networks': 65, 'Operating Systems': 58 }
};

function ensureDashboardData() {
  state.studyData.activity = { ...dashboardDefaults.activity, ...(state.studyData.activity || {}) };
  state.studyData.subjects = { ...dashboardDefaults.subjects, ...(state.studyData.subjects || {}) };
}

function saveDashboardData() { localStorage.setItem('studyData', JSON.stringify(state.studyData)); }

function getPerformanceInsight(action = 'overview') {
  ensureDashboardData();
  const data = state.studyData;
  const subjects = data.subjects;
  const weakest = Object.entries(subjects).sort((a, b) => a[1] - b[1])[0];
  const strongest = Object.entries(subjects).sort((a, b) => b[1] - a[1])[0];
  const weekly = data.activity.week.reduce((sum, hours) => sum + hours, 0);
  const messages = {
    overview: `You studied ${weekly.toFixed(1)} hours this week. ${weakest[0]} is your best opportunity at ${weakest[1]}%—a focused 30-minute session today will have the biggest impact.`,
    hours: `You have logged ${data.hours} total study hours and ${weekly.toFixed(1)} this week. Keep the next session short and focused on ${weakest[0]} to turn time into progress.`,
    xp: `Your ${data.xp.toLocaleString()} XP reflects completed learning activities. You are ${Math.max(0, 3000 - data.xp)} XP from the 3,000 XP milestone.`,
    rank: `You are ranked #${data.rank}. Improving ${weakest[0]} by 5% is the clearest path to gain ground on the leaderboard.`,
    streak: `Your ${data.streak}-day streak is strong. Complete one practice activity today to protect it and move toward the 30-day achievement.`,
    subject: `${strongest[0]} is your strongest subject at ${strongest[1]}%. Your next priority is ${weakest[0]} (${weakest[1]}%)—review its core topics, then take a short quiz.`
  };
  return messages[action] || messages.overview;
}

function setDashboardInsight(action = 'overview') {
  const text = document.getElementById('dashboardInsightText');
  const actionButton = document.getElementById('dashboardInsightAction');
  if (text) text.textContent = getPerformanceInsight(action);
  if (actionButton) {
    const weakSubject = Object.entries(state.studyData.subjects).sort((a, b) => a[1] - b[1])[0][0];
    actionButton.textContent = `Practice ${weakSubject}`;
    actionButton.onclick = () => openDashboardSubject(weakSubject);
  }
}

function openDashboardSubject(subject) {
  setDashboardInsight('subject');
  if (typeof showPlacementSubject === 'function') {
    navigateTo('placement-subjects');
    setTimeout(() => showPlacementSubject(subject), 50);
  }
}

function initDashboardInteractions() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard || dashboard.dataset.interactionsReady) return;
  dashboard.dataset.interactionsReady = 'true';
  dashboard.addEventListener('click', (event) => {
    const stat = event.target.closest('[data-dashboard-action]');
    if (stat) {
      const action = stat.dataset.dashboardAction;
      setDashboardInsight(action);
      showToast('Performance insight updated', 'info');
      return;
    }
    const subject = event.target.closest('.prog-item')?.querySelector('.prog-header span')?.textContent;
    if (subject) {
      setDashboardInsight('subject');
      showToast(`${subject}: ${state.studyData.subjects[subject]}% mastery. Click the action to practice it.`, 'info');
      return;
    }
    const eventTitle = event.target.closest('.event-item')?.querySelector('.ev-title')?.textContent;
    if (eventTitle) {
      setDashboardInsight('overview');
      showToast(`${eventTitle} selected — your study plan has been prioritized.`, 'info');
    }
  });
}

function updateDashboardData() {
  ensureDashboardData();
  const data = state.studyData;
  const xpEl = document.querySelector('.ds-value');
  if (xpEl) {
    // Update values
    const vals = document.querySelectorAll('.ds-value');
    if (vals[0]) vals[0].textContent = data.hours + 'h';
    if (vals[1]) vals[1].textContent = data.xp.toLocaleString();
    if (vals[2]) vals[2].textContent = '#' + data.rank;
    if (vals[3]) vals[3].textContent = data.streak;
  }
  document.querySelectorAll('.prog-item').forEach(item => {
    const name = item.querySelector('.prog-header span')?.textContent;
    const score = data.subjects[name];
    if (score == null) return;
    const pct = item.querySelector('.prog-pct');
    const fill = item.querySelector('.prog-fill');
    if (pct) pct.textContent = `${score}%`;
    if (fill) fill.style.width = `${score}%`;
  });
  setDashboardInsight('overview');
  initDashboardInteractions();
}

function updateXP(amount) {
  state.studyData.xp += amount;
  state.studyData.hours = Math.round(state.studyData.hours * 10) / 10;
  saveDashboardData();
  if (state.currentSection === 'dashboard') updateDashboardData();
}

function recordPerformanceActivity(subject, hours = 0.25, correct = true) {
  ensureDashboardData();
  const matchedSubject = Object.keys(state.studyData.subjects).find(name => subject?.toLowerCase().includes(name.toLowerCase())) || 'Algorithms';
  const dayIndex = (new Date().getDay() + 6) % 7; // Monday first
  state.studyData.activity.week[dayIndex] = Math.round((state.studyData.activity.week[dayIndex] + hours) * 10) / 10;
  state.studyData.hours = Math.round((state.studyData.hours + hours) * 10) / 10;
  if (correct) state.studyData.subjects[matchedSubject] = Math.min(100, state.studyData.subjects[matchedSubject] + 1);
  state.studyData.rank = Math.max(1, 47 - Math.floor((state.studyData.xp - 2840) / 100));
  saveDashboardData();
  if (state.currentSection === 'dashboard') {
    updateDashboardData();
    initActivityChart();
  }
}

// ===================== ACTIVITY CHART =====================
function initActivityChart() {
  const canvas = document.getElementById('activityCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.offsetWidth || 600;
  const h = canvas.offsetHeight || 220;
  canvas.width = w; canvas.height = h;
  ensureDashboardData();
  const data = state.studyData.activity.week;
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  drawBarChart(ctx, w, h, data, labels);
  window.chartCtx = ctx; window.chartW = w; window.chartH = h;
}

function drawBarChart(ctx, w, h, data, labels) {
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...data);
  const pad = { top: 20, right: 20, bottom: 40, left: 45 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;
  const bw = (cw / data.length) * 0.5;
  const gap = cw / data.length;

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (ch / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.5)'; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(((max * (1 - i / 4)).toFixed(0)) + 'h', pad.left - 5, y + 4);
  }

  // Bars
  data.forEach((val, i) => {
    const bh = (val / max) * ch;
    const x = pad.left + gap * i + (gap - bw) / 2;
    const y = pad.top + ch - bh;
    const grad = ctx.createLinearGradient(0, y, 0, y + bh);
    grad.addColorStop(0, '#3b82f6'); grad.addColorStop(1, 'rgba(37,99,235,0.2)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, [4, 4, 0, 0]); ctx.fill();
    ctx.fillStyle = 'rgba(148,163,184,0.8)'; ctx.font = '11px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + bw / 2, h - 10);
    if (bh > 18) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 10px Inter,sans-serif'; ctx.fillText(val + 'h', x + bw / 2, y - 5); }
  });
}

function switchChart(period) {
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('active'));
  event?.target?.classList.add('active');
  ensureDashboardData();
  const datasets = {
    week: { data: state.studyData.activity.week, labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    month: { data: state.studyData.activity.month, labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'] },
    year: { data: state.studyData.activity.year, labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] },
  };
  const canvas = document.getElementById('activityCanvas');
  if (canvas && window.chartCtx) drawBarChart(window.chartCtx, window.chartW, window.chartH, datasets[period].data, datasets[period].labels);
}

// ===================== PRICING =====================
function toggleBilling() {
  state.billingYearly = !state.billingYearly;
  document.querySelectorAll('.amount').forEach(el => {
    el.textContent = state.billingYearly ? el.dataset.yearly : el.dataset.monthly;
  });
  showToast(state.billingYearly ? '🎉 Yearly plan: Save 40%!' : 'Switched to monthly', 'info');
}

function contactEnterprise() { showToast('📧 Our team will contact you shortly!', 'info'); }

// ===================== TOAST =====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 3500);
}

// ===================== KEYBOARD SHORTCUTS =====================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault(); navigateTo('ai-tutor'); setTimeout(() => document.getElementById('chatInput')?.focus(), 300);
  }
});

// ===================== INIT =====================
window.addEventListener('load', initLoading);
