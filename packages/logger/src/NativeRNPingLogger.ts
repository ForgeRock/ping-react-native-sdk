import { TurboModuleRegistry, type TurboModule } from 'react-native';

export type LoggerLevel =
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'none';

export type NativeLoggerLevel =
  | 'STANDARD'
  | 'WARN'
  | 'NONE';

export type LoggerOptions = {
  level: NativeLoggerLevel;
};

export type LoggerSyncOptions = {
  id: string;
  level: NativeLoggerLevel;
};

export interface Spec extends TurboModule {
  registerLogger(config: LoggerOptions): string;
  syncLogger(config: LoggerSyncOptions): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Logger');
