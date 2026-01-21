/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
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
 Registers a session storage configuration.
 
 - Parameter config: Storage configuration.
 - Returns: Unique storage identifier.
 */
- (NSString *)registerSessionStorage:(JS::NativeRNPingStorage::NativeStorageConfig &)config
{
  NSMutableDictionary *dict = [NSMutableDictionary new];

  NSString *account = config.account();
  if (account != nil) {
    dict[@"account"] = account;
  }
  
  auto encryptor = config.encryptor();
  if (encryptor.has_value()) {
    dict[@"encryptor"] = @(encryptor.value());
  }

  auto cacheable = config.cacheable();
  if (cacheable.has_value()) {
    dict[@"cacheable"] = @(cacheable.value());
  }

  return [[self swiftImpl] registerSessionStorage:dict];
}

/**
 Registers an OIDC storage configuration.
 
 - Parameter config: Storage configuration.
 - Returns: Unique storage identifier.
 */
- (NSString *)registerOidcStorage:(JS::NativeRNPingStorage::NativeStorageConfig &)config
{
  NSMutableDictionary *dict = [NSMutableDictionary new];

  NSString *account = config.account();
  if (account != nil) {
    dict[@"account"] = account;
  }
  
  auto encryptor = config.encryptor();
  if (encryptor.has_value()) {
    dict[@"encryptor"] = @(encryptor.value());
  }

  auto cacheable = config.cacheable();
  if (cacheable.has_value()) {
    dict[@"cacheable"] = @(cacheable.value());
  }

  return [[self swiftImpl] registerOidcStorage:dict];
}

/**
 Resolves a session storage configuration by id.
 
 - Parameter storageId: Storage configuration identifier.
 - Returns: Storage configuration dictionary.
 */
- (NSDictionary *)configureSessionStorage:(NSString *)storageId
{
  return [[self swiftImpl] configureSessionStorage:storageId];
}

/**
 Resolves an OIDC storage configuration by id.
 
 - Parameter storageId: Storage configuration identifier.
 - Returns: Storage configuration dictionary.
 */
- (NSDictionary *)configureOidcStorage:(NSString *)storageId
{
  return [[self swiftImpl] configureOidcStorage:storageId];
}

@end
