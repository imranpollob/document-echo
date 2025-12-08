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
    // 1. Garbage Collection (Simple Y-coord threshold)
    // Assuming standard page height, filtered generally. 
    // For MVP, we'll skip complex header/footer logic unless we have page dimensions.
    // Let's just filter empty strings.
    const cleanItems = textItems.filter(item => item.str.trim().length > 0);

    // 2. Merge de-hyphenated words
    // We need to reconstruct the full text first, mapping back to spans.
    // This is complex because we want to map sentences to spans.
    
    // Simplified approach: Join all text, then segment, then find spans?
    // Or segment while keeping track of current span.
    
    // Let's build a long string and a map of character index -> span ID
    let fullText = "";
    const charToSpanMap: { spanId: string, pageIndex: number }[] = [];

    cleanItems.forEach((item, idx) => {
      // Logic to handle hyphens at end of line?
      let str = item.str;
      // If previous item ended with hyphen and we are on new line... 
      // For now, let's just join with spaces unless explicit De-hyphenation needed.
      // Instructions say: "Detect words split across lines (e.g., 'amaz-' \n 'ing') and merge them"
      
      const spanId = item.id || `page-${pageIndex}-span-${idx}`; // item.id should come from pdf.js if we set it, or we generate one
      
      // We will assume the PdfViewer assigns IDs to these spans corresponding to this index.
      
      for (let i = 0; i < str.length; i++) {
        fullText += str[i];
        charToSpanMap.push({ spanId, pageIndex });
      }
      
      // Add space between items usually, unless hyphenated?
      // Heuristic: If item ends in "-", remove it and don't add space.
      if (str.endsWith('-')) {
         // distinct logic needed: modify fullText and map
         // Remove last char from fullText and map
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
        pageNumber: pageIndex + 1, // 1-based
        spanIds: Array.from(spanIds),
      });
    }

    return result;
  }
}
