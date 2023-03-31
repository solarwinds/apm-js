export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  public readonly debug: (message: string) => void
  public readonly info: (message: string) => void
  public readonly warn: (warning: string | Error) => void
  public readonly error: (error: Error | string) => void

  public constructor(
    private readonly level: LogLevel,
    private readonly module: string,
  ) {
    this.debug = this.level <= LogLevel.DEBUG ? debug(module) : noop
    this.info = this.level <= LogLevel.INFO ? info(module) : noop
    this.warn = this.level <= LogLevel.WARN ? warn(module) : noop
    this.error = this.level <= LogLevel.ERROR ? error(module) : noop
  }

  public sub(module: string): Logger {
    return new Logger(this.level, `${this.module}/${module}`)
  }
}

function format(level: string, module: string, message: string): string {
  const date = new Date().toISOString()
  return `${date} [${level}]::[${module}] ${message}`
}

const noop = () => {
  /* noop */
}

const debug = (module: string) => (message: string) => {
  console.log(format("DEBUG", module, message))
}
const info = (module: string) => (message: string) => {
  console.log(format("INFO", module, message))
}
const warn = (module: string) => (warning: string | Error) => {
  if (warning instanceof Error) {
    console.warn(format("WARN", module, warning.message))
    console.warn(warning)
  } else {
    console.warn(format("WARN", module, warning))
  }
}
const error = (module: string) => (error: Error | string) => {
  if (error instanceof Error) {
    console.error(format("ERROR", module, error.message))
    console.error(error)
  } else {
    console.error(format("ERROR", module, error))
  }
}
