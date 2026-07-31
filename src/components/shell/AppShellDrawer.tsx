'use client';

import Link from 'next/link';
import { useEffect, useId } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { NavRow } from '@/components/shell/NavRow';
import {
  SHELL_SECTIONS, sectionRows,
  type ShellNavItem, type ShellSectionId,
} from '@/lib/app-nav';

/**
 * The accordion drawer, per the handoff's chrome contract:
 *
 *   5. "The drawer is an overlay." It reserves no layout space, floats above
 *      content with a scrim, and dismisses on item selection or scrim click.
 *   6. Its top edge equals the context strip's bottom edge and its bottom
 *      edge clears the player — both supplied by the CSS vars AppShell sets,
 *      never hardcoded here.
 *
 * Accordion rule: opening one section collapses the others (single-open), and
 * opening a route also expands the section that owns it — which is why the
 * open section is *derived* from the active section, with a user toggle able
 * to override it (see AppShell's `openSection` state).
 */

const SECTION_ICON: Record<ShellSectionId, { stroke: string; path: React.ReactNode }> = {
  LISTEN: {
    stroke: 'var(--accent)',
    path: <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" />,
  },
  EVENTS: {
    stroke: 'var(--role-venue)',
    path: <><rect height="16" rx="3" width="18" x="3" y="5" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  },
  PAGES: {
    stroke: 'var(--role-fan)',
    path: <><rect height="18" rx="3" width="16" x="4" y="3" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  },
  SETTINGS: {
    stroke: 'var(--ink-2)',
    path: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
      </>
    ),
  },
};

const SECTION_LABEL: Record<ShellSectionId, [string, string]> = {
  LISTEN: ['appShell.section.listen', 'Listen'],
  EVENTS: ['appShell.section.events', 'Events'],
  PAGES: ['appShell.section.pages', 'Pages'],
  SETTINGS: ['appShell.section.settings', 'Settings'],
};

export function AppShellDrawer({
  open,
  items,
  openSection,
  activeItemId,
  onToggleSection,
  onClose,
}: {
  open: boolean;
  items: ShellNavItem[];
  openSection: ShellSectionId | null;
  activeItemId: string | null;
  onToggleSection: (section: ShellSectionId) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const panelIdBase = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div aria-hidden="true" className="shell-scrim" onClick={onClose} />
      <nav aria-label={t('appShell.drawerAriaLabel', 'iHYPE menu')} className="shell-drawer">
        <div className="shell-drawer-sections">
          {SHELL_SECTIONS.map((section) => {
            const rows = sectionRows(items, section);
            if (!rows.length) return null;
            const expanded = openSection === section;
            const panelId = `${panelIdBase}-${section}`;
            const icon = SECTION_ICON[section];
            const [labelKey, labelFallback] = SECTION_LABEL[section];
            return (
              <div className="shell-drawer-card" key={section}>
                <button
                  aria-controls={panelId}
                  aria-expanded={expanded}
                  className="shell-drawer-card-head"
                  onClick={() => onToggleSection(section)}
                  type="button"
                >
                  <span className="shell-drawer-card-title">
                    <svg
                      aria-hidden="true"
                      fill="none"
                      height="15"
                      stroke={icon.stroke}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.7"
                      viewBox="0 0 24 24"
                      width="15"
                    >
                      {icon.path}
                    </svg>
                    {t(labelKey, labelFallback)}
                  </span>
                  <span aria-hidden="true" className="shell-drawer-card-sign">{expanded ? '–' : '+'}</span>
                </button>
                {expanded ? (
                  <div className="shell-drawer-card-body" id={panelId}>
                    {rows.map((item) => (
                      <NavRow
                        active={item.id === activeItemId}
                        badge={item.badge}
                        href={item.href}
                        key={item.id}
                        label={t(item.labelKey, item.labelFallback)}
                        onNavigate={onClose}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* The charter card. Routes to Legal, per the handoff. */}
        <Link className="shell-charter-card" href="/legal" onClick={onClose}>
          <span className="shell-eyebrow" style={{ color: 'var(--role-venue)' }}>
            {t('appShell.charterEyebrow', 'THE CHARTER · 70/20/10')}
          </span>
          <span className="shell-charter-card-body">
            {t('appShell.charterBody', '70% artist · 20% venue · 10% promoter pool. iHYPE takes nothing.')}
          </span>
        </Link>
      </nav>
    </>
  );
}
