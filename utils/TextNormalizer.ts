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
  /**
   * Normalize raw PDF.js text items into NaturalReader-like "sentence" chunks.
   * We keep span ordering from PDF.js (page-${pageIndex}-span-${idx}) and
   * split on punctuation boundaries while keeping per-span fragments so
   * sentences that share a single PDF span can still be wrapped separately.
   */
  static normalize(textItems: any[], pageIndex: number): TextSegment[] {
    const fullTextChars: string[] = [];
    const charToSpanMap: { spanId: string }[] = [];
    const spanTextMap: Map<string, string[]> = new Map();

    textItems.forEach((item, idx) => {
      const raw = typeof item?.str === 'string' ? item.str : '';
      if (raw.length === 0) return;

      const spanId = `page-${pageIndex}-span-${idx}`;

      for (const ch of raw) {
        fullTextChars.push(ch);
        charToSpanMap.push({ spanId });
        const bucket = spanTextMap.get(spanId) ?? [];
        bucket.push(ch);
        spanTextMap.set(spanId, bucket);
      }

      // Add a space separator when the PDF item doesn't already end with
      // whitespace or a hyphen. This prevents words from merging while still
      // allowing hyphenated line-breaks to stay contiguous.
      const endsWithWhitespace = /\s$/.test(raw);
      const endsWithHyphen = raw.endsWith('-');

      if (item.hasEOL) {
        fullTextChars.push('\n');
        charToSpanMap.push({ spanId: 'EOL' });
      } else if (!endsWithWhitespace && !endsWithHyphen) {
        fullTextChars.push(' ');
        charToSpanMap.push({ spanId: 'SPACE' });
      }
    });

    const text = fullTextChars.join('');
    const segments: TextSegment[] = [];

    let segStart = 0;

    const flushSegment = (endExclusive: number) => {
      if (endExclusive <= segStart) return;

      const rawSegment = text.slice(segStart, endExclusive);
      // Collapse any whitespace (including newlines) into single spaces
      // so TTS receives a single-line sentence while span mapping is preserved.
      const segmentText = rawSegment.replace(/\s+/g, ' ').trim();
      if (!segmentText) {
        segStart = endExclusive;
        return;
      }

      const spanIds = new Set<string>();
      const spanFragments: { spanId: string; text: string }[] = [];

      let currentSpan: string | null = null;
      let buffer = '';

      for (let i = segStart; i < endExclusive; i++) {
        const mapped = charToSpanMap[i];
        if (!mapped) continue;
        if (mapped.spanId === 'SPACE' || mapped.spanId === 'EOL') continue;
        spanIds.add(mapped.spanId);

        if (mapped.spanId !== currentSpan) {
          if (buffer && currentSpan) {
            spanFragments.push({ spanId: currentSpan, text: buffer });
          }
          currentSpan = mapped.spanId;
          buffer = '';
        }

        buffer += fullTextChars[i];
      }

      if (buffer && currentSpan) {
        spanFragments.push({ spanId: currentSpan, text: buffer });
      }

      segments.push({
        id: crypto.randomUUID(),
        text: segmentText,
        pageNumber: pageIndex,
        spanIds: Array.from(spanIds),
        spanFragments,
      });

      segStart = endExclusive;
    };

    for (let i = 0; i < fullTextChars.length; i++) {
      const ch = fullTextChars[i];
      const isSentenceEnd = /[.!?]/.test(ch);

      if (isSentenceEnd) {
        flushSegment(i + 1);
      }
    }

    // Flush any trailing text.
    flushSegment(fullTextChars.length);

    return segments;
  }
}
