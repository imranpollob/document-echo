"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useAudioStore } from '../store/use-audio-store';

export default function NavBar() {
  const playbackStatus = useAudioStore(s => s.playbackStatus);
  const play = useAudioStore(s => s.play);
  const pause = useAudioStore(s => s.pause);
  const resume = useAudioStore(s => s.resume);
  const next = useAudioStore(s => s.next);
  const prev = useAudioStore(s => s.playSegment);
  const currentSegmentIndex = useAudioStore(s => s.currentSegmentIndex);
  const selectedVoice = useAudioStore(s => s.selectedVoice);
  const setSelectedVoice = useAudioStore(s => s.setSelectedVoice);
  const setFile = useAudioStore(s => s.setFile);

  // TTS engine state
  const ttsEngine = useAudioStore(s => s.ttsEngine);
  const setTtsEngine = useAudioStore(s => s.setTtsEngine);
  const kokoroVoice = useAudioStore(s => s.kokoroVoice);
  const setKokoroVoice = useAudioStore(s => s.setKokoroVoice);
  const kokoroServerUrl = useAudioStore(s => s.kokoroServerUrl);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [kokoroVoices, setKokoroVoices] = useState<string[]>([]);
  const [kokoroLoading, setKokoroLoading] = useState(false);
  const [open, setOpen] = useState(false);
  // 'browser' | 'kokoro' — which tab is active inside the popover
  const [voiceTab, setVoiceTab] = useState<'browser' | 'kokoro'>(ttsEngine);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const [popPos, setPopPos] = useState<{ x: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load browser voices
  useEffect(() => {
    const load = () => {
      if (typeof window === 'undefined') return;
      const vs = window.speechSynthesis.getVoices();
      setVoices(vs);
      if (!selectedVoice && vs.length > 0) {
        const en = vs.find(v => v.lang.startsWith('en'));
        if (en) setSelectedVoice(en.voiceURI);
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [selectedVoice, setSelectedVoice]);

  // Fetch kokoro voices whenever the popover opens
  useEffect(() => {
    if (!open) return;
    setKokoroLoading(true);
    fetch(`${kokoroServerUrl}/voices`)
      .then(r => r.json())
      .then(data => setKokoroVoices(data.voices ?? []))
      .catch(() => setKokoroVoices([]))
      .finally(() => setKokoroLoading(false));
  }, [open, kokoroServerUrl]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('theme');
    const initial = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', next);
      document.documentElement.setAttribute('data-theme', next);
    }
  };

  // Voice label display
  const voiceLabel = mounted ? (() => {
    if (ttsEngine === 'kokoro') {
      return kokoroVoice ? `🤖 ${kokoroVoice}` : '🤖 Kokoro';
    }
    const found = voices.find(v => v.voiceURI === selectedVoice);
    if (found) return `🔊 ${found.name}`;
    return selectedVoice ? `🔊 ${selectedVoice}` : '';
  })() : '';

  return (
    <div className="audio-bar">
      <div className="audio-bar-inner">
        <div className="audio-left">
          <button
            ref={avatarRef}
            type="button"
            title="Select voice"
            className="bar-btn"
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation();
              const rect = avatarRef.current?.getBoundingClientRect();
              setPopPos(rect ? { x: Math.round(rect.left + rect.width / 2) } : null);
              setVoiceTab(ttsEngine); // open on the currently active engine's tab
              setOpen(v => !v);
            }}
          >
            <span className="avatar-emoji" aria-hidden="true">💬</span>
          </button>

          <div className="voice-label" aria-hidden={!mounted}>
            {voiceLabel}
          </div>

          {open && (
            <div
              ref={popRef}
              className="voice-popover"
              style={{
                position: 'fixed',
                left: popPos ? `${popPos.x}px` : '8px',
                bottom: '80px',
                zIndex: 99999,
              }}
            >
              <div className="popover-content voice-popover-content">
                {/* Tabs */}
                <div className="voice-tabs">
                  <button
                    className={`voice-tab ${voiceTab === 'browser' ? 'active' : ''}`}
                    onClick={() => setVoiceTab('browser')}
                  >
                    🔊 Browser
                  </button>
                  <button
                    className={`voice-tab ${voiceTab === 'kokoro' ? 'active' : ''}`}
                    onClick={() => setVoiceTab('kokoro')}
                  >
                    🤖 Kokoro
                  </button>
                </div>

                {voiceTab === 'browser' ? (
                  <div className="voice-list">
                    {voices.length === 0 ? (
                      <div className="voice-empty">No browser voices available</div>
                    ) : (
                      voices.map(v => (
                        <div
                          key={v.voiceURI}
                          className={`voice-item p-2 rounded ${ttsEngine === 'browser' && selectedVoice === v.voiceURI ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedVoice(v.voiceURI);
                            setTtsEngine('browser');
                            setOpen(false);
                          }}
                        >
                          <div>{v.name} <span>({v.lang})</span></div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="voice-list">
                    {kokoroLoading ? (
                      <div className="voice-empty">Loading…</div>
                    ) : kokoroVoices.length === 0 ? (
                      <div className="voice-empty">
                        No voices — is the Kokoro server running?<br />
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Start: <code>uv run python main.py</code></span>
                      </div>
                    ) : (
                      kokoroVoices.map(v => (
                        <div
                          key={v}
                          className={`voice-item p-2 rounded ${ttsEngine === 'kokoro' && kokoroVoice === v ? 'selected' : ''}`}
                          onClick={() => {
                            setKokoroVoice(v);
                            setTtsEngine('kokoro');
                            setOpen(false);
                          }}
                        >
                          <div>{v}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="audio-controls">
          <button
            className="audio-btn"
            title="Previous"
            onClick={() => prev(Math.max(0, currentSegmentIndex - 1))}
          >
            &#8634;
          </button>

          <button
            className="audio-play"
            title={playbackStatus === 'playing' ? 'Pause' : 'Play'}
            disabled={playbackStatus === 'loading'}
            onClick={() => {
              if (playbackStatus === 'playing') pause();
              else if (playbackStatus === 'paused') resume();
              else play();
            }}
          >
            {playbackStatus === 'loading' ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : playbackStatus === 'playing' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button className="audio-btn" title="Next" onClick={() => next()}>
            &#8635;
          </button>
        </div>

        <div className="audio-right">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setFile(e.target.files[0]);
                }
                e.target.value = '';
              }}
            />
            <button
              className="bar-btn"
              title="Open PDF"
              onClick={() => fileInputRef.current?.click()}
            >
              <span aria-hidden="true">📎</span>
            </button>

            <button className="bar-btn zoom-btn-bar" title="Zoom out" onClick={() => { const z = useAudioStore.getState().zoomOut; z(); }}>➖</button>

            <button className="bar-btn zoom-btn-bar" title="Zoom in" onClick={() => { const z = useAudioStore.getState().zoomIn; z(); }}>➕</button>

            <button
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              type="button"
              className="bar-btn"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? '🌙' : '🌞'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
