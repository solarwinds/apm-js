/*
Copyright 2023 SolarWinds Worldwide, LLC.

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

/** Config definition with each key defining the value it expects */
export type ConfigDefinition = Record<string, ValueDefinition<unknown>>
/** Config value definition */
export interface ValueDefinition<T> {
  /** Whether to read this value from the file */
  file?: boolean
  /**
   * Whether to read this value from the environment
   *
   * If both `file` and `env` are true and the value is present in both,
   * the environment value will be used.
   *
   * If a string is provided, it will be used as the environment variable name
   * instead of the automatically converted key name.
   */
  env?: boolean | string
  /** Default value to use if none was provided */
  default?: T
  /** Whether the value is required */
  required?: boolean
  /** Optional custom parser for the value */
  parser?: (value: unknown) => T
}

/**
 * Parses a config following the provided definition using the provided file and current environment
 *
 * Config keys are used as-is when reading from the file
 * but converted to SCREAMING_SNAKE_CASE when reading from the environment.
 * The `envPrefix` will not be applied to keys with custom environment variable names.
 *
 * @param def - Config definition
 * @param file - Contents of the parsed config file
 * @param envPrefix - Optional prefix to use for environment variable names
 */
export function config<const T extends ConfigDefinition>(
  def: T,
  file: Partial<Record<string, unknown>>,
  envPrefix = "",
): Config<T> {
  const config: Record<string, unknown> = {}
  for (const [key, vDef] of Object.entries(def)) {
    let value = undefined

    if (vDef.file) value = file[key]

    if (vDef.env) {
      if (typeof vDef.env === "string") value = process.env[vDef.env]
      else value = process.env[`${envPrefix}${upcase(key)}`]
    }

    if (value === undefined) {
      if (vDef.required) throw new Error(`Missing config: ${key}`)
      else value = vDef.default
    }

    if (vDef.parser && value !== undefined) value = vDef.parser(value)

    config[key] = value
  }

  return config as Config<T>
}
export default config

/** Maps the type of a config definition to the type of the config it produces */
type Config<T extends ConfigDefinition> = {
  [K in keyof T]: Value<T[K]> | Optional<T[K]>
}
/**
 * Maps the type of a value definition to the type of the value it produces
 *
 * By default the value can be any JSON value, but if a parser is provided
 * we can narrow the type to the return type of said parser.
 */
type Value<T extends ValueDefinition<unknown>> = T["parser"] extends (
  value: unknown,
) => infer TT
  ? TT
  : unknown
/**
 * Maps the type of a value definition to `undefined` if it is optional
 *
 * If the type is required or if the default value is not undefined,
 * the value will always be present and we map to the `never` type instead.
 * We can then use the mapped type in a union type since `T | undefined` is an optional `T`
 * and `T | never` is always just `T`.
 */
type Optional<T extends ValueDefinition<unknown>> = T["required"] extends true
  ? never
  : T["default"] extends undefined
  ? undefined
  : never

/** Converts a camelCase string to a SCREAMING_SNAKE_CASE one */
function upcase(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()
}
