export interface ModulePaneProps {
  eyebrow?: string;
  title?: string;
  dek?: string;
  children?: React.ReactNode;
  maxWidth?: number;
  /** Reserves the chrome band. Do not set below 132 in the app shell. *
 * @startingPoint section="App Shell" subtitle="The single scroll container" viewport="700x420"
 */
  padBottom?: number;
}
export declare function ModulePane(props: ModulePaneProps): JSX.Element;
