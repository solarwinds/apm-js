import {
  type Context,
  type TextMapGetter,
  type TextMapPropagator,
  type TextMapSetter,
} from "@opentelemetry/api"

export class CompoundPropagator implements TextMapPropagator<unknown> {
  private readonly cachedFields: string[]

  constructor(private readonly propagators: TextMapPropagator[]) {
    this.cachedFields = Array.from(
      new Set(propagators.flatMap((p) => p.fields())),
    )
  }

  extract(
    context: Context,
    carrier: unknown,
    getter: TextMapGetter<unknown>,
  ): Context {
    return this.propagators.reduce(
      (ctx, p) => p.extract(ctx, carrier, getter),
      context,
    )
  }

  inject(
    context: Context,
    carrier: unknown,
    setter: TextMapSetter<unknown>,
  ): void {
    this.propagators
      .reverse()
      .forEach((p) => p.inject(context, carrier, setter))
  }

  fields(): string[] {
    return [...this.cachedFields]
  }
}
