import { type DiagLogLevel } from "@opentelemetry/api"

export interface SwoConfiguration {
  serviceKey: string
  collector?: string
  certificate?: string
  metricFormat?: number
  logLevel?: DiagLogLevel

  triggerTraceEnabled?: boolean
  transactionSettings?: TransactionSetting[]
}

export interface TransactionSetting {
  tracing: boolean
  matcher: (identifier: string) => boolean
}
