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

import fs from "node:fs/promises"
import os from "node:os"
import process from "node:process"
import type readline from "node:readline"

import { context, diag } from "@opentelemetry/api"
import { suppressTracing } from "@opentelemetry/core"
import {
  type DetectorSync,
  type IResource,
  Resource,
} from "@opentelemetry/resources"
import {
  ATTR_K8S_NAMESPACE_NAME,
  ATTR_K8S_POD_NAME,
  ATTR_K8S_POD_UID,
} from "@opentelemetry/semantic-conventions/incubating"

const NAMESPACE_ENV = "SW_K8S_POD_NAMESPACE"
const UID_ENV = "SW_K8S_POD_UID"
const NAME_ENV = "SW_K8S_POD_NAME"

const NAMESPACE_FILE =
  process.platform === "win32"
    ? "C:\\var\\run\\secrets\\kubernetes.io\\serviceaccount\\namespace"
    : "/run/secrets/kubernetes.io/serviceaccount/namespace"

const MOUNTINFO_FILE = "/proc/self/mountinfo"
const UID_REGEX = /[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i

export class K8sDetector implements DetectorSync {
  readonly #logger = diag.createComponentLogger({
    namespace: `@solarwinds-apm/instrumentations/${K8sDetector.name}`,
  })

  readonly #namespace: string
  readonly #mountinfo: string

  constructor(namespace = NAMESPACE_FILE, mountinfo = MOUNTINFO_FILE) {
    this.#namespace = namespace
    this.#mountinfo = mountinfo
  }

  detect(): IResource {
    return new Resource(
      {},
      context.with(suppressTracing(context.active()), async () => {
        const namespace = await this.#podNamespace()
        if (!namespace) {
          return {}
        }

        const uid = await this.#podUid()
        const name = this.#podName()

        return {
          [ATTR_K8S_NAMESPACE_NAME]: namespace,
          [ATTR_K8S_POD_UID]: uid,
          [ATTR_K8S_POD_NAME]: name,
        }
      }),
    )
  }

  async #podNamespace(): Promise<string | undefined> {
    const env = process.env[NAMESPACE_ENV]
    if (typeof env === "string") {
      this.#logger.debug("read pod namespace from env")
      return env
    }

    try {
      const contents = await fs.readFile(this.#namespace, { encoding: "utf-8" })

      this.#logger.debug("read pod namespace from file")
      return contents.trim()
    } catch (err) {
      this.#logger.debug("can't read pod namespace", err)
      return undefined
    }
  }

  async #podUid(): Promise<string | undefined> {
    const env = process.env[UID_ENV]
    if (typeof env === "string") {
      this.#logger.debug("read pod uid from env")
      return env
    }

    if (process.platform === "win32") {
      this.#logger.debug("can't read pod uid on windows")
      return undefined
    }

    let file: fs.FileHandle | undefined
    let rl: readline.Interface | undefined
    try {
      file = await fs.open(this.#mountinfo)
      rl = file.readLines()

      for await (const line of rl) {
        const fields = line.split(" ")
        if (fields.length < 10) {
          // invalid entry
          continue
        }

        const [id, parentId, , root] = fields
        if (
          !Number.isSafeInteger(Number(id)) ||
          !Number.isSafeInteger(Number(parentId))
        ) {
          // invalid entry
          continue
        }

        if (!root!.includes("kube")) {
          // not a k8s pod uid
          continue
        }

        const matches = UID_REGEX.exec(root!)
        if (!matches?.[0]) {
          // not a k8s pod uid
          continue
        }

        return matches[0]
      }
    } catch (err) {
      this.#logger.debug("can't read pod uid", err)
      return undefined
    } finally {
      rl?.close()
      await file?.close()
    }
  }

  #podName(): string | undefined {
    const env = process.env[NAME_ENV]
    if (typeof env === "string") {
      this.#logger.debug("read pod name from env")
      return env
    }

    return os.hostname()
  }
}

export const k8sDetector: DetectorSync = new K8sDetector()
