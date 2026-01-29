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

// createClient(config): string
- (NSString *)createClient:(JS::NativeRNPingOidc::NativeOidcClientConfig &)config
{
  return [[self swiftImpl] createClient:@{}];
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
                        resolver:^(BOOL value) {
                          resolve(@(value));
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
  [[self swiftImpl] authorize:webClientId options:@{} resolver:resolve rejecter:reject];
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
                  resolver:^(BOOL value) {
                    resolve(@(value));
                  }
                  rejecter:reject];
}

// logout(webClientId): Promise<boolean>
- (void)logout:(NSString *)webClientId
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [[self swiftImpl] logout:webClientId
                  resolver:^(BOOL value) {
                    resolve(@(value));
                  }
                  rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRNPingOidcSpecJSI>(params);
}

@end
