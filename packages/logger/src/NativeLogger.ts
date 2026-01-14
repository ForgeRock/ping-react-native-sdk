import { TurboModuleRegistry, type TurboModule } from 'react-native';

export type LoggerLevel =
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'none';

export type LoggerOptions = {
  id: string;
  level: LoggerLevel;
};

export interface Spec extends TurboModule {
  syncLogger(config: LoggerOptions): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Logger');
