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

/// Auto-generated Swift header
#import "RNPingStorage-Swift.h"

@implementation RNPingStorage
RCT_EXPORT_MODULE()

/**
 Returns the shared Swift implementation instance.
 */
- (RNPingStorageImpl *)swiftImpl
{
  return [RNPingStorageImpl shared];
}

/**
 Configures a session storage instance.
 
 - Parameter config: Storage configuration.
 - Returns: Unique storage identifier.
 */
- (NSString *)configureSessionStorage:(JS::NativeRNPingStorage::BaseStorageConfig &)config
{
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

  return [[self swiftImpl] configureSessionStorage:dict];
}

/**
 Configures an OIDC storage instance.
 
 - Parameter config: Storage configuration.
 - Returns: Unique storage identifier.
 */
- (NSString *)configureOidcStorage:(JS::NativeRNPingStorage::BaseStorageConfig &)config
{
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

  return [[self swiftImpl] configureOidcStorage:dict];
}

@end