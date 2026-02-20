//
//  RNPingJourney.mm
//  RNPingJourney
//

#import <string>
#import "RCTDefaultReactNativeFactoryDelegate.h"
#import "RNPingJourney.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

// Auto-generated Swift header
#import "RNPingJourney-Swift.h"

@implementation RNPingJourney
RCT_EXPORT_MODULE()

// Helper to get the Swift singleton
- (RNPingJourneyImpl *)swiftImpl {
  return [RNPingJourneyImpl shared];
}

// Clean up native resources when the bridge is invalidated.
- (void)invalidate
{
  [[self swiftImpl] invalidate];
}

// ------------------------------------------
// configureJourney(config): Promise<string>
// ------------------------------------------
- (void)configureJourney:(JS::NativeRNPingJourney::NativeJourneyConfig &)config
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject {
  NSLog(@"RNPingJourney: configureJourney called");
  NSMutableDictionary *dict = [NSMutableDictionary new];

  dict[@"serverUrl"] = config.serverUrl();
  auto timeout = config.timeout();
  if (timeout.has_value()) {
    dict[@"timeout"] = @(timeout.value());
  }

  NSString *realm = config.realm();
  if (realm != nil) {
    dict[@"realm"] = realm;
  }
  NSString *cookie = config.cookie();
  if (cookie != nil) {
    dict[@"cookie"] = cookie;
  }
  NSString *clientId = config.clientId();
  if (clientId != nil) {
    dict[@"clientId"] = clientId;
  }
  NSString *discoveryEndpoint = config.discoveryEndpoint();
  if (discoveryEndpoint != nil) {
    dict[@"discoveryEndpoint"] = discoveryEndpoint;
  }
  NSString *redirectUri = config.redirectUri();
  if (redirectUri != nil) {
    dict[@"redirectUri"] = redirectUri;
  }

  auto scopes = config.scopes();
  if (scopes.has_value()) {
    NSMutableArray<NSString *> *scopeArray = [NSMutableArray new];
    for (auto scope : scopes.value()) {
      [scopeArray addObject:scope];
    }
    dict[@"scopes"] = scopeArray;
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
  NSString *sessionStorageId = config.sessionStorageId();
  if (sessionStorageId != nil) {
    dict[@"sessionStorageId"] = sessionStorageId;
  }
  NSString *oidcStorageId = config.oidcStorageId();
  if (oidcStorageId != nil) {
    dict[@"oidcStorageId"] = oidcStorageId;
  }
  NSString *loggerId = config.loggerId();
  if (loggerId != nil) {
    dict[@"loggerId"] = loggerId;
  }
  NSString *oidcClientId = config.oidcClientId();
  if (oidcClientId != nil) {
    dict[@"oidcClientId"] = oidcClientId;
  }

  [[self swiftImpl] configureJourney:dict resolver:resolve rejecter:reject];
}

// ------------------------------------------
// start(journeyId, journeyName, options)
// ------------------------------------------
- (void)start:(NSString *)journeyId
    journeyName:(NSString *)journeyName
        options:(JS::NativeRNPingJourney::JourneyOptions &)options
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject {
  NSLog(@"RNPingJourney: start called with journeyId=%@, journeyName=%@",
        journeyId, journeyName);

  NSMutableDictionary *opts = [NSMutableDictionary new];
  if (options.forceAuth().has_value()) {
    opts[@"forceAuth"] = @(options.forceAuth().value());
  }
  if (options.noSession().has_value()) {
    opts[@"noSession"] = @(options.noSession().value());
  }

  [[self swiftImpl] start:journeyId
              journeyName:journeyName
                  options:opts
                 resolver:resolve
                 rejecter:reject];
}

// ------------------------------------------
// next(journeyId, nodeId, input)
// ------------------------------------------
- (void)next:(NSString *)journeyId
      nodeId:(NSString *)nodeId
       input:(JS::NativeRNPingJourney::NativeJourneyNextInput &)input
     resolve:(RCTPromiseResolveBlock)resolve
      reject:(RCTPromiseRejectBlock)reject {
  NSLog(@"RNPingJourney: next called for journeyId=%@ nodeId=%@", journeyId,
        nodeId);

  NSMutableDictionary *inputDict = [NSMutableDictionary new];
  auto callbacks = input.callbacks();
  if (callbacks.has_value()) {
    NSMutableArray<NSDictionary *> *callbackArray = [NSMutableArray new];
    for (auto callback : callbacks.value()) {
      NSMutableDictionary *callbackDict = [NSMutableDictionary new];
      callbackDict[@"type"] = callback.type();
      id<NSObject> value = callback.value();
      if (value != nil) {
        callbackDict[@"value"] = value;
      }
      auto index = callback.index();
      if (index.has_value()) {
        callbackDict[@"index"] = @(index.value());
      }
      [callbackArray addObject:callbackDict];
    }
    inputDict[@"callbacks"] = callbackArray;
  }

  [[self swiftImpl] next:journeyId
                  nodeId:nodeId
                   input:inputDict
                resolver:resolve
                rejecter:reject];
}

// ------------------------------------------
// resume(journeyId, uri)
// ------------------------------------------
- (void)resume:(NSString *)journeyId
           uri:(NSString *)uri
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject {
  NSLog(@"RNPingJourney: resume called journeyId=%@ uri=%@", journeyId, uri);

  [[self swiftImpl] resume:journeyId uri:uri resolver:resolve rejecter:reject];
}

// ------------------------------------------
// getSession(journeyId)
// ------------------------------------------
- (void)getSession:(NSString *)journeyId
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
  NSLog(@"RNPingJourney: getSession called for journeyId=%@", journeyId);
  [[self swiftImpl] getSession:journeyId resolver:resolve rejecter:reject];
}

// ------------------------------------------
// logout(journeyId)
// ------------------------------------------
- (void)logout:(NSString *)journeyId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject {
  NSLog(@"RNPingJourney: logout called for journeyId=%@", journeyId);
  [[self swiftImpl] logout:journeyId resolver:resolve rejecter:reject];
}

// ------------------------------------------
// dispose(journeyId)
// ------------------------------------------
- (void)dispose:(NSString *)journeyId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject {
  NSLog(@"RNPingJourney: dispose called for journeyId=%@", journeyId);
  [[self swiftImpl] dispose:journeyId resolver:resolve rejecter:reject];
}

// ------------------------------------------
// listRegisteredStoragesFromCore(): Promise<string[]>
// ------------------------------------------
- (void)listRegisteredStoragesFromCore:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject {
  NSLog(@"RNPingJourney: listRegisteredStoragesFromCore called");
  [[self swiftImpl] listRegisteredStoragesFromCore:resolve rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNPingJourneySpecJSI>(params);
}

@end
