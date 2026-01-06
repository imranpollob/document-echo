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
  const [popPos, setPopPos] = useState<{ left: number; top: number } | null>(null);
  // API key popover
  const apiKey = useAudioStore(s => s.apiKey);
  const setApiKey = useAudioStore(s => s.setApiKey);
  const [apiOpen, setApiOpen] = useState(false);
  const apiPopRef = useRef<HTMLDivElement | null>(null);
  const apiBtnRef = useRef<HTMLButtonElement | null>(null);
  const [apiPopPos, setApiPopPos] = useState<{ right: number; top: number } | null>(null);
  const [apiInput, setApiInput] = useState<string>(apiKey ?? '');

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

  return (
    <div className="audio-bar">
      <div className="audio-bar-inner">
        <div className="audio-left">
          <button
            ref={avatarRef}
            type="button"
            className="avatar"
            title="Select voice"
            onClick={(e) => {
              e.stopPropagation();
              console.log('[AudioBar] avatar clicked, open=', open);
              // compute popover position relative to viewport
              const rect = avatarRef.current?.getBoundingClientRect();
              if (rect) {
                // position popover above the avatar
                setPopPos({ left: Math.max(8, rect.left), top: rect.top - 8 });
              } else {
                setPopPos(null);
              }
              setOpen(v => !v);
            }}
            style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: 0 }}
            aria-expanded={open}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" fill="#2B6CE4" />
              <path d="M4 20c0-2.21 3.58-4 8-4s8 1.79 8 4v1H4v-1z" fill="#DCEEFF" />
            </svg>
          </button>
          {/* Display selected voice name next to avatar */}
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
                left: popPos ? `${popPos.left}px` : '8px',
                bottom: '80px',
                zIndex: 99999,
              }}
            >
              <div className="voice-list" style={{ maxHeight: 220, overflow: 'auto', background: 'white', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                {voices.length === 0 ? (
                  <div className="px-2 py-1 text-sm text-gray-600">No voices</div>
                ) : (
                  voices.map(v => (
                    <div key={v.voiceURI} className={`voice-item p-2 rounded hover:bg-gray-50 ${selectedVoice === v.voiceURI ? 'bg-gray-100' : ''}`} style={{ cursor: 'pointer' }} onClick={() => { setSelectedVoice(v.voiceURI); setOpen(false); }}>
                      <div style={{ fontSize: 13 }}>{v.name} <span style={{ color: '#666', fontSize: 12 }}>({v.lang})</span></div>
                    </div>
                  ))
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
          <div className="audio-speed">2x</div>
          <div style={{ marginLeft: 12, position: 'relative' }}>
            <button
              ref={apiBtnRef}
              type="button"
              className="api-btn"
              title="OpenAI API Key"
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
              style={{ cursor: 'pointer', border: 'none', background: 'transparent', padding: 6 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="#2B6CE4" strokeWidth="1.2" fill="none" />
                <path d="M7 10h10M7 14h6" stroke="#2B6CE4" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
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
                <div style={{ width: 320, background: 'white', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>OpenAI API Key (optional)</div>
                  <input
                    value={apiInput}
                    onChange={(e) => setApiInput(e.target.value)}
                    placeholder="sk-..."
                    style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setApiKey(''); setApiInput(''); setApiOpen(false); }}
                      style={{ padding: '6px 10px', borderRadius: 6, background: '#f3f4f6', border: 'none' }}
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => { setApiKey(apiInput); setApiOpen(false); }}
                      style={{ padding: '6px 10px', borderRadius: 6, background: '#2B6CE4', color: 'white', border: 'none' }}
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
