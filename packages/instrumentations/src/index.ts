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

import { FastifyOtelInstrumentation } from "@fastify/otel"
import { type Instrumentation } from "@opentelemetry/instrumentation"
import { AmqplibInstrumentation } from "@opentelemetry/instrumentation-amqplib"
import { AwsLambdaInstrumentation } from "@opentelemetry/instrumentation-aws-lambda"
import { AwsInstrumentation } from "@opentelemetry/instrumentation-aws-sdk"
import { BunyanInstrumentation } from "@opentelemetry/instrumentation-bunyan"
import { CassandraDriverInstrumentation } from "@opentelemetry/instrumentation-cassandra-driver"
import { ConnectInstrumentation } from "@opentelemetry/instrumentation-connect"
import { CucumberInstrumentation } from "@opentelemetry/instrumentation-cucumber"
import { DataloaderInstrumentation } from "@opentelemetry/instrumentation-dataloader"
import { DnsInstrumentation } from "@opentelemetry/instrumentation-dns"
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express"
import { FsInstrumentation } from "@opentelemetry/instrumentation-fs"
import { GenericPoolInstrumentation } from "@opentelemetry/instrumentation-generic-pool"
import { GraphQLInstrumentation } from "@opentelemetry/instrumentation-graphql"
import { GrpcInstrumentation } from "@opentelemetry/instrumentation-grpc"
import { HapiInstrumentation } from "@opentelemetry/instrumentation-hapi"
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http"
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis"
import { KafkaJsInstrumentation } from "@opentelemetry/instrumentation-kafkajs"
import { KnexInstrumentation } from "@opentelemetry/instrumentation-knex"
import { KoaInstrumentation } from "@opentelemetry/instrumentation-koa"
import { LruMemoizerInstrumentation } from "@opentelemetry/instrumentation-lru-memoizer"
import { MemcachedInstrumentation } from "@opentelemetry/instrumentation-memcached"
import { MongoDBInstrumentation } from "@opentelemetry/instrumentation-mongodb"
import { MongooseInstrumentation } from "@opentelemetry/instrumentation-mongoose"
import { MySQLInstrumentation } from "@opentelemetry/instrumentation-mysql"
import { MySQL2Instrumentation } from "@opentelemetry/instrumentation-mysql2"
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core"
import { NetInstrumentation } from "@opentelemetry/instrumentation-net"
import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai"
import { OracleInstrumentation } from "@opentelemetry/instrumentation-oracledb"
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg"
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino"
import { RedisInstrumentation } from "@opentelemetry/instrumentation-redis"
import { RestifyInstrumentation } from "@opentelemetry/instrumentation-restify"
import { RouterInstrumentation } from "@opentelemetry/instrumentation-router"
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node"
import { SocketIoInstrumentation } from "@opentelemetry/instrumentation-socket.io"
import { TediousInstrumentation } from "@opentelemetry/instrumentation-tedious"
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici"
import { WinstonInstrumentation } from "@opentelemetry/instrumentation-winston"
import {
  awsBeanstalkDetector,
  awsEc2Detector,
  awsEcsDetector,
  awsEksDetector,
  awsLambdaDetector,
} from "@opentelemetry/resource-detector-aws"
import {
  azureAppServiceDetector,
  azureFunctionsDetector,
  azureVmDetector,
} from "@opentelemetry/resource-detector-azure"
import { containerDetector } from "@opentelemetry/resource-detector-container/build/src/detectors/index.js"
import { gcpDetector } from "@opentelemetry/resource-detector-gcp"
import {
  envDetector,
  hostDetector,
  osDetector,
  processDetector,
  type ResourceDetector,
  serviceInstanceIdDetector,
} from "@opentelemetry/resources"

import { k8sDetector } from "./resource-detector-k8s.js"
import { uamsDetector } from "./resource-detector-uams.js"

// Maps of instrumentation module name to instrumentation class constructor
const INSTRUMENTATIONS = {
  "@opentelemetry/instrumentation-http": [HttpInstrumentation, { core: true }],
  "@opentelemetry/instrumentation-undici": [
    UndiciInstrumentation,
    { core: true },
  ],

  "@fastify/otel": [FastifyOtelInstrumentation, { core: false }],
  "@opentelemetry/instrumentation-amqplib": [
    AmqplibInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-aws-lambda": [
    AwsLambdaInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-aws-sdk": [
    AwsInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-bunyan": [
    BunyanInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-cassandra-driver": [
    CassandraDriverInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-connect": [
    ConnectInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-cucumber": [
    CucumberInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-dataloader": [
    DataloaderInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-dns": [DnsInstrumentation, { core: false }],
  "@opentelemetry/instrumentation-express": [
    ExpressInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-fs": [FsInstrumentation, { core: false }],
  "@opentelemetry/instrumentation-generic-pool": [
    GenericPoolInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-graphql": [
    GraphQLInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-grpc": [GrpcInstrumentation, { core: false }],
  "@opentelemetry/instrumentation-hapi": [HapiInstrumentation, { core: false }],
  "@opentelemetry/instrumentation-ioredis": [
    IORedisInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-kafkajs": [
    KafkaJsInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-knex": [KnexInstrumentation, { core: false }],
  "@opentelemetry/instrumentation-koa": [KoaInstrumentation, { core: false }],
  "@opentelemetry/instrumentation-lru-memoizer": [
    LruMemoizerInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-memcached": [
    MemcachedInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-mongodb": [
    MongoDBInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-mongoose": [
    MongooseInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-mysql2": [
    MySQL2Instrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-mysql": [
    MySQLInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-nestjs-core": [
    NestInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-net": [NetInstrumentation, { core: false }],
  "@opentelemetry/instrumentation-oracledb": [
    OracleInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-openai": [
    OpenAIInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-pg": [PgInstrumentation, { core: false }],
  "@opentelemetry/instrumentation-pino": [PinoInstrumentation, { core: false }],
  "@opentelemetry/instrumentation-redis": [
    RedisInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-restify": [
    RestifyInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-router": [
    RouterInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-runtime-node": [
    RuntimeNodeInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-socket.io": [
    SocketIoInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-tedious": [
    TediousInstrumentation,
    { core: false },
  ],
  "@opentelemetry/instrumentation-winston": [
    WinstonInstrumentation,
    { core: false },
  ],
} as const
type Instrumentations = typeof INSTRUMENTATIONS

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
// List of resource detectors and the import they come from
// Later resource detectors will override attributes set by earlier ones, so the order here is important
const RESOURCE_DETECTORS = [
  // basic detectors, lowest precedence
  [
    "@opentelemetry/hostDetector",
    hostDetector as ResourceDetector,
    { core: true },
  ],
  ["@opentelemetry/osDetector", osDetector as ResourceDetector, { core: true }],
  [
    "@opentelemetry/processDetector",
    processDetector as ResourceDetector,
    { core: true },
  ],
  [
    "@opentelemetry/serviceInstanceIdDetector",
    serviceInstanceIdDetector as ResourceDetector,
    { core: true },
  ],

  // generic detectors
  [
    "@opentelemetry/containerDetector",
    containerDetector as ResourceDetector,
    { core: false },
  ],
  [
    "@solarwinds-apm/k8sDetector",
    k8sDetector as ResourceDetector,
    { core: false },
  ],
  [
    "@solarwinds-apm/uamsDetector",
    uamsDetector as ResourceDetector,
    { core: false },
  ],

  // cloud specific detectors
  [
    "@opentelemetry/awsEc2Detector",
    awsEc2Detector as ResourceDetector,
    { core: false },
  ],
  [
    "@opentelemetry/awsLambdaDetector",
    awsLambdaDetector as ResourceDetector,
    { core: false },
  ],
  [
    "@opentelemetry/awsEcsDetector",
    awsEcsDetector as ResourceDetector,
    { core: false },
  ],
  [
    "@opentelemetry/awsEksDetector",
    awsEksDetector as ResourceDetector,
    { core: false },
  ],
  [
    "@opentelemetry/awsBeanstalkDetector",
    awsBeanstalkDetector as ResourceDetector,
    { core: false },
  ],
  [
    "@opentelemetry/azureVmDetector",
    azureVmDetector as ResourceDetector,
    { core: false },
  ],
  [
    "@opentelemetry/azureFunctionsDetector",
    azureFunctionsDetector as ResourceDetector,
    { core: false },
  ],
  [
    "@opentelemetry/azureAppServiceDetector",
    azureAppServiceDetector as ResourceDetector,
    { core: false },
  ],
  [
    "@opentelemetry/gcpDetector",
    gcpDetector as ResourceDetector,
    { core: false },
  ],

  // env detector, highest precedence
  [
    "@opentelemetry/envDetector",
    envDetector as ResourceDetector,
    { core: true },
  ],
] as const
type ResourceDetectors = typeof RESOURCE_DETECTORS
/* eslint-enable @typescript-eslint/no-unnecessary-type-assertion */

export type InstrumentationConfigMap = {
  [I in keyof Instrumentations]?: Instrumentations[I][0] extends new (
    config: infer C,
  ) => Instrumentation
    ? C
    : never
}
export type ResourceDetectorConfigMap = Partial<
  Record<ResourceDetectors[number][0], boolean>
>

export type Set = "none" | "core" | "all"

export function getInstrumentations(
  configs: InstrumentationConfigMap,
  set: Set,
): Instrumentation[] {
  return Object.entries(INSTRUMENTATIONS)
    .filter(([name, [, { core }]]) => {
      const fromConfig =
        configs[name as keyof InstrumentationConfigMap]?.enabled
      const fromSet = set === "all" || (set === "core" && core)
      return fromConfig ?? fromSet
    })
    .map(([name, [Class]]) => {
      const config = configs[name as keyof InstrumentationConfigMap] ?? {}
      return new Class(config)
    })
}

export function getResourceDetectors(
  configs: ResourceDetectorConfigMap,
  set: Set,
): ResourceDetector[] {
  return RESOURCE_DETECTORS.filter(([name, , { core }]) => {
    const fromConfig = configs[name]
    const fromSet = set === "all" || (set === "core" && core)
    return fromConfig ?? fromSet
  }).map(([, detector]) => detector)
}
