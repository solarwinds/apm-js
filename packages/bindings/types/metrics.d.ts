export namespace eventLoop {
  function setCallback(
    callback: (latency: number) => void,
    granularity: number,
  ): void
  function setCallback(callback: null): void
}
