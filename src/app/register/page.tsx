import type { Metadata } from 'next';
import { RegisterAccountChoices } from '@/components/RegisterAccountChoices';

export const metadata: Metadata = {
  title: 'Sign Up | iHYPE.org',
  description: 'Choose an account type to create your iHYPE.org account.',
  robots: {
    index: false,
    follow: false
  }
};

export default function RegisterPage() {
  return (
    <main className="container section register-shell">
      <div className="register-grid">
        <section className="panel register-panel register-choice-panel">
          <div className="register-choice-hero">
            <div>
              <div className="badge">Create your account</div>
              <h1 className="register-choice-title">Choose the lane that matches what you want to do on iHYPE.</h1>
            </div>
            <p className="subtitle">
              Every role gets a cleaner setup path, its own discover workspace, and the tools that belong to that
              type of page.
            </p>
          </div>

          <div className="register-choice-status-strip" aria-label="Account setup benefits">
            <div className="register-choice-status-card">
              <span>Fast start</span>
              <strong>Short forms first</strong>
            </div>
            <div className="register-choice-status-card">
              <span>Cleaner setup</span>
              <strong>Role-based onboarding</strong>
            </div>
            <div className="register-choice-status-card">
              <span>Next step</span>
              <strong>Page builder after signup</strong>
            </div>
          </div>

          <RegisterAccountChoices variant="cards" />
        </section>
      </div>
    </main>
  );
}
