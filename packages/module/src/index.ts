/*
Copyright SolarWinds Worldwide, LLC.
SPDX-License-Identifier: Apache-2.0
*/

/**
 * Unrefs a Node.js reference counted object so it doesn't prevent the runtime from shutting
 * down.
 */
export function unref<T extends NodeJS.RefCounted | number>(ref: T): T {
	if (typeof ref === "object") {
		ref.unref()
	}
	return ref
}

export function stacktrace(length: number, filtered: boolean): string | undefined {
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
				const exclude = new Set(["solarwinds-apm", "@solarwinds-apm", "@opentelemetry"])

				stack = stack.filter((frame) => {
					const file = frame.getFileName()
					const directories = file?.split(/\/|\\/)
					return !directories?.some((directory) => exclude.has(directory))
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
