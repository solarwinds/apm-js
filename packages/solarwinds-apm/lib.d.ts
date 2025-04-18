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

interface ObjectConstructor {
  // Object.entries but with very accurate types. The default typings for
  // { name: "John", age: 30 } would make the return type
  // [string, string | number][] while this typing makes it
  // (["name", string] | ["age", number])[]
  entries<const T extends Record<string, unknown>>(
    object: T,
  ): { [K in keyof T]: [K, T[K]] }[keyof T][]

  fromEntries<const T extends readonly [PropertyKey, unknown]>(
    entries: Iterable<T>,
  ): Record<T[0], T[1]>
}
