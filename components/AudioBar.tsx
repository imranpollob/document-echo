"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useAudioStore } from '../store/useAudioStore';

export default function AudioBar() {
  const playbackStatus = useAudioStore(s => s.playbackStatus);
  const play = useAudioStore(s => s.play);
  const pause = useAudioStore(s => s.pause);
  const resume = useAudioStore(s => s.resume);
  const next = useAudioStore(s => s.next);
  const prev = useAudioStore(s => s.playSegment);
  const currentSegmentIndex = useAudioStore(s => s.currentSegmentIndex);
  const selectedVoice = useAudioStore(s => s.selectedVoice);
  const setSelectedVoice = useAudioStore(s => s.setSelectedVoice);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const [popPos, setPopPos] = useState<{ x: number } | null>(null);
  // API key popover
  const apiKey = useAudioStore(s => s.apiKey);
  const setApiKey = useAudioStore(s => s.setApiKey);
  const [apiOpen, setApiOpen] = useState(false);
  const apiPopRef = useRef<HTMLDivElement | null>(null);
  const apiBtnRef = useRef<HTMLButtonElement | null>(null);
  const [apiPopPos, setApiPopPos] = useState<{ right: number; top: number } | null>(null);
  const [apiInput, setApiInput] = useState<string>(apiKey ?? '');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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
    const onDocClick = (e: MouseEvent) => {
      if (!apiOpen) return;
      if (apiPopRef.current && !apiPopRef.current.contains(e.target as Node)) {
        setApiOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [apiOpen]);

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

  return (
    <div className="audio-bar">
      <div className="audio-bar-inner">
        <div className="audio-left">
          <button
            ref={avatarRef}
            type="button"
            title="Select voice"
            onClick={(e) => {
              e.stopPropagation();
              // compute popover position relative to viewport
              const rect = avatarRef.current?.getBoundingClientRect();
              if (rect) {
                // center popover above the avatar using its mid-point
                setPopPos({ x: Math.round(rect.left + rect.width / 2) });
              } else {
                setPopPos(null);
              }
              setOpen(v => !v);
            }}
            className="bar-btn"
            aria-expanded={open}
          >
            <span className="avatar-emoji" aria-hidden="true">💬</span>
          </button>

          <div className="voice-label" aria-hidden={!mounted}>
            {mounted ? (() => {
              const found = voices.find(v => v.voiceURI === selectedVoice);
              if (found) return `${found.name} (${found.lang})`;
              return selectedVoice ? selectedVoice : '';
            })() : ''}
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
              <div className="popover-content">
                {voices.length === 0 ? (
                  <div className="px-2 py-1 text-sm text-gray-600">No voices</div>
                ) : (
                  <div className="voice-list">
                    {voices.map(v => (
                      <div key={v.voiceURI} className={`voice-item p-2 rounded ${selectedVoice === v.voiceURI ? 'selected' : ''}`} onClick={() => { setSelectedVoice(v.voiceURI); setOpen(false); }}>
                        <div>{v.name} <span>({v.lang})</span></div>
                      </div>
                    ))}
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
            onClick={() => {
              if (playbackStatus === 'playing') pause();
              else if (playbackStatus === 'paused') resume();
              else play();
            }}
          >
            {playbackStatus === 'playing' ? '❚❚' : '▶'}
          </button>

          <button className="audio-btn" title="Next" onClick={() => next()}>
            &#8635;
          </button>
        </div>

        <div className="audio-right">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="bar-btn" title="Zoom out" onClick={() => { const z = useAudioStore.getState().zoomOut; z(); }}>➖</button>

            <button className="bar-btn" title="Zoom in" onClick={() => { const z = useAudioStore.getState().zoomIn; z(); }}>➕</button>

            <button
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              type="button"
              className="bar-btn"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? '🌙' : '🌞'}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = apiBtnRef.current?.getBoundingClientRect();
                if (rect) {
                  // position popover similar to avatar but anchored on the right side
                  setApiPopPos({ right: Math.max(8, Math.round(window.innerWidth - rect.right)), top: rect.top - 8 });
                } else setApiPopPos(null);
                setApiInput(apiKey ?? '');
                setApiOpen(v => !v);
              }}

              ref={apiBtnRef}
              type="button"
              className="bar-btn"
              title="OpenAI API Key"
            >
              <span className="api-emoji" aria-hidden="true">🔑</span>
            </button>

            {apiOpen && (
              <div
                ref={apiPopRef}
                className="api-popover"
                style={{
                  position: 'fixed',
                  right: apiPopPos ? `${apiPopPos.right}px` : '8px',
                  bottom: '80px',
                  zIndex: 99999,
                }}
              >
                <div className="popover-content">
                  <div className="popover-title">OpenAI API Key (optional)</div>
                  <input
                    value={apiInput}
                    onChange={(e) => setApiInput(e.target.value)}
                    placeholder="sk..."
                    className="popover-input"
                  />
                  <div className="popover-actions">
                    <button
                      onClick={() => { setApiKey(''); setApiInput(''); setApiOpen(false); }}
                      className="popover-btn popover-btn--muted"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => { setApiKey(apiInput); setApiOpen(false); }}
                      className="popover-btn popover-btn--primary"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
