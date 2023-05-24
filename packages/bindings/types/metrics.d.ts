export namespace eventLoop {
  function setCallback(callback: null): void
  function setCallback(
    callback: (latency: number) => void,
    granularity: number,
  ): void
}
