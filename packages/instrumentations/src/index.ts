/*
Copyright 2023-2024 SolarWinds Worldwide, LLC.

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

import {
  type Instrumentation,
  type InstrumentationConfig,
} from "@opentelemetry/instrumentation"
import { type AmqplibInstrumentation } from "@opentelemetry/instrumentation-amqplib"
import { type AwsLambdaInstrumentation } from "@opentelemetry/instrumentation-aws-lambda"
import { type AwsInstrumentation } from "@opentelemetry/instrumentation-aws-sdk"
import { type BunyanInstrumentation } from "@opentelemetry/instrumentation-bunyan"
import { type CassandraDriverInstrumentation } from "@opentelemetry/instrumentation-cassandra-driver"
import { type ConnectInstrumentation } from "@opentelemetry/instrumentation-connect"
import { type CucumberInstrumentation } from "@opentelemetry/instrumentation-cucumber"
import { type DataloaderInstrumentation } from "@opentelemetry/instrumentation-dataloader"
import { type DnsInstrumentation } from "@opentelemetry/instrumentation-dns"
import { type ExpressInstrumentation } from "@opentelemetry/instrumentation-express"
import { type FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify"
import { type FsInstrumentation } from "@opentelemetry/instrumentation-fs"
import { type GenericPoolInstrumentation } from "@opentelemetry/instrumentation-generic-pool"
import { type GraphQLInstrumentation } from "@opentelemetry/instrumentation-graphql"
import { type GrpcInstrumentation } from "@opentelemetry/instrumentation-grpc"
import { type HapiInstrumentation } from "@opentelemetry/instrumentation-hapi"
import { type HttpInstrumentation } from "@opentelemetry/instrumentation-http"
import { type IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis"
import { type KafkaJsInstrumentation } from "@opentelemetry/instrumentation-kafkajs"
import { type KnexInstrumentation } from "@opentelemetry/instrumentation-knex"
import { type KoaInstrumentation } from "@opentelemetry/instrumentation-koa"
import { type LruMemoizerInstrumentation } from "@opentelemetry/instrumentation-lru-memoizer"
import { type MemcachedInstrumentation } from "@opentelemetry/instrumentation-memcached"
import { type MongoDBInstrumentation } from "@opentelemetry/instrumentation-mongodb"
import { type MongooseInstrumentation } from "@opentelemetry/instrumentation-mongoose"
import { type MySQLInstrumentation } from "@opentelemetry/instrumentation-mysql"
import { type MySQL2Instrumentation } from "@opentelemetry/instrumentation-mysql2"
import { type NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core"
import { type NetInstrumentation } from "@opentelemetry/instrumentation-net"
import { type PgInstrumentation } from "@opentelemetry/instrumentation-pg"
import { type PinoInstrumentation } from "@opentelemetry/instrumentation-pino"
import { type RedisInstrumentation as RedisInstrumentationV2 } from "@opentelemetry/instrumentation-redis"
import { type RedisInstrumentation as RedisInstrumentationV4 } from "@opentelemetry/instrumentation-redis-4"
import { type RestifyInstrumentation } from "@opentelemetry/instrumentation-restify"
import { type RouterInstrumentation } from "@opentelemetry/instrumentation-router"
import { type SocketIoInstrumentation } from "@opentelemetry/instrumentation-socket.io"
import { type TediousInstrumentation } from "@opentelemetry/instrumentation-tedious"
import { type UndiciInstrumentation } from "@opentelemetry/instrumentation-undici"
import { type WinstonInstrumentation } from "@opentelemetry/instrumentation-winston"
import {
  type Detector,
  type DetectorSync,
  Resource,
} from "@opentelemetry/resources"
import { load } from "@solarwinds-apm/module/load"

// map of package names to their instrumentation type
interface InstrumentationTypes {
  "@opentelemetry/instrumentation-amqplib": typeof AmqplibInstrumentation
  "@opentelemetry/instrumentation-aws-lambda": typeof AwsLambdaInstrumentation
  "@opentelemetry/instrumentation-aws-sdk": typeof AwsInstrumentation
  "@opentelemetry/instrumentation-bunyan": typeof BunyanInstrumentation
  "@opentelemetry/instrumentation-cassandra-driver": typeof CassandraDriverInstrumentation
  "@opentelemetry/instrumentation-connect": typeof ConnectInstrumentation
  "@opentelemetry/instrumentation-cucumber": typeof CucumberInstrumentation
  "@opentelemetry/instrumentation-dataloader": typeof DataloaderInstrumentation
  "@opentelemetry/instrumentation-dns": typeof DnsInstrumentation
  "@opentelemetry/instrumentation-express": typeof ExpressInstrumentation
  "@opentelemetry/instrumentation-fastify": typeof FastifyInstrumentation
  "@opentelemetry/instrumentation-fs": typeof FsInstrumentation
  "@opentelemetry/instrumentation-generic-pool": typeof GenericPoolInstrumentation
  "@opentelemetry/instrumentation-graphql": typeof GraphQLInstrumentation
  "@opentelemetry/instrumentation-grpc": typeof GrpcInstrumentation
  "@opentelemetry/instrumentation-hapi": typeof HapiInstrumentation
  "@opentelemetry/instrumentation-http": typeof HttpInstrumentation
  "@opentelemetry/instrumentation-ioredis": typeof IORedisInstrumentation
  "@opentelemetry/instrumentation-kafkajs": typeof KafkaJsInstrumentation
  "@opentelemetry/instrumentation-knex": typeof KnexInstrumentation
  "@opentelemetry/instrumentation-koa": typeof KoaInstrumentation
  "@opentelemetry/instrumentation-lru-memoizer": typeof LruMemoizerInstrumentation
  "@opentelemetry/instrumentation-memcached": typeof MemcachedInstrumentation
  "@opentelemetry/instrumentation-mongodb": typeof MongoDBInstrumentation
  "@opentelemetry/instrumentation-mongoose": typeof MongooseInstrumentation
  "@opentelemetry/instrumentation-mysql2": typeof MySQL2Instrumentation
  "@opentelemetry/instrumentation-mysql": typeof MySQLInstrumentation
  "@opentelemetry/instrumentation-nestjs-core": typeof NestInstrumentation
  "@opentelemetry/instrumentation-net": typeof NetInstrumentation
  "@opentelemetry/instrumentation-pg": typeof PgInstrumentation
  "@opentelemetry/instrumentation-pino": typeof PinoInstrumentation
  "@opentelemetry/instrumentation-redis": typeof RedisInstrumentationV2
  "@opentelemetry/instrumentation-redis-4": typeof RedisInstrumentationV4
  "@opentelemetry/instrumentation-restify": typeof RestifyInstrumentation
  "@opentelemetry/instrumentation-router": typeof RouterInstrumentation
  "@opentelemetry/instrumentation-socket.io": typeof SocketIoInstrumentation
  "@opentelemetry/instrumentation-tedious": typeof TediousInstrumentation
  "@opentelemetry/instrumentation-undici": typeof UndiciInstrumentation
  "@opentelemetry/instrumentation-winston": typeof WinstonInstrumentation
}

// Maps of instrumentation module name to instrumentation class name
const CORE_INSTRUMENTATIONS = {
  "@opentelemetry/instrumentation-http": "HttpInstrumentation",
  "@opentelemetry/instrumentation-undici": "UndiciInstrumentation",
} as const
const INSTRUMENTATIONS = {
  "@opentelemetry/instrumentation-amqplib": "AmqplibInstrumentation",
  "@opentelemetry/instrumentation-aws-lambda": "AwsLambdaInstrumentation",
  "@opentelemetry/instrumentation-aws-sdk": "AwsInstrumentation",
  "@opentelemetry/instrumentation-bunyan": "BunyanInstrumentation",
  "@opentelemetry/instrumentation-cassandra-driver":
    "CassandraDriverInstrumentation",
  "@opentelemetry/instrumentation-connect": "ConnectInstrumentation",
  "@opentelemetry/instrumentation-cucumber": "CucumberInstrumentation",
  "@opentelemetry/instrumentation-dataloader": "DataloaderInstrumentation",
  "@opentelemetry/instrumentation-dns": "DnsInstrumentation",
  "@opentelemetry/instrumentation-express": "ExpressInstrumentation",
  "@opentelemetry/instrumentation-fastify": "FastifyInstrumentation",
  "@opentelemetry/instrumentation-fs": "FsInstrumentation",
  "@opentelemetry/instrumentation-generic-pool": "GenericPoolInstrumentation",
  "@opentelemetry/instrumentation-graphql": "GraphQLInstrumentation",
  "@opentelemetry/instrumentation-grpc": "GrpcInstrumentation",
  "@opentelemetry/instrumentation-hapi": "HapiInstrumentation",
  "@opentelemetry/instrumentation-ioredis": "IORedisInstrumentation",
  "@opentelemetry/instrumentation-kafkajs": "KafkaJsInstrumentation",
  "@opentelemetry/instrumentation-knex": "KnexInstrumentation",
  "@opentelemetry/instrumentation-koa": "KoaInstrumentation",
  "@opentelemetry/instrumentation-lru-memoizer": "LruMemoizerInstrumentation",
  "@opentelemetry/instrumentation-memcached": "MemcachedInstrumentation",
  "@opentelemetry/instrumentation-mongodb": "MongoDBInstrumentation",
  "@opentelemetry/instrumentation-mongoose": "MongooseInstrumentation",
  "@opentelemetry/instrumentation-mysql2": "MySQL2Instrumentation",
  "@opentelemetry/instrumentation-mysql": "MySQLInstrumentation",
  "@opentelemetry/instrumentation-nestjs-core": "NestInstrumentation",
  "@opentelemetry/instrumentation-net": "NetInstrumentation",
  "@opentelemetry/instrumentation-pg": "PgInstrumentation",
  "@opentelemetry/instrumentation-pino": "PinoInstrumentation",
  "@opentelemetry/instrumentation-redis": "RedisInstrumentation",
  "@opentelemetry/instrumentation-redis-4": "RedisInstrumentation",
  "@opentelemetry/instrumentation-restify": "RestifyInstrumentation",
  "@opentelemetry/instrumentation-router": "RouterInstrumentation",
  "@opentelemetry/instrumentation-socket.io": "SocketIoInstrumentation",
  "@opentelemetry/instrumentation-tedious": "TediousInstrumentation",
  "@opentelemetry/instrumentation-winston": "WinstonInstrumentation",
} as const

// Maps of resource detector module names to list of detector names
const CORE_RESOURCE_DETECTORS = {
  "@opentelemetry/resources": [
    "envDetectorSync",
    "hostDetectorSync",
    "osDetectorSync",
    "processDetectorSync",
  ],
} as const
const RESOURCE_DETECTORS = {
  "@opentelemetry/resource-detector-aws": ["awsEc2Detector"],
  "@opentelemetry/resource-detector-azure": ["azureAppServiceDetector"],
  "@opentelemetry/resource-detector-container": ["containerDetector"],
} as const

export type InstrumentationConfigMap = {
  [I in keyof InstrumentationTypes]?: InstrumentationTypes[I] extends new (
    config: infer C,
  ) => Instrumentation
    ? C
    : never
}
export type ResourceDetectorConfigMap = {
  [R in keyof (typeof CORE_RESOURCE_DETECTORS & typeof RESOURCE_DETECTORS)]?: {
    [N in (typeof CORE_RESOURCE_DETECTORS &
      typeof RESOURCE_DETECTORS)[R][number]]?: boolean
  }
}

export type Set = "none" | "core" | "all"

export function getInstrumentations(
  configs: InstrumentationConfigMap,
  set: Set,
): Promise<Instrumentation[]> {
  const instrumentations = [
    ...Object.entries(CORE_INSTRUMENTATIONS).map(([module, name]) => ({
      module,
      name,
      // core instrumentations are enabled by default unless the set is "none"
      enabled: set !== "none",
    })),
    ...Object.entries(INSTRUMENTATIONS).map(([module, name]) => ({
      module,
      name,
      // other instrumentations are disabled by default unless the set is "all"
      enabled: set === "all",
    })),
  ]
    .map(({ module, name, enabled }) => {
      // the user-provided config always takes precedence over our defaults
      const config = configs[module as keyof InstrumentationConfigMap] ?? {}
      config.enabled ??= enabled

      return { module, name, config }
    })
    // only load enabled instrumentations
    .filter(({ config }) => config.enabled)

  // Load and instantiate all of the instrumentations concurrently
  return Promise.all(
    instrumentations.map(async ({ module, name, config }) => {
      const loaded = await load(module)

      if (typeof loaded === "function") {
        // there is a single export which we assume to be the instrumentation
        const Class = loaded as new (
          config: InstrumentationConfig,
        ) => Instrumentation

        return new Class(config)
      } else {
        // there are multiple exports so we retrieve the class by name
        const Class = (
          loaded as Record<
            typeof name,
            new (config: InstrumentationConfig) => Instrumentation
          >
        )[name]

        return new Class(config)
      }
    }),
  )
}

export function getResource(
  configs: ResourceDetectorConfigMap,
  set: Set,
): Resource {
  const resourceDetectors = [
    ...Object.entries(CORE_RESOURCE_DETECTORS).flatMap(([module, names]) =>
      names.map((name) => ({
        module,
        name,
        // core resource detectors are enabled by default unless the set is "none"
        enabled: set !== "none",
      })),
    ),
    ...Object.entries(RESOURCE_DETECTORS).flatMap(([module, names]) =>
      names.map((name) => ({
        module,
        name,
        // other resource detectors are disabled by default unless the set is "all"
        enabled: set === "all",
      })),
    ),
  ].filter(
    ({ module, name, enabled }) =>
      (configs as Record<string, Record<string, boolean>>)[module]?.[name] ??
      enabled,
  )

  // The Resource constructor accepts a promise resolving to arguments,
  // so we create one by loading each detector module, then calling its detector,
  // then waiting for the resource attributes to be available, concurrently
  // for every enabled detector. Once all of these concurrent tasks have completed
  // we merge all of the resulting attributes.
  const attributes = Promise.all(
    resourceDetectors.map(async ({ module, name }) => {
      try {
        const loaded = await load(module)
        const detector = (
          loaded as Record<typeof name, Detector | DetectorSync>
        )[name]

        const resource = await detector.detect()
        await resource.waitForAsyncAttributes?.()

        return resource.attributes
      } catch {
        return {}
      }
    }),
  ).then((attributes) =>
    attributes.reduce((all, next) => ({ ...all, ...next })),
  )

  return new Resource({}, attributes)
}
