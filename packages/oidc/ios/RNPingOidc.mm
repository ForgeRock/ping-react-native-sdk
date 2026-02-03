#import "RNPingOidc.h"
#import "RCTDefaultReactNativeFactoryDelegate.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

#import "RNPingOidc-Swift.h"

@implementation RNPingOidc
RCT_EXPORT_MODULE()

// Helper to get the Swift singleton.
- (RNPingOidcImpl *)swiftImpl
{
  return [RNPingOidcImpl shared];
}

// Clean up native resources when the bridge is invalidated.
- (void)invalidate
{
  [[self swiftImpl] invalidate];
}

// createClient(config): string
- (NSString *)createClient:(JS::NativeRNPingOidc::NativeOidcClientConfig &)config
{
  NSMutableDictionary *dict = [NSMutableDictionary new];

  NSString *clientId = config.clientId();
  if (clientId != nil) {
    dict[@"clientId"] = clientId;
  }

  NSString *discoveryEndpoint = config.discoveryEndpoint();
  if (discoveryEndpoint != nil) {
    dict[@"discoveryEndpoint"] = discoveryEndpoint;
  }

  auto openId = config.openId();
  if (openId.has_value()) {
    auto openIdValue = openId.value();
    NSMutableDictionary *openIdDict = [NSMutableDictionary new];
    openIdDict[@"authorizationEndpoint"] = openIdValue.authorizationEndpoint();
    openIdDict[@"tokenEndpoint"] = openIdValue.tokenEndpoint();
    openIdDict[@"userinfoEndpoint"] = openIdValue.userinfoEndpoint();
    NSString *endSessionEndpoint = openIdValue.endSessionEndpoint();
    if (endSessionEndpoint != nil) {
      openIdDict[@"endSessionEndpoint"] = endSessionEndpoint;
    }
    NSString *pingEndIdpSessionEndpoint = openIdValue.pingEndIdpSessionEndpoint();
    if (pingEndIdpSessionEndpoint != nil) {
      openIdDict[@"pingEndIdpSessionEndpoint"] = pingEndIdpSessionEndpoint;
    }
    NSString *revocationEndpoint = openIdValue.revocationEndpoint();
    if (revocationEndpoint != nil) {
      openIdDict[@"revocationEndpoint"] = revocationEndpoint;
    }
    dict[@"openId"] = openIdDict;
  }

  NSString *redirectUri = config.redirectUri();
  if (redirectUri != nil) {
    dict[@"redirectUri"] = redirectUri;
  }

  NSMutableArray<NSString *> *scopes = [NSMutableArray new];
  for (auto scope : config.scopes()) {
    [scopes addObject:scope];
  }
  dict[@"scopes"] = scopes;

  NSString *storageId = config.storageId();
  if (storageId != nil) {
    dict[@"storageId"] = storageId;
  }

  NSString *loggerId = config.loggerId();
  if (loggerId != nil) {
    dict[@"loggerId"] = loggerId;
  }

  NSString *acrValues = config.acrValues();
  if (acrValues != nil) {
    dict[@"acrValues"] = acrValues;
  }

  NSString *signOutRedirectUri = config.signOutRedirectUri();
  if (signOutRedirectUri != nil) {
    dict[@"signOutRedirectUri"] = signOutRedirectUri;
  }

  NSString *state = config.state();
  if (state != nil) {
    dict[@"state"] = state;
  }

  NSString *nonce = config.nonce();
  if (nonce != nil) {
    dict[@"nonce"] = nonce;
  }

  NSString *uiLocales = config.uiLocales();
  if (uiLocales != nil) {
    dict[@"uiLocales"] = uiLocales;
  }

  auto refreshThreshold = config.refreshThreshold();
  if (refreshThreshold.has_value()) {
    dict[@"refreshThreshold"] = @(refreshThreshold.value());
  }

  NSString *loginHint = config.loginHint();
  if (loginHint != nil) {
    dict[@"loginHint"] = loginHint;
  }

  NSString *display = config.display();
  if (display != nil) {
    dict[@"display"] = display;
  }

  NSString *prompt = config.prompt();
  if (prompt != nil) {
    dict[@"prompt"] = prompt;
  }

  id<NSObject> additionalParameters = config.additionalParameters();
  if (additionalParameters != nil) {
    dict[@"additionalParameters"] = additionalParameters;
  }

  return [[self swiftImpl] createClient:dict];
}

// createWebClient(clientId): string
- (NSString *)createWebClient:(NSString *)clientId
{
  return [[self swiftImpl] createWebClient:clientId];
}

// clientToken(clientId): Promise<Tokens>
- (void)clientToken:(NSString *)clientId
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] clientToken:clientId resolver:resolve rejecter:reject];
}

// clientRefresh(clientId): Promise<Tokens>
- (void)clientRefresh:(NSString *)clientId
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] clientRefresh:clientId resolver:resolve rejecter:reject];
}

// clientUserinfo(clientId, cache): Promise<Record<string, unknown>>
- (void)clientUserinfo:(NSString *)clientId
                 cache:(BOOL)cache
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] clientUserinfo:clientId cache:cache resolver:resolve rejecter:reject];
}

// clientRevoke(clientId): Promise<void>
- (void)clientRevoke:(NSString *)clientId
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] clientRevoke:clientId
                        resolver:^{
                          resolve([NSNull null]);
                        }
                        rejecter:reject];
}

// clientEndSession(clientId): Promise<boolean>
- (void)clientEndSession:(NSString *)clientId
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] clientEndSession:clientId
                        resolver:^(BOOL value) {
                          resolve(@(value));
                        }
                        rejecter:reject];
}

// authorize(webClientId, options): Promise<OidcAuthorizeResult>
- (void)authorize:(NSString *)webClientId
          options:(JS::NativeRNPingOidc::NativeOidcAuthorizeOptions &)options
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  NSMutableDictionary *dict = [NSMutableDictionary new];
  NSString *acrValues = options.acrValues();
  if (acrValues != nil) {
    dict[@"acrValues"] = acrValues;
  }
  NSString *state = options.state();
  if (state != nil) {
    dict[@"state"] = state;
  }
  NSString *nonce = options.nonce();
  if (nonce != nil) {
    dict[@"nonce"] = nonce;
  }
  NSString *uiLocales = options.uiLocales();
  if (uiLocales != nil) {
    dict[@"uiLocales"] = uiLocales;
  }
  NSString *loginHint = options.loginHint();
  if (loginHint != nil) {
    dict[@"loginHint"] = loginHint;
  }
  NSString *display = options.display();
  if (display != nil) {
    dict[@"display"] = display;
  }
  NSString *prompt = options.prompt();
  if (prompt != nil) {
    dict[@"prompt"] = prompt;
  }
  id<NSObject> additionalParameters = options.additionalParameters();
  if (additionalParameters != nil) {
    dict[@"additionalParameters"] = additionalParameters;
  }
  [[self swiftImpl] authorize:webClientId options:dict resolver:resolve rejecter:reject];
}

// hasUser(webClientId): Promise<boolean>
- (void)hasUser:(NSString *)webClientId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] hasUser:webClientId
                   resolver:^(BOOL value) {
                     resolve(@(value));
                   }
                   rejecter:reject];
}

// token(webClientId): Promise<Tokens>
- (void)token:(NSString *)webClientId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] token:webClientId resolver:resolve rejecter:reject];
}

// refresh(webClientId): Promise<Tokens>
- (void)refresh:(NSString *)webClientId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] refresh:webClientId resolver:resolve rejecter:reject];
}

// userinfo(webClientId, cache): Promise<Record<string, unknown>>
- (void)userinfo:(NSString *)webClientId
           cache:(BOOL)cache
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] userinfo:webClientId
                       cache:cache
                    resolver:resolve
                    rejecter:reject];
}

// revoke(webClientId): Promise<void>
- (void)revoke:(NSString *)webClientId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] revoke:webClientId
                  resolver:^{
                    resolve([NSNull null]);
                  }
                  rejecter:reject];
}

// logout(webClientId): Promise<void>
- (void)logout:(NSString *)webClientId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] logout:webClientId
                  resolver:^{
                    resolve([NSNull null]);
                  }
                  rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNPingOidcSpecJSI>(params);
}

@end
