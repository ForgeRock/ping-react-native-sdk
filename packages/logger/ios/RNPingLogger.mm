/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
#import "RNPingLogger.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

#import "RNPingLogger-Swift.h"

/**
 * @class Logger
 * @brief React Native bridge module for PingLogger functionality
 *
 * This class serves as the Objective-C bridge between React Native JavaScript
 * and the Swift implementation of the PingLogger module.
 */
@implementation Logger
RCT_EXPORT_MODULE()

/**
 * @brief Returns the Swift singleton instance
 * @return The shared RNPingLoggerImpl instance
 */
- (RNPingLoggerImpl *)swiftImpl
{
  return [RNPingLoggerImpl shared];
}

/**
 * @brief Registers a new logger instance with the specified configuration
 * @param config Logger configuration options containing the log level
 * @return NSString* Unique identifier for the registered logger
 *
 * This method creates a new logger instance with the provided configuration.
 * The configuration is converted from C++ to Objective-C dictionary format
 * before being passed to the Swift implementation.
 */
- (NSString *)registerLogger:(JS::NativeRNPingLogger::LoggerOptions &)config
{
  NSMutableDictionary *dict = [NSMutableDictionary new];
  if (config.level() != nil) {
    dict[@"level"] = config.level();
  }

  return [[self swiftImpl] registerLogger:dict];
}

/**
 * @brief Synchronizes logger configuration for an existing logger instance
 * @param config Sync options containing the logger ID and new log level
 *
 * This method updates the log level for an existing logger identified by its ID.
 * The configuration is extracted from the C++ structure and passed to the
 * Swift implementation.
 */
- (void)syncLogger:(JS::NativeRNPingLogger::LoggerSyncOptions &)config
{
  NSString *loggerId = config.id_();
  NSString *level = config.level();
  [[self swiftImpl] syncLogger:loggerId level:level];
}

/**
 * @brief Creates and returns the TurboModule instance
 * @param params Initialization parameters for the TurboModule
 * @return std::shared_ptr<facebook::react::TurboModule> Shared pointer to the TurboModule
 *
 * This method is required by the React Native TurboModule system. It creates
 * and returns a shared pointer to the C++ TurboModule implementation.
 */
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingLoggerSpecJSI>(params);
}

@end