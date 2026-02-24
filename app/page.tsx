"use client";

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AudioEngine } from '../components/AudioEngine';
import { TextViewer } from '../components/TextViewer';
import { useAudioStore } from '../store/use-audio-store';
import { normalizeRawText } from '../lib/text-normalizer';

const PdfViewer = dynamic(() => import('../components/PdfViewer').then(mod => mod.PdfViewer), {
  ssr: false,
});

export default function Home() {
  const file = useAudioStore(state => state.file);
  const setFile = useAudioStore(state => state.setFile);
  const loadSegments = useAudioStore(state => state.loadSegments);
  const segments = useAudioStore(state => state.segments);
  const [pdfMaxWidth, setPdfMaxWidth] = useState<number>(1024);

  const TEXT_CACHE_KEY = 'document-echo-text-input';

  const [textInput, setTextInput] = useState('');
  const [textLoaded, setTextLoaded] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem(TEXT_CACHE_KEY);
    if (cached) setTextInput(cached);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setTextLoaded(false);
    }
  };

  const handleTextLoad = () => {
    if (!textInput.trim()) return;
    const segments = normalizeRawText(textInput);
    loadSegments(segments);
    setTextLoaded(true);
    setFile(null); // clear any PDF
  };

  const handleTextEdit = () => {
    setTextLoaded(false);
    loadSegments([]);
  };

  const handleTextClear = () => {
    setTextInput('');
    localStorage.removeItem(TEXT_CACHE_KEY);
  };

  // Reset to home when NavBar home button clears both file and segments
  useEffect(() => {
    if (!file && segments.length === 0) {
      setTextLoaded(false);
    }
  }, [file, segments]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDropAreaClick = () => {
    fileInputRef.current?.click();
  };

  // Resizer logic for adjusting PDF max width
  useEffect(() => {
    let startX = 0;
    let startWidth = 0;
    let resizing = false;

    const onPointerMove = (e: PointerEvent) => {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const next = Math.max(480, Math.min(1600, startWidth + dx));
      setPdfMaxWidth(next);
    };
    const onPointerUp = () => { resizing = false; document.removeEventListener('pointermove', onPointerMove); document.removeEventListener('pointerup', onPointerUp); };

    const el = document.querySelector('.the-pdf-viewer .resizer');
    if (!el) return;
    const onPointerDown = (ev: PointerEvent) => {
      resizing = true;
      startX = ev.clientX;
      startWidth = (document.querySelector('.the-pdf-viewer') as HTMLElement)?.clientWidth || pdfMaxWidth;
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    };
    el.addEventListener('pointerdown', onPointerDown as any);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown as any);
    };
  }, [pdfMaxWidth]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setTextLoaded(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const showEmptyState = !file && !textLoaded;

  return (
    <main className="flex flex-col items-center">
      <div className={`the-pdf-viewer w-full ${showEmptyState ? 'centered' : ''}`} style={{ maxWidth: `${pdfMaxWidth}px` }}>
        {showEmptyState ? (
          <div className="input-container">
            <section className="hero-copy" aria-label="Document Echo overview">
              <h1 className="hero-title">Document Echo</h1>
              <p className="hero-subtitle">
                Upload a PDF or paste text, then click any sentence to hear natural speech with synced highlighting.
              </p>
            </section>

            <div className="input-grid" aria-label="Input options">
              <div
                className={`drop-area ${dragActive ? 'drag-active' : ''}`}
                onClick={handleDropAreaClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                role="button"
                tabIndex={0}
              >
                <div className="input-section-label">PDF Upload</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <div className="text-lg font-semibold">Drag and drop a PDF here</div>
                <div className="text-sm drop-muted">Or click to browse from your device</div>
                <button
                  className="drop-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDropAreaClick();
                  }}
                >
                  Upload PDF
                </button>
              </div>

              <div className="text-input-area">
                <div className="input-section-label">Paste Text</div>
                <textarea
                  className="text-input-textarea"
                  placeholder="Paste or type your text here…"
                  value={textInput}
                  onChange={(e) => {
                    setTextInput(e.target.value);
                    localStorage.setItem(TEXT_CACHE_KEY, e.target.value);
                  }}
                  rows={12}
                />
                <div className="text-input-actions">
                  <button
                    className="drop-btn text-load-btn"
                    onClick={handleTextLoad}
                    disabled={!textInput.trim()}
                  >
                    Read Text
                  </button>
                  <button
                    className="drop-btn text-clear-btn"
                    onClick={handleTextClear}
                    disabled={!textInput.trim()}
                  >
                    Clear Text
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : file ? (
          <>
            <PdfViewer file={file} />
            <div className="resizer" role="separator" aria-orientation="vertical" />
          </>
        ) : (
          <div className="text-viewer-wrapper">
            <div className="text-viewer-toolbar">
              <button className="drop-btn" onClick={handleTextEdit}>
                ✏️ Back to Editor
              </button>
            </div>
            <TextViewer />
          </div>
        )}
      </div>

      <AudioEngine />
    </main>
  );
}
