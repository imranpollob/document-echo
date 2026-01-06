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
        const url = URL.createObjectURL(blob);
        audio.src = url;
        audio.play().catch(e => console.error("Play failed", e));

        return () => {
          URL.revokeObjectURL(url);
          audio.pause();
        }
      } else if (!apiKey) {
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

  return null; // Headless
};
