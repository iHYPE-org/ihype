'use client';

import { useState } from 'react';

interface Props {
  text: string;
  lines?: number;
}

export function CollapsibleText({ text, lines = 3 }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  return (
    <div className="collapsible-text">
      <div
        className={`collapsible-text-content${expanded ? ' expanded' : ''}`}
        style={
          expanded
            ? {}
            : {
                display: '-webkit-box',
                WebkitLineClamp: lines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
        }
      >
        {text}
      </div>
      <button
        className="collapsible-text-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
    </div>
  );
}
