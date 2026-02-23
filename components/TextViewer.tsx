'use client';

import { useEffect, useRef } from 'react';
import { useAudioStore } from '../store/use-audio-store';

export const TextViewer = () => {
  const segments = useAudioStore(state => state.segments);
  const currentSegmentIndex = useAudioStore(state => state.currentSegmentIndex);
  const playbackStatus = useAudioStore(state => state.playbackStatus);
  const playSegment = useAudioStore(state => state.playSegment);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current sentence during playback
  useEffect(() => {
    if (playbackStatus === 'idle') return;
    const el = document.getElementById(`text-seg-${currentSegmentIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSegmentIndex, playbackStatus]);

  if (!segments.length) return null;

  return (
    <div ref={containerRef} className="text-viewer">
      {segments.map((segment, index) => (
        <span
          key={segment.id}
          id={`text-seg-${index}`}
          className={`text-segment${playbackStatus !== 'idle' && currentSegmentIndex === index ? ' playing' : ''
            }`}
          onClick={() => playSegment(index)}
        >
          {segment.text}{' '}
        </span>
      ))}
    </div>
  );
};
