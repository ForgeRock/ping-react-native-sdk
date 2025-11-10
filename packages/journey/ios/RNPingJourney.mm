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
- (RNPingJourneyImpl *)swiftImpl
{
  return [RNPingJourneyImpl shared];
}

// configureJourney(config): Promise<boolean>
- (void)configureJourney:(NSDictionary *)config
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"RNPingJourney: configureJourney called");
  [[self swiftImpl] configureJourney:config resolver:resolve rejecter:reject];
}

// start(journeyName, options): Promise<Node>
- (void)start:(NSString *)journeyName
      options:(JS::NativeRNPingJourney::JourneyOptions &)options
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"RNPingJourney: start called with journeyName: %@", journeyName);
  
  // Convert C++ options struct to NSDictionary for Swift
  NSMutableDictionary *opts = [NSMutableDictionary new];
  if (options.forceAuth().has_value()) {
    opts[@"forceAuth"] = @(options.forceAuth().value());
  }
  if (options.noSession().has_value()) {
    opts[@"noSession"] = @(options.noSession().value());
  }
  
  [[self swiftImpl] start:journeyName options:opts resolver:resolve rejecter:reject];
}

// next(nodeId, input): Promise<Node>
- (void)next:(NSString *)nodeId
       input:(NSDictionary *)input
     resolve:(RCTPromiseResolveBlock)resolve
      reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"RNPingJourney: next called with nodeId: %@", nodeId);
  [[self swiftImpl] next:nodeId input:input resolver:resolve rejecter:reject];
}

// resume(uri): Promise<Node>
- (void)resume:(NSString *)uri
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"RNPingJourney: resume called with uri: %@", uri);
  [[self swiftImpl] resume:uri resolver:resolve rejecter:reject];
}

// getSession(): Promise<Object | null>
- (void)getSession:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"RNPingJourney: getSession called");
  [[self swiftImpl] getSession:resolve rejecter:reject];
}

// logout(): Promise<boolean>
- (void)logout:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"RNPingJourney: logout called");
  [[self swiftImpl] logout:resolve rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingJourneySpecJSI>(params);
}

@end