'use client';

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Import TextLayerBuilder from web/pdf_viewer.mjs (explicit path)
// @ts-ignore
import { TextLayerBuilder } from 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import { TextNormalizer } from '../utils/TextNormalizer';
import { useAudioStore } from '../store/useAudioStore';
import type { TextSegment } from '../types';

// Set worker src
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

interface PdfViewerProps {
  file: File | null;
}

export const PdfViewer = ({ file }: PdfViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Store actions
  const loadSegments = useAudioStore(state => state.loadSegments);
  const playSegment = useAudioStore(state => state.playSegment);
  const storeSegments = useAudioStore(state => state.segments);
  const currentSegmentIndex = useAudioStore(state => state.currentSegmentIndex);
  const playbackStatus = useAudioStore(state => state.playbackStatus);

  // Add styles for sentence highlighting
  useEffect(() => {
    const styleId = 'sentence-highlight-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .sentence-fragment.hovered {
          background-color: rgba(255, 255, 153, 0.5);
          cursor: pointer;
        }
        .sentence-fragment.playing {
          background-color: rgba(144, 238, 144, 0.5);
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Load PDF document
  useEffect(() => {
    if (!file) return;

    const loadPdf = async () => {
      setIsLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        setPdfDocument(pdf);
      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();

    // Cleanup function to prevent duplicate renders
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [file]);

  // Wrap sentence fragments inside presentation spans (following naturalreader.html approach)
  const tagSentencesInTextLayer = (
    textDivs: HTMLElement[],
    textItems: any[],
    segments: TextSegment[],
    pageNumber: number,
    segmentOffset: number
  ) => {
    // Build lookup from spanId -> { index, text } so we can tag spans and attach text for logging
    const spanToMeta = new Map<string, { index: number, text: string }>();
    segments.forEach((segment, idx) => {
      const segmentIndex = segmentOffset + idx;
      segment.spanIds.forEach(spanId => {
        if (!spanToMeta.has(spanId)) {
          spanToMeta.set(spanId, { index: segmentIndex, text: segment.text });
        }
      });
    });

    // Align each DOM span to the corresponding textContent.item index by matching text.
    let itemPtr = 0;
    textDivs.forEach((span, idx) => {
      const spanTextRaw = (span.textContent || '').replace(/\s+/g, ' ').trim();

      // Advance itemPtr to the first non-empty candidate
      while (itemPtr < textItems.length && !(textItems[itemPtr].str || '').trim()) itemPtr++;

      // Try to find a matching item starting from itemPtr
      let matchedIndex = -1;
      for (let k = itemPtr; k < textItems.length; k++) {
        const itemStr = (textItems[k].str || '').replace(/\s+/g, ' ').trim();
        if (!itemStr) continue;

        // Normalize hyphenation
        const itemStrNorm = itemStr.endsWith('-') ? itemStr.slice(0, -1) : itemStr;

        if (itemStrNorm && (itemStrNorm === spanTextRaw || itemStrNorm.includes(spanTextRaw) || spanTextRaw.includes(itemStrNorm))) {
          matchedIndex = k;
          itemPtr = k + 1;
          break;
        }
      }

      const spanId = matchedIndex >= 0 ? `page-${pageNumber}-span-${matchedIndex}` : `page-${pageNumber}-span-${idx}`;
      span.id = spanId;
      span.classList.add('segment-span');

      const meta = spanToMeta.get(spanId);
      if (meta !== undefined) {
        // Following naturalreader.html approach: wrap content with sentence element
        const originalText = span.textContent || '';
        const sentenceWrapper = document.createElement('span');
        sentenceWrapper.className = `sentence-fragment sentence-${meta.index}`;
        sentenceWrapper.setAttribute('data-sentence-index', meta.index.toString());
        sentenceWrapper.setAttribute('data-page-index', pageNumber.toString());
        sentenceWrapper.setAttribute('data-sentence-text', meta.text);
        sentenceWrapper.textContent = originalText;

        // Clear span and append wrapped content
        span.textContent = '';
        span.appendChild(sentenceWrapper);
      }
    });
  };

  // Render all pages
  useEffect(() => {
    if (!pdfDocument || !containerRef.current) return;

    let isCancelled = false;

    const renderAllPages = async () => {
      const container = containerRef.current;
      if (!container) return;

      container.innerHTML = ''; // Clear previous content

      const allSegments: TextSegment[] = [];
      let segmentOffset = 0;

      // Render each page
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        if (isCancelled) return;

        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        // Create page container
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container';
        pageContainer.style.position = 'relative';
        pageContainer.style.marginBottom = '30px';
        pageContainer.style.width = `${viewport.width}px`;
        pageContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        pageContainer.style.backgroundColor = 'white';

        // Create canvas for the page
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.className = 'block';

        const context = canvas.getContext('2d');
        if (context) {
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;
        }

        if (isCancelled) return;

        pageContainer.appendChild(canvas);

        // Create text layer
        const textContent = await page.getTextContent();
        const pageSegments = TextNormalizer.normalize(textContent.items, pageNum);

        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.position = 'absolute';
        textLayerDiv.style.top = '0';
        textLayerDiv.style.left = '0';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        const textLayer = new TextLayerBuilder({
          pdfPage: page,
        });

        await textLayer.render({ viewport });

        if (isCancelled) return;

        if (textLayer.div) {
          // Grab the generated spans. Some pdf.js versions expose textDivs; otherwise, query the DOM.
          const textDivs = (textLayer as any).textDivs as HTMLElement[] | undefined;
          const spans = textDivs && Array.isArray(textDivs)
            ? textDivs
            : Array.from(textLayer.div.querySelectorAll<HTMLElement>('span[role="presentation"]'));

          tagSentencesInTextLayer(spans, textContent.items, pageSegments, pageNum, segmentOffset);

          // Copy children to our custom div (after tagging)
          while (textLayer.div.firstChild) {
            textLayerDiv.appendChild(textLayer.div.firstChild);
          }

          // Highlight a full sentence on hover (event delegation) - updated for wrapped structure
          let hoveredSegmentIndex: string | null = null;

          const clearHover = () => {
            if (!hoveredSegmentIndex) return;
            textLayerDiv.querySelectorAll(
              `.sentence-fragment[data-sentence-index="${hoveredSegmentIndex}"]`
            ).forEach(el => el.classList.remove('hovered'));
            hoveredSegmentIndex = null;
          };

          textLayerDiv.addEventListener('mouseover', (e) => {
            const target = e.target as HTMLElement;
            const sentenceFragment = target.closest('.sentence-fragment');
            if (!sentenceFragment) return;

            const segmentIndex = sentenceFragment.getAttribute('data-sentence-index');
            const segmentText = sentenceFragment.getAttribute('data-sentence-text');
            if (!segmentIndex) return;

            // Log sentence text when available
            if (segmentText) {
              console.log('Hovered sentence:', segmentText);
            } else {
              // Fallback: log index so we can inspect mapping
              console.log('Hovered segment index:', segmentIndex);
            }

            if (segmentIndex !== hoveredSegmentIndex) {
              clearHover();
              textLayerDiv.querySelectorAll(
                `.sentence-fragment[data-sentence-index="${segmentIndex}"]`
              ).forEach(el => el.classList.add('hovered'));
              hoveredSegmentIndex = segmentIndex;
            }
          });

          textLayerDiv.addEventListener('mouseout', (e) => {
            const related = e.relatedTarget as HTMLElement | null;
            // If moving within the same textLayerDiv, ignore until mouse leaves the current sentence group
            if (related && textLayerDiv.contains(related)) {
              const targetSegment = related.closest('.sentence-fragment')?.getAttribute('data-sentence-index');
              if (targetSegment && targetSegment === hoveredSegmentIndex) return;
            }
            clearHover();
          });

          textLayerDiv.addEventListener('mouseleave', clearHover);

          // Add click handler - updated for wrapped structure
          textLayerDiv.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const sentenceFragment = target.closest('.sentence-fragment');

            if (sentenceFragment) {
              const segmentIndex = parseInt(sentenceFragment.getAttribute('data-sentence-index') || '-1');
              if (segmentIndex !== -1) {
                console.log('✓ Playing segment', segmentIndex);
                playSegment(segmentIndex);
              }
            }
          });

          pageContainer.appendChild(textLayerDiv);
        }

        if (isCancelled) return;
        container.appendChild(pageContainer);

        allSegments.push(...pageSegments);
        segmentOffset += pageSegments.length;
      }

      if (isCancelled) return;
      loadSegments(allSegments);
    };

    renderAllPages();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDocument]);

  // Sync Highlight with Playback - updated for wrapped structure
  useEffect(() => {
    // Always clear old state
    document.querySelectorAll('.sentence-fragment.playing').forEach(el => {
      el.classList.remove('playing');
    });

    // Only highlight when a segment is selected (any non-idle status)
    if (!storeSegments.length || playbackStatus === 'idle') return;

    if (currentSegmentIndex >= 0 && currentSegmentIndex < storeSegments.length) {
      const currentElements = document.querySelectorAll(
        `.sentence-fragment[data-sentence-index="${currentSegmentIndex}"]`
      );
      currentElements.forEach(el => el.classList.add('playing'));
    }
  }, [currentSegmentIndex, storeSegments, playbackStatus]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading PDF...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        ref={containerRef}
        className="pdf-container border border-gray-300 shadow-lg overflow-y-auto"
        style={{
          maxHeight: '80vh',
          padding: '20px'
        }}
      />
    </div>
  );
};
