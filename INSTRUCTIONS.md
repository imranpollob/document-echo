# Project Specification: "Document Echo" (PDF TTS Web App)

## 1\. Tech Stack & Architecture

  * **Framework:** Next.js (App Router) or React (Vite).
  * **Language:** TypeScript (Strict mode).
  * **State Management:** Zustand (for managing the playback queue and PDF state).
  * **PDF Core:** `pdf.js` (Mozilla). *Note: Must use the text-layer for DOM interaction, not just canvas rendering.*
  * **Styling:** Tailwind CSS.
  * **APIs:** OpenAI API (TTS endpoint) / ElevenLabs API (optional).
  * **Persistence:** `IndexedDB` (for caching audio blobs), `localStorage` (for API keys).

-----

## 2\. Phase 1: The Core Audio Pipeline (Prompt Sequence)

*Feed these prompts to your AI coder one by one to build the foundation.*

### **Step 1: PDF Rendering & Text Layer**

> **Prompt:** "Create a React component `PdfViewer` using `pdf.js`. It should load a PDF file from a local input. Critical requirement: It must render the **Text Layer** (`pdfjs-dist/web/pdf_viewer`) overlaid exactly on top of the Canvas layer. The text spans must be selectable. Styling should ensure the text layer is transparent but aligns perfectly with the visual text to allow for future highlighting."

### **Step 2: Text Extraction & Normalization (The "Sanitizer")**

> **Prompt:** "Implement a utility class `TextNormalizer`. When a PDF page is loaded, extract the text items.
>
> **Requirements:**
>
> 1.  **De-hyphenation:** Detect words split across lines (e.g., 'amaz-' \\n 'ing') and merge them into 'amazing'.
> 2.  **Garbage Collection:** Filter out page numbers, headers, and footers based on Y-coordinate thresholds (e.g., bottom 5% of page).
> 3.  **Sentence Segmentation:** Use `Intl.Segmenter` to break the cleaned text into an array of `Sentence` objects.
> 4.  **Mapping:** Each `Sentence` object must store the `pageIndex` and the `domElementId` of the text span it belongs to."

### **Step 3: The Audio Queue Store (Zustand)**

> **Prompt:** "Create a Zustand store `useAudioStore` to manage TTS playback.
>
> **State variables:**
>
>   * `queue`: Array of sentences to read.
>   * `currentIndex`: Index of the currently playing sentence.
>   * `isPlaying`: Boolean.
>   * `audioCache`: Map\<string, Blob\> (Key = hash of sentence text).
>
> **Actions:**
>
>   * `play()`: Plays the current audio blob.
>   * `next()`: Increments index, plays next.
>   * `fetchAhead()`: Trigger this when `play()` starts. It should look at `currentIndex + 1` and `currentIndex + 2`. If their audio blobs are not in `audioCache`, fetch them from the OpenAI API immediately to prevent gaps."

### **Step 4: The Audio Player Component**

> **Prompt:** "Create a headless `AudioEngine` component. It subscribes to `useAudioStore`.
>
>   * When `currentIndex` changes, it loads the blob from the cache into an HTML5 `Audio` element.
>   * On `audio.onended`, it automatically calls the `next()` action from the store.
>   * Handle API errors (e.g., invalid key) by pausing and alerting the user."

-----

## 3\. Phase 2: Synchronization (The "Karaoke" Effect)

*Once Phase 1 runs, paste this to implement the highlighting logic.*

### **Step 5: Visual Syncing**

> **Prompt:** "Update the `PdfViewer` to subscribe to `useAudioStore.currentIndex`.
>
> **Logic:**
>
> 1.  When `currentIndex` updates, look up the `Sentence` object.
> 2.  Find the corresponding DOM elements in the PDF text layer.
> 3.  Apply a CSS class `bg-yellow-200` to those spans. Remove the class from the previous index.
> 4.  **Auto-Scroll:** If the highlighted element is outside the viewport, use `scrollIntoView({ behavior: 'smooth', block: 'center' })` to keep it visible."

-----

## 4\. Technical Reference for the AI (Copy & Paste)

*Provide this "Data Contract" to the AI so it knows exactly how to type the data.*

```typescript
// types.ts

// The clean data structure representing a readable unit
export interface TextSegment {
  id: string;          // UUID
  text: string;        // The actual sentence text
  pageNumber: number;
  // Bounding box for highlighting (optional, if using canvas drawing)
  rect?: { x: number, y: number, w: number, h: number }; 
  // IDs of the specific span elements in the PDF.js text layer
  spanIds: string[];   
}

// The TTS Request Payload
export interface TtsRequest {
  text: string;
  voiceId: string; // e.g., 'alloy', 'echo'
  speed: number;
}

// The Store State
export interface AudioState {
  segments: TextSegment[];
  currentSegmentIndex: number;
  playbackStatus: 'idle' | 'loading' | 'playing' | 'paused';
  apiKey: string | null;
  
  // Actions
  setApiKey: (key: string) => void;
  loadSegments: (segments: TextSegment[]) => void;
  playSegment: (index: number) => Promise<void>;
  prefetchSegment: (index: number) => Promise<void>;
}
```

### **5. "Do Not" Rules for the AI**

  * **DO NOT** try to convert the entire PDF to MP3 at once. It is too expensive and slow.
  * **DO NOT** use default browser `speechSynthesis` for the MVP unless the API call fails; prioritize the high-quality API requested.
  * **DO NOT** rerender the entire PDF component when the highlight changes. Only toggle CSS classes on existing DOM nodes.

-----

