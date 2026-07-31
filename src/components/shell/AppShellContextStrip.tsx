'use client';

import { useI18n } from '@/components/I18nProvider';
import { SegmentedTabs } from '@/components/shell/SegmentedTabs';
import { sectionTabs, type ShellNavItem, type ShellSectionId } from '@/lib/app-nav';

/**
 * The persistent context strip: an Eyebrow naming the active section, then the
 * sibling-route pills for it. "Purpose: move within a section without opening
 * the drawer. The drawer is for jumping between sections."
 */
const SECTION_LABEL: Record<ShellSectionId, [string, string]> = {
  LISTEN: ['appShell.section.listen', 'Listen'],
  EVENTS: ['appShell.section.events', 'Events'],
  PAGES: ['appShell.section.pages', 'Pages'],
  SETTINGS: ['appShell.section.settings', 'Settings'],
};

export function AppShellContextStrip({
  items,
  section,
  activeItemId,
}: {
  items: ShellNavItem[];
  section: ShellSectionId;
  activeItemId: string | null;
}) {
  const { t } = useI18n();
  const tabs = sectionTabs(items, section);
  const [labelKey, labelFallback] = SECTION_LABEL[section];

  return (
    <div className="shell-context-strip">
      <span className="shell-eyebrow shell-context-strip-label" style={{ color: 'var(--ink-3)' }}>
        {t(labelKey, labelFallback)}
      </span>
      <SegmentedTabs
        items={tabs.map((item) => ({
          id: item.id,
          href: item.href,
          label: t(item.labelKey, item.labelFallback),
          active: item.id === activeItemId,
        }))}
        label={t('appShell.sectionTabsAriaLabel', 'Section')}
        mode="nav"
      />
    </div>
  );
}
