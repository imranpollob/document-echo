'use client';

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Import TextLayerBuilder from web/pdf_viewer.mjs (explicit path)
// @ts-ignore
import { TextLayerBuilder } from 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import { TextNormalizer } from '../utils/TextNormalizer';
import { useAudioStore } from '../store/useAudioStore';

// Set worker src
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

interface PdfViewerProps {
  file: File | null;
}

export const PdfViewer = ({ file }: PdfViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Store actions
  const loadSegments = useAudioStore(state => state.loadSegments);

  useEffect(() => {
    if (!file) return;

    const loadPdf = async () => {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      setPdfDocument(doc);
      setCurrentPage(1);
    };

    loadPdf();
  }, [file]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    if (!pdfDocument) return;

    const renderPage = async () => {
      // Cancel previous render
      if (renderTaskRef.current) {
        try {
          await renderTaskRef.current.cancel();
        } catch (e) {
          // Ignore cancel errors
        }
      }

      const page = await pdfDocument.getPage(currentPage);

      const viewport = page.getViewport({ scale: 1.5 });

      // Render Canvas
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas && context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        // @ts-ignore
        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        try {
          await renderTask.promise;
        } catch (error: any) {
          if (error?.name === 'RenderingCancelledException') {
            return; // Cancelled
          }
          console.error("Render error", error);
        }
      }

      // Render Text Layer
      const container = textLayerRef.current;
      if (container) {
        container.innerHTML = ''; // Clear previous
        // We don't set styles on container, we let textLayer do it or we wrap it.
        // Actually we need to size the container to match viewport so absolute positioning works.
        container.style.height = `${viewport.height}px`;
        container.style.width = `${viewport.width}px`;
        container.style.setProperty('--scale-factor', `${viewport.scale}`);

        const textContent = await page.getTextContent();

        // Extract and Normalize Text (Step 2)
        const segments = TextNormalizer.normalize(textContent.items, currentPage);
        // Avoid setting state if we are unmounted or cancelled? 
        // Zustand set is safe, but logic might be weird if fast switching.
        loadSegments(segments);

        // Use TextLayerBuilder
        const textLayer = new TextLayerBuilder({
          pdfPage: page,
        });

        // Render returns a promise
        await textLayer.render({ viewport });

        if (textLayer.div) {
          container.appendChild(textLayer.div);
        }
      }
    };

    renderPage();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDocument, currentPage, loadSegments]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative border border-gray-300 shadow-lg inline-block">
        <canvas ref={canvasRef} className="block" />
        <div
          ref={textLayerRef}
          className="absolute top-0 left-0 z-10"
          style={{ pointerEvents: 'auto' }}
        ></div>
      </div>

      {pdfDocument && (
        <div className="flex gap-4 items-center">
          <button
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {currentPage} of {pdfDocument.numPages}</span>
          <button
            disabled={currentPage >= pdfDocument.numPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      <style jsx global>{`
                /* Ensure textLayer class from pdfjs-dist matches our needs */
                .textLayer {
                     position: absolute;
                     text-align: initial;
                     top: 0;
                     left: 0;
                     right: 0;
                     bottom: 0;
                     overflow: hidden;
                     opacity: 0.2;
                     line-height: 1.0;
                     pointer-events: auto;
                }
                .textLayer > span {
                    color: transparent;
                    position: absolute;
                    white-space: pre;
                    cursor: text;
                    transform-origin: 0% 0%;
                }
                .textLayer .highlight {
                    background-color: yellow; 
                    opacity: 0.5;
                }
            `}</style>
    </div>
  );
};
