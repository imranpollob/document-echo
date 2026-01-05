export interface TextSegment {
  id: string;          // UUID
  text: string;        // The actual sentence text
  pageNumber: number;
  // Bounding box for highlighting (optional, if using canvas drawing)
  rect?: { x: number, y: number, w: number, h: number }; 
  // IDs of the specific span elements in the PDF.js text layer
  spanIds: string[];   
  // Fine-grained fragments per span so we can split multiple sentences inside one span
  spanFragments?: { spanId: string; text: string }[];
}

export interface TtsRequest {
  text: string;
  voiceId: string; // e.g., 'alloy', 'echo'
  speed: number;
}

export interface AudioState {
  segments: TextSegment[];
  currentSegmentIndex: number;
  playbackStatus: 'idle' | 'loading' | 'playing' | 'paused';
  apiKey: string | null;
  selectedVoice: string | null; // For browser TTS
  
  // Actions
  setApiKey: (key: string) => void;
  setSelectedVoice: (voiceURI: string) => void;
  loadSegments: (segments: TextSegment[]) => void;
  playSegment: (index: number) => Promise<void>;
  prefetchSegment: (index: number) => Promise<void>;
  
  // Controls
  play: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
}
