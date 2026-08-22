# 🎓 EduVerse AI — The Ultimate AI Study Assistant for Engineering Students

<div align="center">

![EduVerse AI](https://img.shields.io/badge/EduVerse-AI-2563EB?style=for-the-badge&logo=graduation-cap&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![Groq AI](https://img.shields.io/badge/Groq-AI-F55036?style=for-the-badge&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)

**Study Smarter. Score Higher. Build Your Career with AI.**

[🌐 Live Demo](https://edu-verse-ai-nqng.vercel.app) · [🐛 Report Bug](https://github.com/princekumarjha83-oss/EduVerseAI/issues) · [✨ Request Feature](https://github.com/princekumarjha83-oss/EduVerseAI/issues)

</div>

---

## 📋 Table of Contents

- [About the Project](#-about-the-project)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Endpoints](#-api-endpoints)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [Author](#-author)

---

## 🚀 About the Project

**EduVerse AI** is a premium, full-stack AI-powered study platform built specifically for engineering students. It combines cutting-edge AI with a beautiful glassmorphism UI to deliver an all-in-one academic assistant — from generating study notes and quizzes to coding practice and placement preparation.

The platform uses **Groq AI** (with a 5-model fallback chain for maximum uptime and no rate limits) to power all features, giving students access to unlimited AI-generated learning content 24/7.

> Built as a **SaaS-level product** — not a typical student project. Every feature is production-ready, fully functional, and deployed on a real cloud stack.

### 🎯 Who Is This For?

- Engineering students preparing for **semester exams**
- Students preparing for **campus placements** (TCS, Infosys, Google, Amazon, etc.)
- Anyone who wants **AI-powered learning** without paying for expensive subscriptions

---

## ✨ Features

### 🤖 AI Tutor (PRINCE)
- Real-time AI chat for any engineering subject
- Context-aware conversations with history
- Upload PDF/DOCX and chat about your study material
- Subject-specific responses (DSA, DBMS, Networks, OOP, etc.)
- Quick prompt shortcuts for instant help

### 📝 Smart Notes Generator
- Generate comprehensive revision notes from any topic
- Upload PDF/slides and get AI-generated summary notes
- Multiple formats: Revision, Detailed, Bullet Points
- Export and download notes

### 🧠 Quiz Generator
- Unlimited AI-generated MCQ quizzes
- Adjustable difficulty: Easy / Medium / Hard
- Instant feedback with explanations after each answer
- Never repeats questions across sessions

### 🃏 Flashcard System
- AI-generated spaced-repetition flashcards
- Flip animation with front/back content
- Custom topic and count selection

### 🗺️ Mind Map Generator
- Visual, interactive mind maps rendered on HTML5 Canvas
- AI generates hierarchical topic structure
- Color-coded branches for easy understanding
- Download as PNG

### 🎙️ Viva Preparation
- AI-generated viva Q&A with model answers
- Subject and topic-specific practice
- Unlimited new question batches
- Interview tips per answer

### 📅 Semester Planner
- Personalized study schedule generator
- Input: university, semester, subjects, exam dates, daily hours
- AI creates a complete day-wise study plan

### 💻 Coding Lab
- Multi-language code editor (Python, Java, C++, JavaScript, and more)
- Run code with AI-simulated output
- AI Code Review, Explanation, Optimization, Bug Fixer, Generator
- Syntax highlighting support

### 🏆 Placement Subject Mastery
9 core placement subjects with full content for each:
- **Data Structures, Algorithms, DBMS, OS, Computer Networks, OOP, System Design, Software Engineering, Aptitude**
- 📚 Chapter-wise breakdown
- 🎯 Top interview questions
- 💡 Pro tips from experts
- 🤖 Unlimited AI Q&A batches (never repeats)
- 📝 Interactive 10-question MCQ quiz with scoring
- 📖 AI-generated study notes

### 🏢 Placement Hub
- **Resume Builder** — ATS-optimized resume generator
- **Mock Interview** — Company-specific AI interview simulation
- **DSA Practice** — 100+ curated coding problems with filters
- **Aptitude Practice** — Quantitative, Verbal, Logical sections
- **Company Prep** — Google, Amazon, TCS, Infosys specific prep
- **HR Questions** — Common HR Q&A with AI-powered answers

### 📄 PDF Analyzer
- Upload any PDF (textbook, notes, question paper)
- Instantly generate: Notes, Flashcards, Quiz, Mind Map, Viva questions

### 🔐 Authentication
- Google OAuth 2.0 sign-in
- Email/password account creation
- **Guest Mode** — full access with no account required

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| Vanilla JavaScript (ES6+) | Core application logic |
| HTML5 Canvas | Mind map rendering |
| CSS3 (Glassmorphism) | Premium UI design |
| CSS Variables & Animations | Dark/Light theme, smooth transitions |

### Backend
| Technology | Purpose |
|-----------|---------|
| Node.js | Runtime environment |
| Express.js | REST API server |
| Groq SDK | AI model integration |
| Multer | File upload handling |
| PDF-Parse | PDF text extraction |
| Mammoth | DOCX file parsing |
| dotenv | Environment configuration |

### AI Models — Multi-Model Fallback Chain
| Priority | Model | Daily Limit |
|---------|-------|------------|
| 1st | `llama-3.1-8b-instant` | 500K tokens |
| 2nd | `llama3-8b-8192` | 500K tokens |
| 3rd | `gemma2-9b-it` | 500K tokens |
| 4th | `llama-3.3-70b-versatile` | 100K tokens |
| 5th | `mixtral-8x7b-32768` | 500K tokens |

> When one model hits its rate limit, the system **automatically switches** to the next — ~2 million tokens/day combined with zero downtime.

### Deployment
| Service | Purpose |
|--------|---------|
| **Vercel** | Frontend hosting |
| **Render** | Backend API hosting |
| **GitHub** | Source control + CI/CD |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              FRONTEND (Vercel)                   │
│     https://edu-verse-ai-nqng.vercel.app        │
│                                                 │
│   index.html  ←→  app.js  ←→  styles.css       │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS API calls
┌──────────────────────▼──────────────────────────┐
│              BACKEND (Render)                    │
│      https://eduverseai-1.onrender.com          │
│                                                 │
│   Express.js REST API                           │
│   ├── /api/chat, /api/notes, /api/quiz          │
│   ├── /api/flashcards, /api/mindmap, /api/viva  │
│   ├── /api/code/* (run/review/explain/fix)      │
│   ├── /api/planner, /api/resume, /api/interview │
│   ├── /api/upload, /api/translate               │
│   └── /api/auth/* (Google OAuth + JWT)          │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│               GROQ AI API                        │
│        Multi-model fallback chain                │
│  llama-3.1-8b → llama3-8b → gemma2 → mixtral   │
└─────────────────────────────────────────────────┘
```

---

## 🏁 Getting Started

### Prerequisites

- **Node.js** v18+ → [Download](https://nodejs.org)
- **Groq API Key** (free) → [Get it here](https://console.groq.com)
- **Google OAuth Credentials** (optional) → [Google Cloud Console](https://console.cloud.google.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/princekumarjha83-oss/EduVerseAI.git
   cd EduVerseAI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3001
   ```

---

## 🔐 Environment Variables

```env
# GROQ AI (Required)
GROQ_API_KEY=your_groq_api_key_here

# GOOGLE OAUTH (Optional - for Google Sign-In)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# APP URLS
FRONTEND_URL=http://localhost:3001
PORT=3001
```

---

## 📡 API Endpoints

### Health
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/health` | Server status check |

### Authentication
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login with email/password |
| GET | `/api/auth/me` | Get current session user |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/google` | Start Google OAuth |
| GET | `/api/auth/google/callback` | Google OAuth callback |

### AI Features
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/chat` | AI tutor conversation |
| POST | `/api/notes` | Generate study notes |
| POST | `/api/quiz` | Generate MCQ quiz |
| POST | `/api/flashcards` | Generate flashcards |
| POST | `/api/mindmap` | Generate mind map |
| POST | `/api/viva` | Generate viva questions |
| POST | `/api/planner` | Generate semester plan |
| POST | `/api/translate` | Translate content |
| POST | `/api/resume` | Build resume |
| POST | `/api/interview` | Mock interview questions |

### Coding Lab
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/code/run` | Execute code |
| POST | `/api/code/review` | Code review |
| POST | `/api/code/explain` | Code explanation |
| POST | `/api/code/optimize` | Code optimization |
| POST | `/api/code/fix` | Bug fixing |
| POST | `/api/code/generate` | Generate code |

### Files
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/upload` | Upload PDF/DOCX |
| POST | `/api/analyze-image` | Analyze image |

---

## 🚀 Deployment

### Frontend → Vercel
1. Fork this repo
2. Import on [vercel.com](https://vercel.com) → New Project
3. No build config needed (static files)
4. Deploy ✅

### Backend → Render
1. New Web Service on [render.com](https://render.com)
2. Connect GitHub repo
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Add all environment variables
6. Deploy ✅

### Google OAuth (for Sign-In)
1. [Google Cloud Console](https://console.cloud.google.com) → Credentials
2. Create OAuth 2.0 Client ID (Web app)
3. Add Authorized redirect URI:
   ```
   https://your-render-app.onrender.com/api/auth/google/callback
   ```
4. Add Client ID + Secret to Render environment variables

---

## 📁 Project Structure

```
EduVerseAI/
├── index.html       # SPA shell — all UI sections
├── styles.css       # Complete design system & animations
├── app.js           # Frontend logic (~3200 lines)
├── server.js        # Express backend & AI routes (~1100 lines)
├── package.json     # Dependencies
├── .env             # Local secrets (not committed)
├── .env.example     # Template for environment variables
├── .gitignore       # Git ignore rules
└── data/
    └── users.json   # User storage (dev only)
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/YourFeature`
3. Commit changes: `git commit -m "Add: Your Feature"`
4. Push to branch: `git push origin feature/YourFeature`
5. Open a Pull Request

---

## 📊 Limits & Performance

| Item | Limit |
|------|-------|
| File Upload | 25 MB max |
| AI Tokens per Request | 2,048 |
| Daily AI Token Budget | ~2,000,000 (5 models combined) |
| Supported Files | PDF, DOCX, PPTX, JPG, PNG, TXT |
| Code Languages | Python, Java, C++, C, JavaScript, Go, Rust, PHP |

---

## 🛡️ Security

- Environment variables never committed to GitHub
- Google OAuth via official Passport.js strategy
- File uploads validated by MIME type
- Uploaded files auto-deleted after 60 seconds
- CORS configured for known domains only

---

## 📄 License

MIT License — free to use, modify, and distribute with attribution.

---

## 👨‍💻 Author

**Prince Kumar Jha**

- GitHub: [@princekumarjha83-oss](https://github.com/princekumarjha83-oss)
- Live App: [edu-verse-ai-nqng.vercel.app](https://edu-verse-ai-nqng.vercel.app)

---

## 🙏 Acknowledgements

- [Groq](https://groq.com) — Lightning-fast AI inference
- [Vercel](https://vercel.com) — Frontend hosting
- [Render](https://render.com) — Backend hosting
- [Meta LLaMA](https://llama.meta.com) — Open-source AI models
- [Google Fonts](https://fonts.google.com) — Space Grotesk & Inter

---

<div align="center">

⭐ **Star this repo if it helped you!** ⭐

Made with ❤️ by Prince Kumar Jha

</div>
