export interface ArcSlot { x: number; y: number; d: number }
export interface ArcNavItem { id: string; label: string; href?: string }
export interface ArcNavModule extends ArcNavItem { items?: ArcNavItem[] }
export interface ArcNavProps {
  /** PREFERRED from a template: { expanded } as one object, so the update
   *  cannot be missed by a mount. Overrides the flat prop below when present. */
  nav?: { expanded?: boolean };
  /** Named `expanded` because `open` is a reserved HTML attribute. */
  expanded?: boolean;
  /**
   * The modules, in arc order — one 66px icon disc each, drawn from the id
   * (`map`, `music`, `me`). There is no second level: Music's sections are tabs
   * at the top of the Music pane. `items` is ignored here and kept only so the
   * shell can hold the route table in one place.
   */
  modules: ArcNavModule[];
  activeModule?: string;
  onNavigate?: (item: ArcNavModule) => void;
  onClose?: () => void;
}
export declare const ARC: Record<"wide" | "narrow", { level1: ArcSlot[] }>;
export declare const ARC_NARROW_MAX_WIDTH: number;
export declare function ArcNav(props: ArcNavProps): JSX.Element;
