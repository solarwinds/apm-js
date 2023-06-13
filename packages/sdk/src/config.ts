import { type DiagLogLevel } from "@opentelemetry/api"

export interface SwoConfiguration {
  token: string
  serviceName: string
  enabled: boolean
  collector?: string
  certificate?: string
  metricFormat?: number
  oboeLogLevel: number
  otelLogLevel: DiagLogLevel
  triggerTraceEnabled: boolean
  runtimeMetrics: boolean
  tracingMode?: boolean
  insertTraceContextIntoLogs: boolean
  transactionSettings?: TransactionSetting[]
}

export interface TransactionSetting {
  tracing: boolean
  matcher: (identifier: string) => boolean
}
