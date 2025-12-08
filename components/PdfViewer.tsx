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
  const segments = useAudioStore(state => state.segments);
  const currentSegmentIndex = useAudioStore(state => state.currentSegmentIndex);
  const playbackStatus = useAudioStore(state => state.playbackStatus);

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
  }, [file]);

  // Helper function to wrap sentences in custom highlight elements
  const wrapSentencesInTextLayer = (
    textLayerDiv: HTMLDivElement,
    segments: TextSegment[],
    pageNumber: number,
    segmentOffset: number
  ) => {
    const presentationSpans = textLayerDiv.querySelectorAll('span[role="presentation"]');

    presentationSpans.forEach((span) => {
      const htmlSpan = span as HTMLElement;
      const textContent = htmlSpan.textContent || '';

      if (!textContent.trim()) return;

      segments.forEach((segment, index) => {
        if (segment.pageNumber === pageNumber) {
          const segmentText = segment.text.trim();
          const spanText = textContent.trim();

          if (segmentText.includes(spanText) || spanText.includes(segmentText)) {
            const segmentIndex = segmentOffset + index;
            if (htmlSpan.querySelector('sentence-highlight')) return;

            const wrapper = document.createElement('sentence-highlight');
            wrapper.setAttribute('data-segment-index', segmentIndex.toString());
            wrapper.setAttribute('data-page', pageNumber.toString());
            wrapper.className = `segment-${segmentIndex}`;

            while (htmlSpan.firstChild) {
              wrapper.appendChild(htmlSpan.firstChild);
            }

            htmlSpan.appendChild(wrapper);
          }
        }
      });
    });
  };

  // Render all pages
  useEffect(() => {
    if (!pdfDocument || !containerRef.current) return;

    const renderAllPages = async () => {
      const container = containerRef.current;
      if (!container) return;

      container.innerHTML = ''; // Clear previous content

      const allSegments: TextSegment[] = [];
      let segmentOffset = 0;

      // Render each page
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        // Create page container
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container';
        pageContainer.style.position = 'relative';
        pageContainer.style.marginBottom = '20px';
        pageContainer.style.width = `${viewport.width}px`;

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

        pageContainer.appendChild(canvas);

        // Create text layer
        const textContent = await page.getTextContent();
        const segments = TextNormalizer.normalize(textContent.items, pageNum);

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

        if (textLayer.div) {
          // Copy children to our custom div
          while (textLayer.div.firstChild) {
            textLayerDiv.appendChild(textLayer.div.firstChild);
          }

          // Wrap sentences
          wrapSentencesInTextLayer(textLayerDiv, segments, pageNum, segmentOffset);

          // Add click handler
          textLayerDiv.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const sentenceEl = target.closest('sentence-highlight');

            if (sentenceEl) {
              const segmentIndex = parseInt(sentenceEl.getAttribute('data-segment-index') || '-1');
              if (segmentIndex !== -1) {
                console.log('✓ Playing segment', segmentIndex);
                playSegment(segmentIndex);
              }
            }
          });

          pageContainer.appendChild(textLayerDiv);
        }

        container.appendChild(pageContainer);

        allSegments.push(...segments);
        segmentOffset += segments.length;
      }

      loadSegments(allSegments);
    };

    renderAllPages();
  }, [pdfDocument, loadSegments, playSegment]);

  // Sync Highlight with Playback
  useEffect(() => {
    // Always clear old state
    document.querySelectorAll('sentence-highlight.playing').forEach(el => {
      el.classList.remove('playing');
    });

    // Only highlight while actively playing/paused
    if (!segments.length || playbackStatus === 'idle' || playbackStatus === 'loading') return;

    if (currentSegmentIndex >= 0 && currentSegmentIndex < segments.length) {
      const currentElements = document.querySelectorAll(
        `sentence-highlight[data-segment-index="${currentSegmentIndex}"]`
      );
      currentElements.forEach(el => el.classList.add('playing'));
    }
  }, [currentSegmentIndex, segments, playbackStatus]);

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
