import { type Context } from "@opentelemetry/api"
import {
  type ReadableSpan,
  type Span,
  type SpanExporter,
  type SpanProcessor,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base"

export class CompoundSpanProcessor extends BatchSpanProcessor {
  constructor(
    exporter: SpanExporter,
    private readonly processors: SpanProcessor[],
  ) {
    super(exporter)
    this.processors = processors
  }

  onStart(span: Span, parentContext: Context): void {
    super.onStart(span, parentContext)
    this.processors.forEach((p) => p.onStart(span, parentContext))
  }

  onEnd(span: ReadableSpan): void {
    this.processors.reverse().forEach((p) => p.onEnd(span))
    super.onEnd(span)
  }

  async forceFlush(): Promise<void> {
    await Promise.all(this.processors.reverse().map((p) => p.forceFlush()))
    await super.forceFlush()
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.processors.reverse().map((p) => p.shutdown()))
    await super.shutdown()
  }
}
