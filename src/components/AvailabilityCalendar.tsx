'use client';

import { useEffect, useState } from 'react';

type AvailDate = { id: string; date: string; note: string | null };

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function AvailabilityCalendar({ profileId }: { profileId: string }) {
  const [dates, setDates] = useState<AvailDate[]>([]);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  useEffect(() => {
    fetch(`/api/profile/availability?profileId=${profileId}`)
      .then((r) => r.json())
      .then((data) => setDates(data.dates ?? []))
      .catch(() => {});
  }, [profileId]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const availSet = new Set(
    dates.map((d) => {
      const dt = new Date(d.date);
      return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
    })
  );

  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  function prev() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function next() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div style={{ maxWidth: 320 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button className="button small secondary" onClick={prev}>‹</button>
        <strong style={{ fontSize: 14 }}>{monthLabel}</strong>
        <button className="button small secondary" onClick={next}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, fontSize: 12 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 700, opacity: 0.5, padding: '2px 0' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const key = `${year}-${month}-${day}`;
          const available = availSet.has(key);
          return (
            <div
              key={day}
              title={available ? 'Available' : undefined}
              style={{
                textAlign: 'center',
                padding: '4px 2px',
                borderRadius: 4,
                background: available ? 'var(--accent, #ff3e9a)' : 'transparent',
                color: available ? '#fff' : undefined,
                fontWeight: available ? 700 : undefined,
              }}
            >
              {day}
            </div>
          );
        })}
      </div>
      {dates.length === 0 && (
        <p className="meta" style={{ marginTop: 8 }}>No available dates listed yet.</p>
      )}
    </div>
  );
}
