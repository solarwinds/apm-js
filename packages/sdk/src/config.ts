import { type DiagLogLevel } from "@opentelemetry/api"

export interface SwoConfiguration {
  serviceKey: string
  enabled: boolean
  collector?: string
  certificate?: string
  metricFormat?: number
  logLevel?: DiagLogLevel
  tracingMode?: boolean

  triggerTraceEnabled: boolean
  insertTraceIdsIntoLogs: boolean
  transactionSettings?: TransactionSetting[]
}

export interface TransactionSetting {
  tracing: boolean
  matcher: (identifier: string) => boolean
}
