# Document Echo 📄🔊

A PDF and text reader with text-to-speech capabilities. Upload PDFs or paste text, click sentences, and listen with synchronized highlighting.

## ✨ Features

- **📖 PDF Rendering** — drag & drop upload with zoom controls
- **📝 Text Mode** — paste plain text and read it aloud
- **🤖 Kokoro TTS** — local, high-quality neural TTS via a Python backend (50 voices)
- **🔊 Browser TTS** — zero-setup fallback using the Web Speech API
- **🎯 Interactive Highlighting** — click any sentence to jump to it
- **💾 Smart Caching** — IndexedDB stores generated audio for instant replay
- **⚡ Prefetching** — next 2 sentences fetched in the background for seamless playback
- **🎨 Dark/Light Theme** with smooth transitions
- **📱 Mobile Responsive** — works on phones and tablets

## 🚀 Quick Start

### 1. Frontend

```bash
git clone <repository-url>
cd document-echo
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app works immediately with browser TTS — no server needed.

### 2. Kokoro TTS Server (optional, recommended)

Requires Python 3.10+ and [uv](https://docs.astral.sh/uv/getting-started/installation/).

```bash
cd server

# Install dependencies
uv sync

# Download model files (~335 MB total)
curl -L -o kokoro-v1.0.onnx https://github.com/nazdridoy/kokoro-tts/releases/download/v1.0.0/kokoro-v1.0.onnx
curl -L -o voices-v1.0.bin  https://github.com/nazdridoy/kokoro-tts/releases/download/v1.0.0/voices-v1.0.bin

# Start the server
uv run python main.py
```

The server runs at `http://localhost:8880`. In the app, open the voice popover and switch to the **🤖 Kokoro** tab to pick a voice.

## 📖 Usage

1. **PDF mode** — drag & drop a PDF onto the upload area
2. **Text mode** — click the ✏️ tab, paste text, press **🔊 Read Aloud**
3. Click any sentence to start playback from that point
4. Use the audio bar: ▶ Play/Pause, ◀ Previous, ▶ Next sentence
5. Open the 💬 voice popover to switch between Browser and Kokoro voices

## 🏗️ Tech Stack

| Layer       | Technology                        |
| ----------- | --------------------------------- |
| Framework   | Next.js 16 (Turbopack), React 19  |
| Styling     | Tailwind CSS v4                   |
| State       | Zustand 5                         |
| PDF         | PDF.js 5                          |
| Caching     | IndexedDB (idb-keyval)            |
| Local TTS   | kokoro-onnx 0.5, FastAPI, uvicorn |
| Browser TTS | Web Speech API                    |
| Language    | TypeScript / Python 3.10+         |

## 🛠️ Project Structure

```
├── app/              # Next.js app router (layout, page, globals.css)
├── components/       # React components (AudioEngine, NavBar, PdfViewer, TextViewer)
├── store/            # Zustand store (audio state, TTS logic, prefetch)
├── lib/              # Text normalizer (PDF + plain text → segments)
├── types/            # Shared TypeScript types
└── server/           # Python FastAPI Kokoro TTS backend
    ├── main.py
    └── pyproject.toml
```

