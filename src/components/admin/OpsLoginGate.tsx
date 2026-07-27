'use client';
import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/components/I18nProvider';

const STEP_KEYS = [
  'attestingDevice',
  'resolvingOperatorRole',
  'satisfyingMfa',
  'mintingSessionToken',
  'writingLedgerEntry',
  'resumingAutomations',
] as const;

const STEP_FALLBACKS: Record<(typeof STEP_KEYS)[number], string> = {
  attestingDevice: 'Attesting device',
  resolvingOperatorRole: 'Resolving operator role',
  satisfyingMfa: 'Satisfying MFA',
  mintingSessionToken: 'Minting session token',
  writingLedgerEntry: 'Writing ledger entry',
  resumingAutomations: 'Resuming automations',
};

function initials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'OP';
}

type Phase = 'login' | 'provisioning' | 'done';

interface Props {
  name?: string | null;
  email?: string | null;
  children: React.ReactNode;
}

export function OpsLoginGate({ name, email, children }: Props) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>('login');
  const [ready, setReady] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem('ops_provisioned') === '1') {
      setPhase('done');
    }
    setReady(true);
  }, []);

  function startProvisioning() {
    setPhase('provisioning');
    setActiveStep(0);
    let step = 0;
    function tick() {
      setCompletedSteps(prev => [...prev, step]);
      step++;
      if (step < STEP_KEYS.length) {
        setActiveStep(step);
        timerRef.current = setTimeout(tick, 420 + Math.random() * 180);
      } else {
        setActiveStep(null);
        setTimeout(() => {
          sessionStorage.setItem('ops_provisioned', '1');
          setPhase('done');
        }, 600);
      }
    }
    timerRef.current = setTimeout(tick, 520);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!ready || phase === 'done') return <>{children}</>;

  const ops = initials(name, email);
  const displayName = name ?? email ?? t('opsLoginGate.operator', 'Operator');
  const displayEmail = email ?? '';

  return (
    <div className="ops-gate">
      {phase === 'login' && (
        <div className="ops-login-card">
          <div className="ops-login-top">
            <span className="ops-wordmark">iH<span className="ops-dot">·</span><span className="ops-ops">OPS</span></span>
            <span className="ops-chip">{t('opsLoginGate.operatorChip', 'OPERATOR')}</span>
          </div>

          <div className="ops-identity">
            <div className="ops-avatar">{ops}</div>
            <div className="ops-identity-text">
              <strong>{displayName}</strong>
              <span>{displayEmail}</span>
            </div>
          </div>

          <div className="ops-trust-facts">
            <div className="ops-trust-fact">
              <span className="ops-trust-label">{t('opsLoginGate.device', 'Device')}</span>
              <span className="ops-trust-value ops-trust-ok">✓ {t('opsLoginGate.recognized', 'Recognized')}</span>
            </div>
            <div className="ops-trust-fact">
              <span className="ops-trust-label">{t('opsLoginGate.passkey', 'Passkey')}</span>
              <span className="ops-trust-value ops-trust-ok">✓ {t('opsLoginGate.registered', 'Registered')}</span>
            </div>
            <div className="ops-trust-fact">
              <span className="ops-trust-label">{t('opsLoginGate.role', 'Role')}</span>
              <span className="ops-trust-value">{t('opsLoginGate.operatorChip', 'OPERATOR')}</span>
            </div>
            <div className="ops-trust-fact">
              <span className="ops-trust-label">{t('opsLoginGate.session', 'Session')}</span>
              <span className="ops-trust-value">{t('opsLoginGate.sessionTtl', '8 h TTL')}</span>
            </div>
          </div>

          <p className="ops-login-sub">
            {t('opsLoginGate.loginSub', 'Sign-in is automated — your device and passkey are on file. No password required.')}
          </p>

          <button className="ops-cta" onClick={startProvisioning}>
            {t('opsLoginGate.continueCta', 'Continue with trusted device')}
          </button>

          <div className="ops-governance">
            <span>{t('opsLoginGate.governanceLedger', 'Public ledger · obfuscated to cohort_op_1')}</span>
            <span>{t('opsLoginGate.governanceBans', 'Bans >7 days require member vote')}</span>
          </div>
        </div>
      )}

      {phase === 'provisioning' && (
        <div className="ops-provisioning-card">
          <div className="ops-login-top">
            <span className="ops-wordmark">iH<span className="ops-dot">·</span><span className="ops-ops">OPS</span></span>
          </div>
          <p className="ops-prov-title">{t('opsLoginGate.settingUpSession', 'Setting up your session')}</p>
          <div className="ops-steps">
            {STEP_KEYS.map((stepKey, i) => {
              const done = completedSteps.includes(i);
              const active = activeStep === i;
              return (
                <div key={stepKey} className={`ops-step${done ? ' ops-step-done' : active ? ' ops-step-active' : ''}`}>
                  <span className="ops-step-icon">
                    {done ? '✓' : active ? <span className="ops-spin">⟳</span> : '○'}
                  </span>
                  <span>{t(`opsLoginGate.step.${stepKey}`, STEP_FALLBACKS[stepKey])}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
