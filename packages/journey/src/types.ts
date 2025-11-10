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
