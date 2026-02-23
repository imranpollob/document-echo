import { create } from 'zustand';
import { AudioState, TextSegment, TtsEngine } from '../types';
import { get as idbGet, set as idbSet } from 'idb-keyval';

// Simple string hash for caching
const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
};

const KOKORO_DEFAULT_URL = 'http://localhost:8880';

interface AudioStore extends AudioState {
  audioCache: Map<string, Blob>;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  segments: [],
  currentSegmentIndex: 0,
  playbackStatus: 'idle',
  selectedVoice: typeof window !== 'undefined' ? (localStorage.getItem('selectedVoice') ?? null) : null,
  audioCache: new Map(),
  file: null,

  // TTS engine
  ttsEngine: (typeof window !== 'undefined' ? (localStorage.getItem('ttsEngine') as TtsEngine) ?? 'browser' : 'browser') as TtsEngine,
  kokoroVoice: typeof window !== 'undefined' ? (localStorage.getItem('kokoroVoice') ?? 'af_heart') : 'af_heart',
  kokoroSpeed: 1.0,
  kokoroServerUrl: typeof window !== 'undefined' ? (localStorage.getItem('kokoroServerUrl') ?? KOKORO_DEFAULT_URL) : KOKORO_DEFAULT_URL,

  setFile: (file: File | null) => set({ file }),

  setTtsEngine: (engine: TtsEngine) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ttsEngine', engine);
    }
    set({ ttsEngine: engine });
  },

  setKokoroVoice: (voice: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('kokoroVoice', voice);
    }
    set({ kokoroVoice: voice });
  },

  setKokoroSpeed: (speed: number) => set({ kokoroSpeed: speed }),

  setKokoroServerUrl: (url: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('kokoroServerUrl', url);
    }
    set({ kokoroServerUrl: url });
  },

  setSelectedVoice: (voiceURI: string) => {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('selectedVoice', voiceURI); } catch {}
    }
    set({ selectedVoice: voiceURI });
  },

  setPlaybackStatus: (status) => set({ playbackStatus: status }),

  loadSegments: (segments: TextSegment[]) => set({ segments, currentSegmentIndex: 0, playbackStatus: 'idle' }),

  playSegment: async (index: number) => {
    const { segments, ttsEngine, audioCache, kokoroVoice, kokoroSpeed, kokoroServerUrl } = get();
    if (index < 0 || index >= segments.length) return;

    // Stop any ongoing playback immediately
    set({ playbackStatus: 'paused' });
    set({ currentSegmentIndex: index, playbackStatus: 'loading' });

    const segment = segments[index];
    const hash = hashString(segment.text);

    if (ttsEngine === 'kokoro') {
      let blob = audioCache.get(hash);

      // Check IndexedDB if not in memory
      if (!blob) {
        const dbBlob = await idbGet(hash);
        if (dbBlob && dbBlob instanceof Blob) {
          blob = dbBlob;
          set(state => {
            const newCache = new Map(state.audioCache);
            newCache.set(hash, blob!);
            return { audioCache: newCache };
          });
        }
      }

      // Fetch from kokoro backend
      if (!blob) {
        try {
          const response = await fetch(`${kokoroServerUrl}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: segment.text,
              voice: kokoroVoice,
              speed: kokoroSpeed,
              lang: 'en-us',
            }),
          });

          if (!response.ok) {
            throw new Error(`Kokoro TTS error: ${response.status}`);
          }

          blob = await response.blob();
          await idbSet(hash, blob);

          set(state => {
            const newCache = new Map(state.audioCache);
            newCache.set(hash, blob!);
            return { audioCache: newCache };
          });
        } catch (error) {
          console.error('Kokoro TTS error, falling back to browser TTS:', error);
          // Fall through — AudioEngine will use browser TTS since no blob is cached
        }
      }

      // Prefetch next 1-2 sentences for seamless playback
      get().prefetchSegment(index + 1);
      get().prefetchSegment(index + 2);
    }

    // Transition to playing — AudioEngine will play blob if available, else browser TTS
    set({ playbackStatus: 'playing' });
  },

  next: () => {
    const { currentSegmentIndex, segments, playSegment } = get();
    if (currentSegmentIndex < segments.length - 1) {
      playSegment(currentSegmentIndex + 1);
    } else {
      set({ playbackStatus: 'idle' });
    }
  },

  play: () => {
    const { currentSegmentIndex, playSegment } = get();
    playSegment(currentSegmentIndex);
  },

  pause: () => {
    set({ playbackStatus: 'paused' });
  },

  resume: () => {
    set({ playbackStatus: 'playing' });
  },

  prefetchSegment: async (index: number) => {
    const { segments, ttsEngine, audioCache, kokoroVoice, kokoroSpeed, kokoroServerUrl } = get();
    if (index < 0 || index >= segments.length) return;
    if (ttsEngine !== 'kokoro') return;

    const segment = segments[index];
    const hash = hashString(segment.text);

    if (audioCache.has(hash)) return;

    // Check IndexedDB first
    const dbBlob = await idbGet(hash);
    if (dbBlob && dbBlob instanceof Blob) {
      set(state => {
        const newCache = new Map(state.audioCache);
        newCache.set(hash, dbBlob);
        return { audioCache: newCache };
      });
      return;
    }

    // Fire-and-forget fetch from kokoro backend
    fetch(`${kokoroServerUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: segment.text,
        voice: kokoroVoice,
        speed: kokoroSpeed,
        lang: 'en-us',
      }),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const blob = await response.blob();
        await idbSet(hash, blob);
        set(state => {
          const newCache = new Map(state.audioCache);
          newCache.set(hash, blob);
          return { audioCache: newCache };
        });
      })
      .catch(e => console.warn('Prefetch failed:', e));
  },

  // PDF zoom state (shared)
  scale: 1.5,
  setScale: (s: number) => set({ scale: s }),
  zoomIn: () => set(state => ({ scale: Math.min(4, +(state.scale * 1.2).toFixed(3)) })),
  zoomOut: () => set(state => ({ scale: Math.max(0.2, +(state.scale / 1.2).toFixed(3)) })),
}));
