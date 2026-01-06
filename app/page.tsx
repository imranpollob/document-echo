'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AudioEngine } from '../components/AudioEngine';
import { useAudioStore } from '../store/useAudioStore';

const PdfViewer = dynamic(() => import('../components/PdfViewer').then(mod => mod.PdfViewer), {
  ssr: false,
});

const VoiceSelector = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const selectedVoice = useAudioStore(state => state.selectedVoice);
  const setSelectedVoice = useAudioStore(state => state.setSelectedVoice);

  useEffect(() => {
    const loadVoices = () => {
      const vs = window.speechSynthesis.getVoices();
      setVoices(vs);
      // Default to first English voice if none selected
      if (!selectedVoice && vs.length > 0) {
        const enVoice = vs.find(v => v.lang.startsWith('en'));
        if (enVoice) setSelectedVoice(enVoice.voiceURI);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [selectedVoice, setSelectedVoice]);

  if (voices.length === 0) return null;

  return (
    <select
      className="border p-2 rounded w-full bg-white"
      value={selectedVoice || ''}
      onChange={(e) => setSelectedVoice(e.target.value)}
    >
      <option value="">Default Browser Voice</option>
      {voices.map(v => (
        <option key={v.voiceURI} value={v.voiceURI}>
          {v.name} ({v.lang})
        </option>
      ))}
    </select>
  );
}

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
      <div className="flex flex-col gap-4 w-full max-w-2xl">
        <div className="flex gap-4 w-full">
          <input
            type="text"
            placeholder="OpenAI API Key (Optional)"
            className="border p-2 rounded grow"
            onChange={(e) => setApiKey(e.target.value)}
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
          />
        </div>
        <VoiceSelector />
      </div>

      <div className="flex gap-4">
        <button
          onClick={handlePlayPause}
          disabled={!file}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 min-w-[100px]"
        >
          {playbackStatus === 'playing' ? 'Pause' : playbackStatus === 'loading' ? 'Loading...' : 'Play'}
        </button>
        <div className="text-sm self-center">Status: {playbackStatus}</div>
      </div>

      {apiKey && useBrowserTTSForIndex !== null && (
        <div className="mt-2 w-full max-w-2xl text-sm text-yellow-800 bg-yellow-100 border border-yellow-200 p-2 rounded">
          API request failed for the selected voice; continuing with local (browser) TTS for this segment.
        </div>
      )}

      <div className="">
        {file && <PdfViewer file={file} />}
      </div>

      <AudioEngine />
    </main>
  );
}
