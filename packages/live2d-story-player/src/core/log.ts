export enum LOG_LEVEL {
  VERBOSE = 0,
  WARNING = 1,
  ERROR = 2,
  NONE = 999
}

export interface StoryPlayerLogger {
  log(tag: string, ...messages: unknown[]): void;
  warn(tag: string, ...messages: unknown[]): void;
  error?(tag: string, ...messages: unknown[]): void;
}

export const log: StoryPlayerLogger & { level: LOG_LEVEL } = {
  level: LOG_LEVEL.WARNING,

  log(tag: string, ...messages: unknown[]) {
    if (log.level <= LOG_LEVEL.VERBOSE) {
      console.log(`[${tag}]`, ...messages);
    }
  },

  warn(tag: string, ...messages: unknown[]) {
    if (log.level <= LOG_LEVEL.WARNING) {
      console.warn(`[${tag}]`, ...messages);
    }
  },

  error(tag: string, ...messages: unknown[]) {
    if (log.level <= LOG_LEVEL.ERROR) {
      console.error(`[${tag}]`, ...messages);
    }
  }
};
