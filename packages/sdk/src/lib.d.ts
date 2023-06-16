interface ObjectConstructor {
  // Object.entries but with very accurate types. The default typings for
  // { name: "John", age: 30 } would make the return type
  // [string, string | number][] while this typing makes it
  // (["name", string] | ["age", number])[]
  entries<const T extends Record<string, unknown>>(
    object: T,
  ): { [K in keyof T]: [K, T[K]] }[keyof T][]
}
