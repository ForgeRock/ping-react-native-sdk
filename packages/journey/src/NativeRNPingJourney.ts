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
  configureJourney(config: Object): Promise<string>;

  /**
   * Start a Journey by name.
   */
  start(journeyId: string, journeyName: string, options?: JourneyOptions): Promise<Node>;

  /**
   * Advance to the next node.
   */
  next(journeyId: string, nodeId: string, input: Object): Promise<Node>;

  /**
   * Resume a suspended Journey (e.g., magic link).
   */
  resume(journeyId: string, uri: string): Promise<Node>;

  /**
   * Get an existing session if available.
   */
  getSession(journeyId: string): Promise<Object | null>;

  /**
   * Logout and clear session.
   */
  logout(journeyId: string): Promise<boolean>;

  /**
   * POC only TM to show registered Storages from core
   * Return list of storage IDs 
   * */
  listRegisteredStoragesFromCore(): Promise<string[]>;
}


export default TurboModuleRegistry.getEnforcing<Spec>('RNPingJourney');
