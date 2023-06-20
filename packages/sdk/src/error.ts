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
