/*
Copyright 2023-2026 SolarWinds Worldwide, LLC.

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

import { randomBytes, randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import process from "node:process"

import { detectResources } from "@opentelemetry/resources"
import { afterEach, describe, expect, it } from "@solarwinds-apm/test"

import { K8sDetector } from "../src/resource-detector-k8s.js"

const NAMESPACE_FILE = path.join(os.tmpdir(), "solarwinds-apm-k8s-namespace")
const MOUNTINFO_FILE = path.join(os.tmpdir(), "solarwinds-apm-mountinfo")

const ENV_NAMESPACE = randomBytes(8).toString("hex")
const FILE_NAMESPACE = randomBytes(8).toString("hex")

const ENV_UID = randomUUID()
const FILE_UID = randomUUID()

const ENV_NAME = randomBytes(4).toString("hex")

const envNamespace = () => {
  process.env.SW_K8S_POD_NAMESPACE = ENV_NAMESPACE
}
const fileNamespace = async () => {
  await fs.writeFile(NAMESPACE_FILE, `${FILE_NAMESPACE}\n`)
}

const envUid = () => {
  process.env.SW_K8S_POD_UID = ENV_UID
}
const fileUid = async () => {
  await fs.writeFile(
    MOUNTINFO_FILE,
    `
757 605 0:139 / / rw,relatime master:180 - overlay overlay rw,context="system_u:object_r:data_t:s0:c171,c852",lowerdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/25/fs,upperdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/26/fs,workdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/26/work
758 757 0:143 / /proc rw,nosuid,nodev,noexec,relatime - proc proc rw
760 757 0:145 / /dev rw,nosuid - tmpfs tmpfs rw,context="system_u:object_r:data_t:s0:c171,c852",size=65536k,mode=755
762 760 0:147 / /dev/pts rw,nosuid,noexec,relatime - devpts devpts rw,context="system_u:object_r:data_t:s0:c171,c852",gid=5,mode=620,ptmxmode=666
764 760 0:105 / /dev/mqueue rw,nosuid,nodev,noexec,relatime - mqueue mqueue rw,seclabel
765 757 0:111 / /sys ro,nosuid,nodev,noexec,relatime - sysfs sysfs ro,seclabel
767 765 0:25 / /sys/fs/cgroup ro,nosuid,nodev,noexec,relatime - cgroup2 cgroup rw,seclabel
769 757 259:16 /var/lib/kubelet/pods/${FILE_UID}/volumes/kubernetes.io~empty-dir/html /html rw,nosuid,nodev,noatime - ext4 /dev/nvme1n1p1 rw,seclabel
772 757 259:16 /var/lib/kubelet/pods/${FILE_UID}/etc-hosts /etc/hosts rw,nosuid,nodev,noatime - ext4 /dev/nvme1n1p1 rw,seclabel
773 760 259:16 /var/lib/kubelet/pods/${FILE_UID}/containers/2nd/7aa42719 /dev/termination-log rw,nosuid,nodev,noatime - ext4 /dev/nvme1n1p1 rw,seclabel
774 757 259:16 /var/lib/containerd/io.containerd.grpc.v1.cri/sandboxes/bd9a3e80e86b8ffbe97ed67b484bd132dcc7b99106ce6ab58e1118287a5b1a60/hostname /etc/hostname rw,nosuid,nodev,noatime - ext4 /dev/nvme1n1p1 rw,seclabel
776 757 259:16 /var/lib/containerd/io.containerd.grpc.v1.cri/sandboxes/bd9a3e80e86b8ffbe97ed67b484bd132dcc7b99106ce6ab58e1118287a5b1a60/resolv.conf /etc/resolv.conf rw,nosuid,nodev,noatime - ext4 /dev/nvme1n1p1 rw,seclabel
778 760 0:100 / /dev/shm rw,nosuid,nodev,noexec,relatime - tmpfs shm rw,seclabel,size=65536k
781 757 0:98 / /run/secrets/kubernetes.io/serviceaccount ro,relatime - tmpfs tmpfs rw,seclabel,size=3380568k
606 758 0:143 /bus /proc/bus ro,nosuid,nodev,noexec,relatime - proc proc rw
607 758 0:143 /fs /proc/fs ro,nosuid,nodev,noexec,relatime - proc proc rw
608 758 0:143 /irq /proc/irq ro,nosuid,nodev,noexec,relatime - proc proc rw
609 758 0:143 /sys /proc/sys ro,nosuid,nodev,noexec,relatime - proc proc rw
610 758 0:143 /sysrq-trigger /proc/sysrq-trigger ro,nosuid,nodev,noexec,relatime - proc proc rw
621 758 0:149 / /proc/acpi ro,relatime - tmpfs tmpfs ro,context="system_u:object_r:data_t:s0:c171,c852"
622 758 0:145 /null /proc/kcore rw,nosuid - tmpfs tmpfs rw,context="system_u:object_r:data_t:s0:c171,c852",size=65536k,mode=755
624 758 0:145 /null /proc/keys rw,nosuid - tmpfs tmpfs rw,context="system_u:object_r:data_t:s0:c171,c852",size=65536k,mode=755
625 758 0:145 /null /proc/latency_stats rw,nosuid - tmpfs tmpfs rw,context="system_u:object_r:data_t:s0:c171,c852",size=65536k,mode=755
626 758 0:145 /null /proc/timer_list rw,nosuid - tmpfs tmpfs rw,context="system_u:object_r:data_t:s0:c171,c852",size=65536k,mode=755
627 758 0:150 / /proc/scsi ro,relatime - tmpfs tmpfs ro,context="system_u:object_r:data_t:s0:c171,c852"
628 765 0:151 / /sys/firmware ro,relatime - tmpfs tmpfs ro,context="system_u:object_r:data_t:s0:c171,c852"
    `,
  )
}

const envName = () => {
  process.env.SW_K8S_POD_NAME = ENV_NAME
}

describe("k8sDetector", () => {
  const k8sDetector = new K8sDetector(NAMESPACE_FILE, MOUNTINFO_FILE)

  afterEach(async () => {
    Reflect.deleteProperty(process.env, "SW_K8S_POD_NAMESPACE")
    Reflect.deleteProperty(process.env, "SW_K8S_POD_UID")
    Reflect.deleteProperty(process.env, "SW_K8S_POD_NAME")
    await fs.rm(NAMESPACE_FILE, { force: true })
    await fs.rm(MOUNTINFO_FILE, { force: true })
  })

  it("detects attributes from env", async () => {
    envNamespace()
    envUid()
    envName()

    const resource = detectResources({ detectors: [k8sDetector] })
    await resource.waitForAsyncAttributes?.()

    expect(resource.attributes).to.deep.equal({
      "k8s.namespace.name": ENV_NAMESPACE,
      "k8s.pod.uid": ENV_UID,
      "k8s.pod.name": ENV_NAME,
    })
  })

  it("detects attributes from files", async () => {
    await fileNamespace()
    await fileUid()

    const resource = detectResources({ detectors: [k8sDetector] })
    await resource.waitForAsyncAttributes?.()

    if (process.platform === "win32") {
      expect(resource.attributes).to.deep.equal({
        "k8s.namespace.name": FILE_NAMESPACE,
        "k8s.pod.name": os.hostname(),
      })
    } else {
      expect(resource.attributes).to.deep.equal({
        "k8s.namespace.name": FILE_NAMESPACE,
        "k8s.pod.uid": FILE_UID,
        "k8s.pod.name": os.hostname(),
      })
    }
  })

  it("prefers env over files", async () => {
    envNamespace()
    await fileNamespace()
    envUid()
    await fileUid()
    envName()

    const resource = detectResources({ detectors: [k8sDetector] })
    await resource.waitForAsyncAttributes?.()

    expect(resource.attributes).to.deep.equal({
      "k8s.namespace.name": ENV_NAMESPACE,
      "k8s.pod.uid": ENV_UID,
      "k8s.pod.name": ENV_NAME,
    })
  })

  it("doesn't detect uid or name without namespace", async () => {
    envUid()
    await fileUid()
    envName()

    const resource = detectResources({ detectors: [k8sDetector] })
    await resource.waitForAsyncAttributes?.()

    expect(resource.attributes).to.deep.equal({})
  })
})
