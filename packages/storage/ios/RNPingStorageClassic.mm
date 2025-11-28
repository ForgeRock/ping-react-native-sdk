#import <React/RCTBridgeModule.h>
#import <React/RCTLog.h>
#import "RNPingStorage-Swift.h"

@interface RNPingStorageClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingStorageClassic

RCT_EXPORT_MODULE(RNPingStorage)

#pragma mark - Configure

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(configure:(NSDictionary *)config)
{
  NSLog(@"[RNPingStorageClassic] configure called with config: %@", config);

  NSString *storageId = [RNPingStorageCommon configure:config];

  NSLog(@"[RNPingStorageClassic] created storage instance %@", storageId);

  return storageId;
}


#pragma mark - Save

RCT_EXPORT_METHOD(save : (NSString *)storageId item : (NSDictionary *)
                      item resolver : (RCTPromiseResolveBlock)
                          resolve rejecter : (RCTPromiseRejectBlock)reject) {
  [RNPingStorageCommon save:storageId
      item:item
      resolver:^(BOOL ok) {
        resolve(@(ok));
      }
      rejecter:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
      }];
}

#pragma mark - Get

RCT_EXPORT_METHOD(get : (NSString *)storageId resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  [RNPingStorageCommon get:storageId
      resolver:^(NSDictionary *result) {
        resolve(result);
      }
      rejecter:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
      }];
}

#pragma mark - Remove

RCT_EXPORT_METHOD(remove : (NSString *)storageId resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  [RNPingStorageCommon remove:storageId
      resolver:^(BOOL ok) {
        resolve(@(ok));
      }
      rejecter:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
      }];
}

@end
