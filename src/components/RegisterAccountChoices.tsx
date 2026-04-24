'use client';

import Link from 'next/link';

type RegisterRole = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';

type RegisterAccountChoicesProps = {
  activeRole?: RegisterRole | null;
  variant?: 'chips' | 'cards';
};

const registerChoices: Array<{
  role: RegisterRole;
  label: string;
  href: string;
  summary: string;
  quickStart: string;
}> = [
  {
    role: 'FAN',
    label: 'Fan',
    href: '/register/fan',
    summary: 'Follow scenes, save music, and build a clean profile around what you hype.',
    quickStart: 'Fastest setup'
  },
  {
    role: 'ARTIST',
    label: 'Artist',
    href: '/register/artist',
    summary: 'Launch a page fast, upload music, and make yourself easier to book.',
    quickStart: 'Quick-start builder'
  },
  {
    role: 'DJ',
    label: 'Promoter',
    href: '/register/promoter',
    summary: 'Create shows, publish events, and build a discover lane around your nights.',
    quickStart: 'Show tools included'
  },
  {
    role: 'VENUE',
    label: 'Venue',
    href: '/register/venue',
    summary: 'Set up the room, schedule events, and prepare ticketing and booking details.',
    quickStart: 'Guided setup'
  }
];

export function RegisterAccountChoices({ activeRole, variant = 'chips' }: RegisterAccountChoicesProps) {
  if (variant === 'cards') {
    return (
      <div className="register-account-card-grid" aria-label="Choose account type">
        {registerChoices.map((choice) => (
          <Link
            className={choice.role === activeRole ? 'register-account-card active' : 'register-account-card'}
            href={choice.href}
            key={choice.role}
          >
            <div className="register-account-card-topline">
              <span className="badge">{choice.label}</span>
              <span className="register-account-card-kicker">{choice.quickStart}</span>
            </div>
            <strong>{choice.label} account</strong>
            <p>{choice.summary}</p>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="register-account-picker" aria-label="Choose account type">
      {registerChoices.map((choice) => (
        <Link
          className={choice.role === activeRole ? 'register-account-chip active' : 'register-account-chip'}
          href={choice.href}
          key={choice.role}
        >
          {choice.label}
        </Link>
      ))}
    </div>
  );
}
