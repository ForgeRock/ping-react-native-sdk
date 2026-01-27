#import "RNPingDeviceProfile.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

@implementation RNPingDeviceProfile
- (void)collectDeviceProfile:(NSArray<NSString *> *)collectors
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  reject(@"NOT_IMPLEMENTED", @"Device Profile native collection is not yet available.", nil);
}

- (void)collectDeviceProfileForJourney:(NSString *)journeyId
                            collectors:(NSArray<NSString *> *)collectors
                        callbackPayload:(NSDictionary *)callbackPayload
                               resolve:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject
{
  reject(@"NOT_IMPLEMENTED", @"Device Profile native Journey collection is not yet available.", nil);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingDeviceProfileSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"RNPingDeviceProfile";
}

@end
