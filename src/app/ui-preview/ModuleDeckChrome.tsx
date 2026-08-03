import type { CSSProperties, ReactNode } from 'react';

export type ModuleId = 'map' | 'discover' | 'radio' | 'dashboard' | 'settings' | 'community';

export const modules: Array<{ id: ModuleId; label: string; mobileLabel?: string; eyebrow: string; detail: string; primary: boolean }> = [
  { id: 'map', label: 'Around you', eyebrow: '01 / Scene map', detail: 'Venues, artists, and events in reach', primary: true },
  { id: 'discover', label: 'Discover', eyebrow: '02 / Discovery', detail: 'Swipe through music outside your orbit', primary: true },
  { id: 'radio', label: 'Radio', eyebrow: '03 / Live radio', detail: 'Shows by sound, scene, and subject', primary: true },
  { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Me', eyebrow: '04 / Your signal', detail: 'The view that fits your role', primary: true },
  { id: 'settings', label: 'Settings', eyebrow: '05 / Control room', detail: 'Privacy, playback, and notifications', primary: false },
  { id: 'community', label: 'Community', eyebrow: '06 / Open book', detail: 'Voting, transparency, legal, and DMCA', primary: false },
];

export function ModuleIntro({ children, className, description, kicker, title, titleId }: {
  children?: ReactNode;
  className: string;
  description: ReactNode;
  kicker: ReactNode;
  title: ReactNode;
  titleId: string;
}) {
  return <div className={`module-intro ${className}`}><span className="deck-kicker">{kicker}</span><h1 id={titleId}>{title}</h1><p>{description}</p>{children}</div>;
}

export function ModuleNavigator({ activeIndex, menuOpen, onChange }: { activeIndex: number; menuOpen: boolean; onChange: (index: number) => void }) {
  return <aside aria-hidden={!menuOpen} className={`deck-navigator ${menuOpen ? 'is-open' : ''}`}>
    <div className="deck-nav-heading"><span>MOVE THROUGH iHYPE</span><small>Choose a module</small></div>
    <nav aria-label="iHYPE modules">{modules.map((item, index) => <button aria-current={activeIndex === index ? 'page' : undefined} className={item.primary ? 'is-primary-module' : 'is-utility-module'} key={item.id} onClick={() => onChange(index)} style={{ '--nav-index': index } as CSSProperties} tabIndex={menuOpen ? 0 : -1} type="button"><span>0{index + 1}</span><strong><span className="deck-nav-label-desktop">{item.label}</span><span className="deck-nav-label-mobile">{item.mobileLabel ?? item.label}</span></strong><small>{item.detail}</small><i>↗</i></button>)}</nav>
    <div className="deck-nav-footer"><span>Discover Local Music</span><b>|</b><span>Support The Scene</span><b>|</b><span>Be The Signal</span><small><kbd>/</kbd> Search <kbd>Space</kbd> Play <kbd>H</kbd> HYPE</small></div>
  </aside>;
}
