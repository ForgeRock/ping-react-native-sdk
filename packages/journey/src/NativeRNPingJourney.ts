import { TurboModuleRegistry, type TurboModule } from 'react-native';

 type Node = {
  id: string;
  type: 'ContinueNode' | 'ErrorNode' | 'FailureNode' | 'SuccessNode';
  message?: string;
  cause?: string;
  session?: Object;
  callbacks?: Array<{
    type: string;
    prompt?: string;
    value?: Object;
  }>;
};

/**
 * Optional flags when starting a Journey.
 */
export type JourneyOptions = {
  forceAuth?: boolean;
  noSession?: boolean;
};

export interface Spec extends TurboModule {
  /**
   * Configure the Journey SDK.
   */
  configureJourney(config: Object): Promise<boolean>;

  /**
   * Start a Journey by name.
   */
  start(journeyName: string, options?: JourneyOptions): Promise<Node>;

  /**
   * Advance to the next node.
   */
  next(nodeId: string, input: Object): Promise<Node>;

  /**
   * Resume a suspended Journey (e.g., magic link).
   */
  resume(uri: string): Promise<Node>;

  /**
   * Get an existing session if available.
   */
  getSession(): Promise<Object | null>;

  /**
   * Logout and clear session.
   */
  logout(): Promise<boolean>;
}


export default TurboModuleRegistry.getEnforcing<Spec>('RNPingJourney');
