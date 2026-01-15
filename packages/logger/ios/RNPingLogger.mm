#import "RNPingLogger.h"

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

#import "RNPingLogger-Swift.h"

@implementation Logger
RCT_EXPORT_MODULE()

// Helper to get the Swift singleton
- (RNPingLoggerImpl *)swiftImpl
{
  return [RNPingLoggerImpl shared];
}

// ------------------------------------------
// registerLogger(config): string
// ------------------------------------------
- (NSString *)registerLogger:(JS::NativeRNPingLogger::LoggerOptions &)config
{
  NSMutableDictionary *dict = [NSMutableDictionary new];
  if (config.level() != nil) {
    dict[@"level"] = config.level();
  }

  return [[self swiftImpl] registerLogger:dict];
}

// ------------------------------------------
// syncLogger(config): void
// ------------------------------------------
- (void)syncLogger:(JS::NativeRNPingLogger::LoggerSyncOptions &)config
{
  NSString *loggerId = config.id_();
  NSString *level = config.level();
  [[self swiftImpl] syncLogger:loggerId level:level];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeRNPingLoggerSpecJSI>(params);
}

@end
