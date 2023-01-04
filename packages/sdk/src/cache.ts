import { type SpanContext } from "@opentelemetry/api"

export interface SpanCache {
  txname?: string
  parentRemote?: boolean
}

class Cache {
  private readonly spanCache = new Map<string, SpanCache>()

  get(ctx: SpanContext): SpanCache | undefined {
    return this.spanCache.get(Cache.key(ctx))
  }

  setParentRemote(ctx: SpanContext, parentRemote: boolean | undefined): void {
    const cache = this.get(ctx)
    if (cache) {
      cache.parentRemote = parentRemote
    } else {
      this.spanCache.set(Cache.key(ctx), { parentRemote })
    }
  }
  setTxname(ctx: SpanContext, txname: string): boolean {
    const cache = this.get(ctx)
    if (cache) {
      cache.txname = txname
      return true
    } else {
      this.spanCache.set(Cache.key(ctx), { txname })
      return false
    }
  }

  clear(ctx: SpanContext): void {
    this.spanCache.delete(Cache.key(ctx))
  }

  private static key(ctx: SpanContext): string {
    return `${ctx.traceId}-${ctx.spanId}`
  }
}
export const cache = new Cache()
