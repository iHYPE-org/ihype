'use client';

import { buildTimelineClipStyle, type TimelineLaneItem } from './PromoterShowCreationUtils';

type PromoterShowCreationTimelineLaneProps = {
  label: string;
  emptyLabel: string;
  items: TimelineLaneItem[];
};

export function PromoterShowCreationTimelineLane({
  label,
  emptyLabel,
  items
}: PromoterShowCreationTimelineLaneProps) {
  return (
    <div className="composer-timeline-lane">
      <div className="composer-timeline-label">{label}</div>
      <div className="composer-timeline-track">
        {items.length ? (
          items.map((item, index) => (
            <span
              className={`composer-timeline-clip ${item.kind}`}
              key={item.id}
              style={buildTimelineClipStyle(index, items.length)}
              title={`${item.label} - ${item.meta}`}
            >
              <strong>{item.label}</strong>
              <small>{item.meta}</small>
            </span>
          ))
        ) : (
          <span className="composer-timeline-empty">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}
