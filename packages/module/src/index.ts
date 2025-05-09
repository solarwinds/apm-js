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
