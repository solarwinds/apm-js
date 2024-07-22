/*
Copyright 2023-2024 SolarWinds Worldwide, LLC.

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
 * Returns the first element if the value is an array
 * or the value as-is otherwise
 */
export function firstIfArray<T>(value: T | T[] | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0]
  } else {
    return value
  }
}

/**
 * Returns the result of {@link Array.join} if the value is an array
 * or the value as-is otherwise
 *
 * @param separator - Separator used between elements
 */
export function joinIfArray(
  value: string | string[] | undefined,
  separator: string,
): string | undefined {
  if (Array.isArray(value)) {
    if (value.length > 0) {
      return value.join(separator)
    } else {
      return undefined
    }
  } else {
    return value
  }
}
