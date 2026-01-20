/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
#import <React/RCTBridgeModule.h>
#import <React/RCTLog.h>
#import "RNPingLogger-Swift.h"

/**
 * @interface RNPingLoggerClassic
 * @brief Classic (non-Turbo) React Native module for PingLogger
 *
 * This module is used when the New Architecture is disabled.
 * It bridges JavaScript calls to the Swift implementation.
 */
@interface RNPingLoggerClassic : NSObject <RCTBridgeModule>
@end

/**
 * @implementation RNPingLoggerClassic
 * @brief Implementation of the classic logger bridge module
 */
@implementation RNPingLoggerClassic

RCT_EXPORT_MODULE(RNPingLogger)

#pragma mark - Register

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(registerLogger:(NSDictionary *)config)
{
  return [[RNPingLoggerImpl shared] registerLogger:config];
}

#pragma mark - Sync

RCT_EXPORT_METHOD(syncLogger:(NSDictionary *)config)
{
  NSString *loggerId = config[@"id"];
  NSString *level = config[@"level"];

  if (loggerId == nil || level == nil) {
    return;
  }

  [[RNPingLoggerImpl shared] syncLogger:loggerId level:level];
}

@end
