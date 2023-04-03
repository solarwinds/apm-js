export function firstIfArray<T>(value: T | T[] | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0]
  } else {
    return value
  }
}
