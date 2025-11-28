export type Node = {
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

export type JourneyConfig = {
  serverUrl: string;
  realm?: string;
  cookie?: string;
  clientId?: string;
  discoveryEndpoint?: string;
  redirectUri?: string;
  scopes?: string[];
};

// Represents user claims from OIDC `userinfo()` endpoint
export type JourneyUserInfo = Record<string, string | number | boolean | null>;

// Represents the combined session + tokens structure returned from Swift
export interface JourneyUserSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  userInfo?: JourneyUserInfo;
}


/**
 * Optional flags when starting a Journey.
 */
export type JourneyOptions = {
  forceAuth?: boolean;
  noSession?: boolean;
};

export type JourneyClient = {
  /** Explicit initialization helper for app startup */
  init: () => Promise<any>;
  
  /** Returns the native journeyId */
  getId: () => Promise<string>;

  /** Start a journey */
  start: (journeyName: string, options?: any) => Promise<Node>;

  /** Continue an active flow */
  next: (nodeId: string, input: Record<string, any>) => Promise<Node>;

  /** Resume a suspended flow */
  resume: (uri: string) => Promise<Node>;

  /** Retrieve session */
  user: () => Promise<JourneyUserSession | null>;

  /** Logout */
  logoutUser: () => Promise<boolean>;
};

