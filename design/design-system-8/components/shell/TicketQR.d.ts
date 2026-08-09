export interface TicketQRProps {
  /** Wallet code. The matrix is derived from it, so it is stable per ticket. */
  code: string;
  /** Rendered edge length in px. Default 188. */
  size?: number;
  /** Caption under the block, e.g. the code itself. */
  label?: string;
  /** `light` prints dark modules on white (what a scanner wants); `dark`
   *  inverts for use on the ink ground. Default `light`. */
  tone?: 'light' | 'dark';
}

export declare function TicketQR(props: TicketQRProps): JSX.Element;
