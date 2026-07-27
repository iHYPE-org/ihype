'use client';

import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

/**
 * Purely decorative "check off your next steps" ring + toggleable step rows
 * for /welcome, matching Welcome.dc.html's mockup — the design never
 * persisted this state to any backend field either, so local-only state is
 * a faithful translation, not a shortcut.
 */
export function WelcomeStepsChecklist({ steps, tint }: { steps: { title: string; desc: string }[]; tint: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState<boolean[]>(() => steps.map(() => false));
  const doneCount = done.filter(Boolean).length;
  const pct = steps.length ? (doneCount / steps.length) * 100 : 0;

  function toggle(i: number) {
    setDone((d) => d.map((v, idx) => (idx === i ? !v : v)));
  }

  return (
    <>
      <div className="welcome-steps-head">
        <div className="welcome-steps-label">{t('welcomeStepsChecklist.nextSteps', 'Next steps')}</div>
        <div
          className="welcome-ring"
          style={{ background: `conic-gradient(${tint} ${pct}%, var(--line) ${pct}%)` }}
        >
          <span>{doneCount}/{steps.length}</span>
        </div>
      </div>
      <div className="welcome-steps">
        {steps.map((s, i) => (
          <button
            className={`welcome-step${done[i] ? ' done' : ''}`}
            key={s.title}
            onClick={() => toggle(i)}
            type="button"
          >
            <span className="welcome-step-num">{done[i] ? '✓' : i + 1}</span>
            <div className="welcome-step-text">
              <div className="welcome-step-title">{s.title}</div>
              <div className="welcome-step-desc">{s.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
