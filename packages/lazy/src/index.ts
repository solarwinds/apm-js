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

/**
 * Creates a lazy proxy object that will initialize the proxied object using
 * the provided function on first access.
 *
 * @param init - Initialization function
 * @returns Lazy proxy object
 */
export function lazy<T>(init: () => T): T {
  const valueKey = Symbol("value")
  const initKey = Symbol("init")

  const inner = {
    [valueKey]: undefined as T | undefined,
    [initKey]: init,
  }

  return new Proxy(inner, {
    apply: (target, thisArg, args) =>
      Reflect.apply(
        (target[valueKey] ??= target[initKey]()) as T &
          ((..._: typeof args) => unknown),
        thisArg,
        args,
      ),
    construct: (target, args, newTarget) =>
      Reflect.construct(
        (target[valueKey] ??= target[initKey]()) as T &
          (new (..._: typeof args) => unknown),
        args,
        newTarget,
      ) as object,
    defineProperty: (target, property, descriptor) =>
      Reflect.defineProperty(
        (target[valueKey] ??= target[initKey]()) as T & object,
        property,
        descriptor,
      ),
    deleteProperty: (target, property) =>
      Reflect.deleteProperty(
        (target[valueKey] ??= target[initKey]()) as T & object,
        property,
      ),
    get: (target, property, receiver) =>
      Reflect.get(
        (target[valueKey] ??= target[initKey]()) as T & object,
        property,
        receiver,
      ),
    getOwnPropertyDescriptor: (target, property) =>
      Reflect.getOwnPropertyDescriptor(
        (target[valueKey] ??= target[initKey]()) as T & object,
        property,
      ),
    getPrototypeOf: (target) =>
      Reflect.getPrototypeOf(
        (target[valueKey] ??= target[initKey]()) as T & object,
      ),
    has: (target, property) =>
      Reflect.has(
        (target[valueKey] ??= target[initKey]()) as T & object,
        property,
      ),
    isExtensible: (target) =>
      Reflect.isExtensible(
        (target[valueKey] ??= target[initKey]()) as T & object,
      ),
    ownKeys: (target) =>
      Reflect.ownKeys((target[valueKey] ??= target[initKey]()) as T & object),
    preventExtensions: (target) =>
      Reflect.preventExtensions(
        (target[valueKey] ??= target[initKey]()) as T & object,
      ),
    set: (target, property, value, receiver) =>
      Reflect.set(
        (target[valueKey] ??= target[initKey]()) as T & object,
        property,
        value,
        receiver,
      ),
    setPrototypeOf: (target, prototype) =>
      Reflect.setPrototypeOf(
        (target[valueKey] ??= target[initKey]()) as T & object,
        prototype,
      ),
  }) as T
}
