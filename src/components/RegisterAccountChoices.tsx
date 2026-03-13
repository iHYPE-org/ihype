'use client';

import Link from 'next/link';

type RegisterRole = 'FAN' | 'ARTIST' | 'DJ' | 'VENUE';

type RegisterAccountChoicesProps = {
  activeRole: RegisterRole;
};

const registerChoices: Array<{
  role: RegisterRole;
  label: string;
  href: string;
}> = [
  { role: 'FAN', label: 'Listener', href: '/register' },
  { role: 'ARTIST', label: 'Artist', href: '/register/artist' },
  { role: 'DJ', label: 'Promoter', href: '/register/promoter' },
  { role: 'VENUE', label: 'Venue', href: '/register/venue' }
];

export function RegisterAccountChoices({ activeRole }: RegisterAccountChoicesProps) {
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
