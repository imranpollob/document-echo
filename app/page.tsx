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
  const [file, setFile] = useState<File | null>(null);
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
    <main className="flex min-h-screen flex-col items-center p-8 gap-8">
      {apiKey && useBrowserTTSForIndex !== null && (
        <div className="mt-2 w-full max-w-2xl text-sm text-yellow-800 bg-yellow-100 border border-yellow-200 p-2 rounded">
          API request failed for the selected voice; continuing with local (browser) TTS for this segment.
        </div>
      )}

      <div className="the-pdf-viewer w-full max-w-4xl">
        {!file ? (
          <div
            className={`border border-dashed rounded p-12 flex flex-col items-center justify-center gap-4 bg-white ${dragActive ? 'ring-2 ring-offset-2 ring-blue-300' : ''}`}
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
            <div className="text-sm text-gray-600">Click to browse or drop a PDF file</div>
            <button
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
              onClick={(e) => {
                e.stopPropagation();
                handleDropAreaClick();
              }}
            >
              Choose File
            </button>
          </div>
        ) : (
          <PdfViewer file={file} />
        )}
      </div>

      <AudioEngine />
    </main>
  );
}
