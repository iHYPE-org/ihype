export interface ScrimProps {
  /** PREFERRED from a template: { visible } as one object. */
  state?: { visible?: boolean };
  visible?: boolean;
  onClick?: () => void;
  tint?: string;
}
export interface VignetteProps {
  /** Alpha of the outer edge, 0–1. */
  strength?: number;
}
export declare function Scrim(props: ScrimProps): JSX.Element;
export declare function Vignette(props: VignetteProps): JSX.Element;
