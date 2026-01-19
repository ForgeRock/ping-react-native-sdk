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
- (NSString *)configureSessionStorage:(JS::NativeRNPingStorage::NativeStorageConfig &)config
{
  NSMutableDictionary *dict = [NSMutableDictionary new];

  NSString *cacheStrategy = config.cacheStrategy();
  if (cacheStrategy != nil) {
    dict[@"cacheStrategy"] = cacheStrategy;
  }
  
  NSString *account = config.account();
  if (account != nil) {
    dict[@"account"] = account;
  }
  
  auto encryptor = config.encryptor();
  if (encryptor.has_value()) {
    dict[@"encryptor"] = @(encryptor.value());
  }

  return [[self swiftImpl] configureSessionStorage:dict];
}

/**
 Configures an OIDC storage instance.
 
 - Parameter config: Storage configuration.
 - Returns: Unique storage identifier.
 */
- (NSString *)configureOidcStorage:(JS::NativeRNPingStorage::NativeStorageConfig &)config
{
  NSMutableDictionary *dict = [NSMutableDictionary new];

  NSString *cacheStrategy = config.cacheStrategy();
  if (cacheStrategy != nil) {
    dict[@"cacheStrategy"] = cacheStrategy;
  }
  
  NSString *account = config.account();
  if (account != nil) {
    dict[@"account"] = account;
  }
  
  auto encryptor = config.encryptor();
  if (encryptor.has_value()) {
    dict[@"encryptor"] = @(encryptor.value());
  }

  return [[self swiftImpl] configureOidcStorage:dict];
}

@end
