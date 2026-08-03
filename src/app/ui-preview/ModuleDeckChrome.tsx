import type { CSSProperties, ReactNode } from 'react';

export type ModuleId = 'map' | 'discover' | 'radio' | 'dashboard' | 'settings' | 'community';

export const modules: Array<{ id: ModuleId; label: string; mobileLabel?: string; eyebrow: string; detail: string; primary: boolean }> = [
  { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Dashboard', eyebrow: '01 / Your signal', detail: 'Stats, recommendations, alerts, and plans', primary: true },
  { id: 'map', label: 'Around you', eyebrow: '02 / Scene map', detail: 'Venues, artists, and events in reach', primary: true },
  { id: 'discover', label: 'Discover', eyebrow: '03 / Discovery', detail: 'Swipe one local song at a time', primary: true },
  { id: 'radio', label: 'Radio', eyebrow: '04 / Live radio', detail: 'DJs by sound, scene, HYPE, and fit', primary: true },
  { id: 'community', label: 'Community', eyebrow: '05 / Open book', detail: 'Voting, transparency, legal, and DMCA', primary: true },
  { id: 'settings', label: 'Settings', eyebrow: '06 / Control room', detail: 'Privacy, playback, and accessibility', primary: true },
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
    <div className="deck-nav-heading"><span>THE SIX iHYPE MODULES</span><small>Everything lives in one of these places</small></div>
    <nav aria-label="iHYPE modules">{modules.map((item, index) => <button aria-current={activeIndex === index ? 'page' : undefined} className={item.primary ? 'is-primary-module' : 'is-utility-module'} key={item.id} onClick={() => onChange(index)} style={{ '--nav-index': index } as CSSProperties} tabIndex={menuOpen ? 0 : -1} type="button"><span>0{index + 1}</span><strong><span className="deck-nav-label-desktop">{item.label}</span><span className="deck-nav-label-mobile">{item.mobileLabel ?? item.label}</span></strong><small>{item.detail}</small><i>↗</i></button>)}</nav>
    <div className="deck-nav-footer"><span>Discover Local Music</span><b>|</b><span>Support The Scene</span><b>|</b><span>Be The Signal</span><small><kbd>/</kbd> Search <kbd>Space</kbd> Play <kbd>H</kbd> HYPE</small></div>
  </aside>;
}
