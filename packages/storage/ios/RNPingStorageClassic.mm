/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
#import <React/RCTBridgeModule.h>
#import <React/RCTLog.h>
#import "RNPingStorage-Swift.h"

@interface RNPingStorageClassic : NSObject <RCTBridgeModule>
@end

@implementation RNPingStorageClassic

RCT_EXPORT_MODULE(RNPingStorageClassic)

#pragma mark - Configure

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(registerSessionStorage:(NSDictionary *)config)
{
  NSString *storageId = [RNPingStorageCommon registerSessionStorage:config];

  return storageId;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(registerOidcStorage:(NSDictionary *)config)
{
  NSString *storageId = [RNPingStorageCommon registerOidcStorage:config];

  return storageId;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(configureSessionStorage:(NSString *)storageId)
{
  NSDictionary *config = [RNPingStorageCommon configureSessionStorage:storageId];

  return config;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(configureOidcStorage:(NSString *)storageId)
{
  NSDictionary *config = [RNPingStorageCommon configureOidcStorage:storageId];

  return config;
}
@end
