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

// ------------------------------------------
// configureJourney(config): Promise<string>
// ------------------------------------------
- (void)configureJourney:(NSDictionary *)config
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject {
  NSLog(@"RNPingJourney: configureJourney called");
  [[self swiftImpl] configureJourney:config resolver:resolve rejecter:reject];
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
       input:(NSDictionary *)input
     resolve:(RCTPromiseResolveBlock)resolve
      reject:(RCTPromiseRejectBlock)reject {
  NSLog(@"RNPingJourney: next called for journeyId=%@ nodeId=%@", journeyId,
        nodeId);

  [[self swiftImpl] next:journeyId
                  nodeId:nodeId
                   input:input
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
