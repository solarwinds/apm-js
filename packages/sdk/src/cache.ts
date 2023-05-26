import { type SpanContext } from "@opentelemetry/api"

export interface SpanCache {
  txname?: string
  parentId?: string
  parentRemote?: boolean
}

class Cache {
  private readonly spanCache = new Map<string, SpanCache>()

  get(ctx: SpanContext): SpanCache | undefined {
    return this.spanCache.get(Cache.key(ctx))
  }

  getRoot(ctx: SpanContext): SpanCache | undefined {
    for (;;) {
      const c = this.get(ctx)

      if (!c) return undefined
      if (!c.parentId || c.parentRemote) return c

      ctx = { ...ctx, traceId: ctx.traceId, spanId: c.parentId }
    }
  }

  setParentInfo(
    ctx: SpanContext,
    parentInfo: { id?: string; remote?: boolean },
  ): void {
    const cache = this.get(ctx)
    if (cache) {
      if (parentInfo.id !== undefined) cache.parentId = parentInfo.id
      if (parentInfo.remote !== undefined)
        cache.parentRemote = parentInfo.remote
    } else {
      this.spanCache.set(Cache.key(ctx), {
        parentId: parentInfo.id,
        parentRemote: parentInfo.remote,
      })
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
