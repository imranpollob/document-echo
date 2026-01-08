"use client";

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AudioEngine } from '../components/AudioEngine';
import { useAudioStore } from '../store/useAudioStore';

const PdfViewer = dynamic(() => import('../components/PdfViewer').then(mod => mod.PdfViewer), {
  ssr: false,
});

// Voice selection is handled in the persistent AudioBar component.

export default function Home() {
  const file = useAudioStore(state => state.file);
  const setFile = useAudioStore(state => state.setFile);
  const [pdfMaxWidth, setPdfMaxWidth] = useState<number>(1024);
  const setApiKey = useAudioStore(state => state.setApiKey);
  const apiKey = useAudioStore(state => state.apiKey);
  const play = useAudioStore(state => state.play);
  const pause = useAudioStore(state => state.pause);
  const resume = useAudioStore(state => state.resume);
  const playbackStatus = useAudioStore(state => state.playbackStatus);
  const useBrowserTTSForIndex = useAudioStore(state => state.useBrowserTTSForIndex);

  // Removed auto-load of default PDF; user must choose a file.

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

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

  const handlePlayPause = () => {
    if (playbackStatus === 'playing') {
      pause();
    } else if (playbackStatus === 'paused') {
      resume();
    } else {
      play();
    }
  };

  return (
    <main className="flex flex-col items-center">
      {apiKey && useBrowserTTSForIndex !== null && (
        <div className="mt-2 w-full max-w-2xl text-sm text-yellow-800 bg-yellow-100 border border-yellow-200 p-2 rounded">
          API request failed for the selected voice; continuing with local (browser) TTS for this segment.
        </div>
      )}

      <div className={`the-pdf-viewer w-full ${!file ? 'centered' : ''}`} style={{ maxWidth: `${pdfMaxWidth}px` }}>
        {!file ? (
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
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div className="text-lg font-semibold">Choose file or drag and drop a PDF here</div>
            <div className="text-sm drop-muted">Click to browse or drop a PDF file</div>
            <button
              className="drop-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDropAreaClick();
              }}
            >
              Choose File
            </button>
          </div>
        ) : (
          <>
            <PdfViewer file={file} />
            <div className="resizer" role="separator" aria-orientation="vertical" />
          </>
        )}
      </div>

      <AudioEngine />
    </main>
  );
}
