'use client';

import { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/useAudioStore';

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
  const segments = useAudioStore(state => state.segments);
  const audioCache = useAudioStore(state => state.audioCache);
  const next = useAudioStore(state => state.next);

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
    }
  }, [next]);

  const apiKey = useAudioStore(state => state.apiKey);
  const selectedVoice = useAudioStore(state => state.selectedVoice);
  const useBrowserTTSForIndex = useAudioStore(state => state.useBrowserTTSForIndex);

  useEffect(() => {
    // Stop browser TTS on unmount or status change
    if (playbackStatus !== 'playing') {
      window.speechSynthesis.cancel();
    }
  }, [playbackStatus]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playbackStatus === 'playing') {
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
          console.log('[AudioEngine] audio.play() (reused) count=', playCountRef.current, { hash });
          audio.play().catch(e => console.error("Play failed", e));
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
        console.log('[AudioEngine] audio.play() count=', playCountRef.current, { hash });
        audio.play().catch(e => console.error("Play failed", e));

        return () => {
          audio.pause();
        }
      } else if (!apiKey || useBrowserTTSForIndex === currentSegmentIndex) {
        // Browser TTS Fallback
        // Stop any previous
        window.speechSynthesis.cancel();

        console.log("TTS (browser) send:", segment.text);
        const utterance = new SpeechSynthesisUtterance(segment.text);
        if (selectedVoice) {
          const voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === selectedVoice);
          if (voice) utterance.voice = voice;
        }

        utterance.onend = () => {
          next();
        };

        window.speechSynthesis.speak(utterance);

        // Audio element is not used
        audio.pause();
      }
    } else if (playbackStatus === 'paused' || playbackStatus === 'idle') {
      audio.pause();
      window.speechSynthesis.cancel();
    }
  }, [currentSegmentIndex, playbackStatus, segments, audioCache, apiKey, selectedVoice, next]);

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
