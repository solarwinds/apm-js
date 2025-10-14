/*
Copyright 2023-2025 SolarWinds Worldwide, LLC.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * Unrefs a Node.js reference counted object so it
 * doesn't prevent the runtime from shutting down
 **/
export function unref<T extends NodeJS.RefCounted | number>(ref: T): T {
  if (typeof ref === "object") {
    ref.unref()
  }
  return ref
}

export async function load(url: string): Promise<unknown> {
  const imported = (await import(url)) as object
  if (!("default" in imported)) {
    return imported
  }

  // we want to check if the only meaningful export is the default one
  // so we count the number of keys in the exported object and subtract one
  // for every export that matches a name we know not to be meaningful
  const ignored = ["module.exports", "__esModule"]
  const remaining = ignored.reduce(
    (remaining, ignored) => (ignored in imported ? remaining - 1 : remaining),
    Object.keys(imported).length,
  )

  // if there was only one meaningful export we can safely use that
  if (remaining === 1) {
    return imported.default
  } else {
    return imported
  }
}

export function stacktrace(
  length: number,
  filtered: boolean,
): string | undefined {
  const stackTraceLimit = Reflect.get(Error, "stackTraceLimit")
  const prepareStackTrace = Reflect.get(Error, "prepareStackTrace")

  Reflect.set(Error, "stackTraceLimit", length + 1)
  Reflect.set(
    Error,
    "prepareStackTrace",
    function filterStackTrace(this: ErrorConstructor, _, stack) {
      const cwd = typeof process !== "undefined" ? process.cwd() : null

      const file = stack[0]?.getFileName()
      while (stack.length > 0 && stack[0]?.getFileName() === file) {
        stack.shift()
      }

      if (filtered) {
        const exclude = ["solarwinds-apm", "@solarwinds-apm", "@opentelemetry"]

        stack = stack.filter((frame) => {
          const file = frame.getFileName()
          const directories = file?.split(/\/|\\/)
          return !directories?.some((directory) => exclude.includes(directory))
        })
      }

      return stack
        .map((frame) => {
          let file = frame.getFileName()
          if (file?.startsWith("file://")) {
            file = file.slice("file://".length)
          }
          if (file && cwd && file.startsWith(cwd)) {
            file = `.${file.slice(cwd.length)}`
          }

          const line = frame.getLineNumber()
          const column = frame.getColumnNumber()
          if (file && line != null && column != null) {
            file = `${file}:${line}:${column}`
          }

          if (!file && frame.isNative()) {
            file = "<native>"
          }

          let fn: string
          const type = frame.getTypeName()
          if (type) {
            const method = frame.getMethodName() ?? "<anonymous>"
            fn = `${type}.${method}`
          } else {
            fn = frame.getFunctionName() ?? "<anonymous>"
          }

          if (frame.isConstructor()) {
            fn = `new ${fn}`
          } else if (frame.isAsync()) {
            fn = `async ${fn}`
          }

          if (file) {
            return `${fn} (${file})`
          } else {
            return fn
          }
        })
        .join("\n")
    },
  )

  const stack = new Error().stack
  Reflect.set(Error, "stackTraceLimit", stackTraceLimit)
  Reflect.set(Error, "prepareStackTrace", prepareStackTrace)

  return stack
}
