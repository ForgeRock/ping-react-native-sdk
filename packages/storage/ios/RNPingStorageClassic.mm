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
  NSString *storageId = [RNPingStorageCommon configure:config];

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

RCT_EXPORT_METHOD(getItem : (NSString *)storageId resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  [RNPingStorageCommon getItem:storageId
      resolver:^(NSDictionary *result) {
        resolve(result);
      }
      rejecter:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
      }];
}

#pragma mark - Delete

RCT_EXPORT_METHOD(deleteItem : (NSString *)storageId resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject) {
  [RNPingStorageCommon deleteItem:storageId
      resolver:^(BOOL ok) {
        resolve(@(ok));
      }
      rejecter:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
      }];
}

@end
