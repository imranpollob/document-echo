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
  const scale = useAudioStore(state => state.scale);

  // Store actions
  const loadSegments = useAudioStore(state => state.loadSegments);
  const playSegment = useAudioStore(state => state.playSegment);
  const storeSegments = useAudioStore(state => state.segments);
  const currentSegmentIndex = useAudioStore(state => state.currentSegmentIndex);
  const playbackStatus = useAudioStore(state => state.playbackStatus);

  // Styles for sentence highlighting moved to app/globals.css

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
    // Build spanId -> ordered fragments so we can split multiple sentences inside one span
    const spanToFragments = new Map<string, { index: number; text: string }[]>();
    segments.forEach((segment, idx) => {
      const segmentIndex = segmentOffset + idx;
      const fragments = segment.spanFragments ?? [];
      fragments.forEach(fragment => {
        const bucket = spanToFragments.get(fragment.spanId) ?? [];
        bucket.push({ index: segmentIndex, text: fragment.text });
        spanToFragments.set(fragment.spanId, bucket);
      });
    });



    // Match generated spans to textItems (pdf.js generally aligns by index)
    let itemPtr = 0;
    textDivs.forEach((span) => {
      while (itemPtr < textItems.length && textItems[itemPtr].str.length === 0) {
        itemPtr++;
      }

      if (itemPtr < textItems.length) {
        const spanId = `page-${pageNumber}-span-${itemPtr}`;
        span.id = spanId;
        span.classList.add('segment-span');

        const fragments = spanToFragments.get(spanId);
        if (fragments && fragments.length > 0) {
          span.textContent = '';
          fragments.forEach(fragment => {
            if (fragment.text.trim().length === 0) return;

            const sentenceWrapper = document.createElement('nr-sentence');
            sentenceWrapper.className = `nr-s${fragment.index}`;
            sentenceWrapper.setAttribute('data-na-sen-ind', fragment.index.toString());
            sentenceWrapper.setAttribute('data-na-page-ind', pageNumber.toString());
            sentenceWrapper.textContent = fragment.text;

            span.appendChild(sentenceWrapper);
          });
        } else {
          // Log spans that didn't get matched

        }

        itemPtr++;
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
        const viewport = page.getViewport({ scale });

        // Create page container
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container';
        pageContainer.className = 'pdf-page-container styled-page-container';

        // Create canvas for the page
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.className = 'block pdf-canvas';

        const context = canvas.getContext('2d');
        if (context) {
          await page.render({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
          }).promise;
        }

        if (isCancelled) return;

        pageContainer.appendChild(canvas);

        // Create text layer
        const textContent = await page.getTextContent();
        const pageSegments = TextNormalizer.normalize(textContent.items, pageNum);

        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer pdf-textLayer';

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

          // Ensure pointer events and stacking for hover/click
          textLayer.div.classList.add('pdf-textLayer-inner');

          spans.forEach(s => {
            s.classList.add('pdf-span');
            s.querySelectorAll('nr-sentence').forEach(nr => {
              (nr as HTMLElement).classList.add('pdf-nr-sentence');
            });
          });

          // Copy children to our custom div (after tagging)
          while (textLayer.div.firstChild) {
            textLayerDiv.appendChild(textLayer.div.firstChild);
          }

          const sentencesCount = textLayerDiv.querySelectorAll('nr-sentence').length;


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
  }, [pdfDocument, scale]);



  // Global event delegation for hover and click
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let hoveredSegmentIndex: string | null = null;

    const setHoveredSegment = (index: string | null) => {
      document.querySelectorAll('nr-sentence.hovered').forEach(el => el.classList.remove('hovered'));
      if (index === null) {
        hoveredSegmentIndex = null;
        return;
      }
      document.querySelectorAll(`.nr-s${index}`).forEach(el => el.classList.add('hovered'));
      hoveredSegmentIndex = index;
    };

    const clearHover = () => setHoveredSegment(null);

    const handlePointerOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const sentenceElement = target.closest('nr-sentence');
      if (!sentenceElement) return;

      const segmentIndex = sentenceElement.getAttribute('data-na-sen-ind');
      if (!segmentIndex) return;

      if (segmentIndex !== hoveredSegmentIndex) {
        setHoveredSegment(segmentIndex);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const sentenceElement = target.closest('nr-sentence');
      if (sentenceElement) {
        const segmentIndex = parseInt(sentenceElement.getAttribute('data-na-sen-ind') || '-1', 10);

        playSegment(segmentIndex);
      }
    };

    // Use document-level delegation for pointerover (consistent with click)
    document.addEventListener('pointerover', handlePointerOver);
    // container.addEventListener('click', handleClick);
    document.addEventListener('click', handleClick);

    const handlePointerOut = (e: PointerEvent) => {
      if (!container.contains(e.relatedTarget as Node)) {
        clearHover();
      }
    };
    document.addEventListener('pointerout', handlePointerOut);

    return () => {
      document.removeEventListener('pointerover', handlePointerOver);
      // container.removeEventListener('click', handleClick);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('pointerout', handlePointerOut);
    };
  }, [playSegment]);

  // Sync Highlight with Playback - updated for wrapped structure
  useEffect(() => {
    // Always clear old state
    document.querySelectorAll('nr-sentence.playing').forEach(el => {
      el.classList.remove('playing');
    });

    // Only highlight when a segment is selected (any non-idle status)
    if (!storeSegments.length || playbackStatus === 'idle') return;

    if (currentSegmentIndex >= 0 && currentSegmentIndex < storeSegments.length) {
      // Use the class selector nr-s{index} to find all fragments
      const currentElements = document.querySelectorAll(`.nr-s${currentSegmentIndex}`);
      currentElements.forEach(el => el.classList.add('playing'));
    }
  }, [currentSegmentIndex, storeSegments, playbackStatus]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading PDF...</div>;
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full" style={{ position: 'relative' }}>
      {/* Zoom controls moved to AudioBar */}
      <div
        ref={containerRef}
        className="pdf-container"
      />
    </div>
  );
};
