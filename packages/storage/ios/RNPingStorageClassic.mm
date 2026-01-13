#import <React/RCTBridgeModule.h>
#import <React/RCTLog.h>
#import "RNPingStorage-Swift.h"

@interface RNPingStorageClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingStorageClassic

RCT_EXPORT_MODULE(RNPingStorage)

#pragma mark - Configure

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(configureSessionStorage:(NSDictionary *)config)
{
  NSString *storageId = [RNPingStorageCommon configureSessionStorage:config];

  return storageId;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(configureOidcStorage:(NSDictionary *)config)
{
  NSString *storageId = [RNPingStorageCommon configureOidcStorage:config];

  return storageId;
}
@end
