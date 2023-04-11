import { type Context } from "@opentelemetry/api"
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type Span,
  type SpanExporter,
  type SpanProcessor,
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
    /* eslint-disable-next-line ts/no-extra-semi */
    ;[...this.processors].reverse().forEach((p) => p.onEnd(span))
    super.onEnd(span)
  }

  async forceFlush(): Promise<void> {
    await Promise.all(this.processors.map((p) => p.forceFlush()))
    await super.forceFlush()
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.processors.map((p) => p.shutdown()))
    await super.shutdown()
  }
}
