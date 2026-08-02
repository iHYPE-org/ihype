import type { CSSProperties, ReactNode } from 'react';

export type ModuleId = 'map' | 'discover' | 'radio' | 'dashboard' | 'settings' | 'community';

export const modules: Array<{ id: ModuleId; label: string; eyebrow: string; detail: string }> = [
  { id: 'map', label: 'Around you', eyebrow: '01 / Scene map', detail: 'Venues, artists, and events in reach' },
  { id: 'discover', label: 'Discover', eyebrow: '02 / Discovery', detail: 'Swipe through music outside your orbit' },
  { id: 'radio', label: 'Radio', eyebrow: '03 / Live radio', detail: 'Shows by sound, scene, and subject' },
  { id: 'dashboard', label: 'Dashboard', eyebrow: '04 / Your signal', detail: 'The view that fits your role' },
  { id: 'settings', label: 'Settings', eyebrow: '05 / Control room', detail: 'Privacy, playback, and notifications' },
  { id: 'community', label: 'Community', eyebrow: '06 / Open book', detail: 'Voting, transparency, legal, and DMCA' },
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
    <nav aria-label="iHYPE modules">{modules.map((item, index) => <button aria-current={activeIndex === index ? 'page' : undefined} key={item.id} onClick={() => onChange(index)} style={{ '--nav-index': index } as CSSProperties} type="button"><span>0{index + 1}</span><strong>{item.label}</strong><small>{item.detail}</small><i>↗</i></button>)}</nav>
    <div className="deck-nav-footer"><span>Discover Local Music</span><b>|</b><span>Support The Scene</span><b>|</b><span>Be The Signal</span><small><kbd>/</kbd> Search <kbd>Space</kbd> Play <kbd>H</kbd> HYPE</small></div>
  </aside>;
}
