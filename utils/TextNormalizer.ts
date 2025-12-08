import { TextSegment } from '../types';

interface ScrapedTextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
  hasEOL: boolean;
  domElementId?: string; // We'll assign this during extraction
}

export class TextNormalizer {
  static normalize(textItems: any[], pageIndex: number): TextSegment[] {
    // 1. Maintain alignment with original indices
    // We iterate over ALL items to preserve index for spanId, but skip empty ones for text building.
    
    let fullText = "";
    const charToSpanMap: { spanId: string, pageIndex: number }[] = [];

    textItems.forEach((item, idx) => {
      const str = item.str;
      // Skip empty or whitespace-only items for text processing but we MUST know their index exists
      if (str.trim().length === 0) {
          // Even if we skip, we don't add to fullText. 
          // The issue is if we skip, the span in DOM still exists (usually).
          // If we don't add to fullText, we can't map text back to this span.
          // That's fine, empty spans strictly shouldn't be selectable for reading.
          return;
      }
      
      const spanId = `page-${pageIndex}-span-${idx}`; 
      
      for (let i = 0; i < str.length; i++) {
        fullText += str[i];
        charToSpanMap.push({ spanId, pageIndex });
      }
      
      // Heuristic: If item ends in "-", remove it and don't add space.
      if (str.endsWith('-')) {
         fullText = fullText.slice(0, -1);
         charToSpanMap.pop();
       } else {
         fullText += " ";
         charToSpanMap.push({ spanId: "SPACE", pageIndex });
       }
    });

    // 3. Sentence Segmentation
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    const segments = segmenter.segment(fullText);
    
    const result: TextSegment[] = [];
    
    let currentIndex = 0;
    
    for (const seg of segments) {
      const segmentText = seg.segment.trim();
      if (segmentText.length === 0) continue;
      
      const startIndex = seg.index;
      const endIndex = startIndex + seg.segment.length;
      
      // Collect span IDs for this range
      const spanIds = new Set<string>();
      for (let i = startIndex; i < endIndex; i++) {
        if (charToSpanMap[i] && charToSpanMap[i].spanId !== "SPACE") {
          spanIds.add(charToSpanMap[i].spanId);
        }
      }
      
      result.push({
        id: crypto.randomUUID(),
        text: segmentText,
        pageNumber: pageIndex, // Already 1-based from input
        spanIds: Array.from(spanIds),
      });
    }

    return result;
  }
}
