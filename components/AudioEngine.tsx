'use client';

import { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/use-audio-store';

// Simple string hash for caching (duplicated merely because of isolation, better to export from utils)
// But wait, the store manages the blob retrieval, putting it in context?
// Actually the store has the blob in memory now in `audioCache`.
// We need to retrieve it.

const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString();
};

export const AudioEngine = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastHashRef = useRef<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const playCountRef = useRef<number>(0);

  // Subscribe to store state
  const currentSegmentIndex = useAudioStore(state => state.currentSegmentIndex);
  const playbackStatus = useAudioStore(state => state.playbackStatus);
  const setPlaybackStatus = useAudioStore(state => state.setPlaybackStatus);
  const segments = useAudioStore(state => state.segments);
  const audioCache = useAudioStore(state => state.audioCache);
  const next = useAudioStore(state => state.next);

  // Ref to track if we are waiting for onstart event to avoid re-triggering logic
  const isWaitingForOnStartRef = useRef(false);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => {
        next();
      };
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error", e);
        // Maybe alert user?
      };
      // Audio element also has onplay/onplaying, but we control via status
    }
  }, [next]);

  const apiKey = useAudioStore(state => state.apiKey);
  const selectedVoice = useAudioStore(state => state.selectedVoice);
  const useBrowserTTSForIndex = useAudioStore(state => state.useBrowserTTSForIndex);

  useEffect(() => {
    // Stop browser TTS on unmount or status change (if not transitioning loading->playing)
    if (playbackStatus !== 'playing' && playbackStatus !== 'loading') {
      window.speechSynthesis.cancel();
      isWaitingForOnStartRef.current = false;
    }
  }, [playbackStatus]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // We handle 'loading' (start request) and 'playing' (active/resume)
    if (playbackStatus === 'playing' || playbackStatus === 'loading') {

      // If we are currently "playing" but we set the flag that we were waiting for start,
      // it means this effect run is due to variables changing after start.
      // We should NOT restart playback if it's already going.
      if (playbackStatus === 'playing' && isWaitingForOnStartRef.current) {
        isWaitingForOnStartRef.current = false;
        return;
      }

      const segment = segments[currentSegmentIndex];
      if (!segment) return;

      // Check if we use API (Blob exists) or Browser TTS
      const hash = hashString(segment.text);
      const blob = audioCache.get(hash);

      if (blob) {
        // API Audio
        // If this blob/hash is already loaded, avoid recreating the URL or re-setting src
        if (lastHashRef.current === hash && lastUrlRef.current) {
          playCountRef.current += 1;
          (async () => {
            try {
              if (playbackStatus === 'loading') setPlaybackStatus('playing');
              await audio.play();
            } catch (e: any) {
              if (e && e.name === 'AbortError') {
                // ignore aborted play caused by pause()
              } else {
                console.error('Play failed', e);
              }
            }
          })();
          return;
        }

        // Clean up previous URL if any
        if (lastUrlRef.current) {
          try { URL.revokeObjectURL(lastUrlRef.current); } catch { }
          lastUrlRef.current = null;
          lastHashRef.current = null;
        }

        const url = URL.createObjectURL(blob);
        lastUrlRef.current = url;
        lastHashRef.current = hash;
        audio.src = url;
        playCountRef.current += 1;
        (async () => {
          try {
            if (playbackStatus === 'loading') setPlaybackStatus('playing');
            await audio.play();
          } catch (e: any) {
            if (e && e.name === 'AbortError') {
              // ignore aborted play caused by pause()
            } else {
              console.error('Play failed', e);
            }
          }
        })();

        return () => {
          try { audio.pause(); } catch { }
        }
      } else if (!apiKey || useBrowserTTSForIndex === currentSegmentIndex) {
        // Browser TTS Fallback

        // If we are in 'loading' state, we start the speech.
        // If we are in 'playing' state (e.g. Resume), we also start/resume.

        // Important: Stop any previous utterance before starting new one, 
        // unless we are just resuming? 
        // window.speechSynthesis.cancel() kills everything.
        // For simplicity in this engine, we restart the sentence segment on resume/play.
        window.speechSynthesis.cancel();

        // Browser TTS invoked for segment
        const utterance = new SpeechSynthesisUtterance(segment.text);
        if (selectedVoice) {
          const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === selectedVoice);
          if (voice) utterance.voice = voice;
        }

        utterance.onend = () => {
          next();
        };

        utterance.onstart = () => {
          if (playbackStatus === 'loading') {
            // Signal that we strictly transitioned from loading->playing
            isWaitingForOnStartRef.current = true;
            setPlaybackStatus('playing');
          }
        };

        window.speechSynthesis.speak(utterance);

        // Audio element is not used
        try { audio.pause(); } catch { }
      }
    } else if (playbackStatus === 'paused' || playbackStatus === 'idle') {
      try { audio.pause(); } catch { }
      window.speechSynthesis.cancel();
    }
  }, [currentSegmentIndex, playbackStatus, segments, audioCache, apiKey, selectedVoice, next, setPlaybackStatus]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (lastUrlRef.current) {
        try { URL.revokeObjectURL(lastUrlRef.current); } catch { }
        lastUrlRef.current = null;
        lastHashRef.current = null;
      }
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch { }
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  return null; // Headless
};
