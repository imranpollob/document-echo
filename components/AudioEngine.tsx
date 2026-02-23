'use client';

import { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/use-audio-store';

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

  // Subscribe to store state
  const currentSegmentIndex = useAudioStore(state => state.currentSegmentIndex);
  const playbackStatus = useAudioStore(state => state.playbackStatus);
  const segments = useAudioStore(state => state.segments);
  const audioCache = useAudioStore(state => state.audioCache);
  const selectedVoice = useAudioStore(state => state.selectedVoice);
  const next = useAudioStore(state => state.next);

  // Create audio element once
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => {
        next();
      };
      audioRef.current.onerror = (e) => {
        console.error('Audio playback error', e);
      };
    }
  }, [next]);

  // Main playback effect
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Stop everything when not in 'playing' state
    if (playbackStatus !== 'playing') {
      try { audio.pause(); } catch { }
      window.speechSynthesis.cancel();
      return;
    }

    // --- Playing ---
    const segment = segments[currentSegmentIndex];
    if (!segment) return;

    const hash = hashString(segment.text);
    const blob = audioCache.get(hash);

    if (blob) {
      // Stop any browser TTS that might be running
      window.speechSynthesis.cancel();

      // Resume if same segment (hash matches)
      if (lastHashRef.current === hash && lastUrlRef.current) {
        (async () => {
          try { await audio.play(); } catch (e: any) {
            if (e?.name !== 'AbortError') console.error('Play failed', e);
          }
        })();
        return;
      }

      // New segment — clean up old URL
      if (lastUrlRef.current) {
        try { URL.revokeObjectURL(lastUrlRef.current); } catch { }
      }

      const url = URL.createObjectURL(blob);
      lastUrlRef.current = url;
      lastHashRef.current = hash;
      audio.src = url;

      (async () => {
        try { await audio.play(); } catch (e: any) {
          if (e?.name !== 'AbortError') console.error('Play failed', e);
        }
      })();
    } else {
      // Browser TTS fallback
      try { audio.pause(); } catch { }
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(segment.text);
      if (selectedVoice) {
        const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === selectedVoice);
        if (voice) utterance.voice = voice;
      }

      utterance.onend = () => {
        next();
      };

      window.speechSynthesis.speak(utterance);
    }
  }, [currentSegmentIndex, playbackStatus, segments, audioCache, selectedVoice, next]);

  // Cleanup on unmount
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
