import { create } from 'zustand';
import { AudioState, TextSegment } from '../types';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import OpenAI from 'openai';

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

interface AudioStore extends AudioState {
  audioCache: Map<string, Blob>;
    useBrowserTTSForIndex: number | null;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  segments: [],
  currentSegmentIndex: 0,
  playbackStatus: 'idle',
    apiKey: null,
    selectedVoice: typeof window !== 'undefined' ? (localStorage.getItem('selectedVoice') ?? null) : null,
  audioCache: new Map(),
    useBrowserTTSForIndex: null,

  setApiKey: (key: string) => set({ apiKey: key }),
  setSelectedVoice: (voiceURI: string) => {
      if (typeof window !== 'undefined') {
          try { localStorage.setItem('selectedVoice', voiceURI); } catch {}
      }
      set({ selectedVoice: voiceURI });
  },

  setPlaybackStatus: (status) => set({ playbackStatus: status }),

  loadSegments: (segments: TextSegment[]) => set({ segments, currentSegmentIndex: 0, playbackStatus: 'idle' }),

  playSegment: async (index: number) => {
    const { segments, apiKey, audioCache } = get();
    if (index < 0 || index >= segments.length) return;

    // Stop any ongoing playback immediately
    set({ playbackStatus: 'paused' });

    set({ currentSegmentIndex: index, playbackStatus: 'loading', useBrowserTTSForIndex: null });
    
    // Trigger prefetch for next segments if API key is present
    if (apiKey) {
        get().prefetchSegment(index + 1);
        get().prefetchSegment(index + 2);
    }

    const segment = segments[index];
    const hash = hashString(segment.text);

    // If we have API key, try to use it
    if (apiKey) {
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

        if (!blob) {
            try {
                // TTS (API) request initiated for segment
                const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
                const response = await openai.audio.speech.create({
                    model: "tts-1",
                    voice: "alloy",
                    input: segment.text,
                });
                blob = await response.blob();
                
                // Save to Cache
                await idbSet(hash, blob);
                
                set(state => {
                        const newCache = new Map(state.audioCache);
                        newCache.set(hash, blob!);
                            // Ensure we clear any browser fallback for this segment since we now have an API blob
                            return { audioCache: newCache, useBrowserTTSForIndex: null };
                    });
            } catch (error) {
                    console.error("TTS API Error", error);
                    // If API fails, fall back to browser TTS for this segment only
                    set({ useBrowserTTSForIndex: index });
                    // Let AudioEngine handle fallback to browser TTS (do not return)
            }
        }
    } else {
        // Fallback to browser TTS - no blob needed, AudioEngine handles it.
        // We stay in 'loading' state until AudioEngine picks it up and starts speaking.
    }

    // Only set playing if we have a blob ready (API cache hit)
    // Otherwise, let Async fetch or AudioEngine (local TTS) switch to playing when ready
    if (apiKey && audioCache.get(hash)) {
        set({ playbackStatus: 'playing' });
    }
  },

  next: () => {
      const { currentSegmentIndex, segments, playSegment } = get();
      if (currentSegmentIndex < segments.length - 1) {
          playSegment(currentSegmentIndex + 1);
      } else {
          set({ playbackStatus: 'idle', useBrowserTTSForIndex: null });
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
     // If we were paused, set to loading to show spinner while engine restarts/resumes
     set({ playbackStatus: 'loading' });
  },

  prefetchSegment: async (index: number) => {
       const { segments, apiKey, audioCache } = get();
       if (index < 0 || index >= segments.length) return;
       
       const segment = segments[index];
       const hash = hashString(segment.text);
       
       if (audioCache.has(hash)) return;
       
       const dbBlob = await idbGet(hash);
       if (dbBlob && dbBlob instanceof Blob) {
           set(state => {
                 const newCache = new Map(state.audioCache);
                 newCache.set(hash, dbBlob);
                 return { audioCache: newCache };
             });
           return;
       }

       if (apiKey) {
           // Fire and forget fetch for prefetching audio
           const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
           openai.audio.speech.create({
                model: "tts-1",
                voice: "alloy",
                input: segment.text,
            }).then(async response => {
                const blob = await response.blob();
                await idbSet(hash, blob);
                 set(state => {
                     const newCache = new Map(state.audioCache);
                     newCache.set(hash, blob!);
                     return { audioCache: newCache };
                 });
            }).catch(e => console.warn("Prefetch failed", e));
       }
  }

    // PDF zoom state (shared)
    , scale: 1.5,
    setScale: (s: number) => set({ scale: s }),
    zoomIn: () => set(state => ({ scale: Math.min(4, +(state.scale * 1.2).toFixed(3)) })),
    zoomOut: () => set(state => ({ scale: Math.max(0.2, +(state.scale / 1.2).toFixed(3)) })),

}));
