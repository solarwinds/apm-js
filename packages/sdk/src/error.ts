export class OboeError extends Error {
  klass: string
  method?: string
  status: number

  constructor(klass: string, method: string, status: number)
  constructor(klass: string, status: number)
  constructor(
    klass: string,
    ...args: [method: string, status: number] | [status: number]
  ) {
    let method: string | undefined
    let status: number
    if (args.length === 2) {
      method = args[0]
      status = args[1]
    } else {
      method = undefined
      status = args[0]
    }

    const name = method ? `${klass}.${method}` : `new ${klass}`
    super(`'${name}' failed with status '${status}'`)

    this.name = "OboeError"
    this.klass = klass
    this.method = method
    this.status = status
  }
}
