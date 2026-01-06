//
//  RNPingStorage.mm
//  RNPingStorage
//

#import <string>
#import "RCTDefaultReactNativeFactoryDelegate.h"
#import "RNPingStorage.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

// Auto-generated Swift header
#import "RNPingStorage-Swift.h"

@implementation RNPingStorage
RCT_EXPORT_MODULE()

// Helper to get the Swift singleton 
- (RNPingStorageImpl *)swiftImpl
{
  return [RNPingStorageImpl shared];
}

// configure(config): string
- (NSString *)configure:(JS::NativeRNPingStorage::StorageConfig &)config
{
  NSLog(@"RNPingStorage: configure called");

  NSMutableDictionary *dict = [NSMutableDictionary new];

  if (config.type() != nil) {
    dict[@"type"] = config.type();
  }
  if (config.keyAlias() != nil) {
    dict[@"keyAlias"] = config.keyAlias();
  }
  if (config.cacheStrategy() != nil) {
    dict[@"cacheStrategy"] = config.cacheStrategy();
  }

  return [[self swiftImpl] configure:dict];
}

// save(item): Promise<boolean>
- (void)save:(NSString *)id
        item:(NSDictionary *)item
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"RNPingStorage: save called");
  [[self swiftImpl] save:id item:item resolver:resolve rejecter:reject];
}

// get(): Promise<Object | null>
- (void)getItem:(NSString *)id
     resolve:(RCTPromiseResolveBlock)resolve
      reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"RNPingStorage: get called");
  [[self swiftImpl] getItem:id resolver:resolve rejecter:reject];
}

// delete(): Promise<boolean>
- (void)delete:(NSString *)id
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  NSLog(@"RNPingStorage: remove called");
  [[self swiftImpl] remove:id resolver:resolve rejecter:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingStorageSpecJSI>(params);
}

@end
