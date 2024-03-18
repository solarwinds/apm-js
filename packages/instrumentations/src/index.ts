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
import { type WinstonInstrumentation } from "@opentelemetry/instrumentation-winston"
import {
  type DetectorSync,
  detectResourcesSync,
  type Resource,
} from "@opentelemetry/resources"
import { load } from "@solarwinds-apm/module/load"

// map of package names to their instrumentation type
interface InstrumentationTypes {
  "@opentelemetry/instrumentation-amqplib": AmqplibInstrumentation
  "@opentelemetry/instrumentation-aws-lambda": AwsLambdaInstrumentation
  "@opentelemetry/instrumentation-aws-sdk": AwsInstrumentation
  "@opentelemetry/instrumentation-bunyan": BunyanInstrumentation
  "@opentelemetry/instrumentation-cassandra-driver": CassandraDriverInstrumentation
  "@opentelemetry/instrumentation-connect": ConnectInstrumentation
  "@opentelemetry/instrumentation-cucumber": CucumberInstrumentation
  "@opentelemetry/instrumentation-dataloader": DataloaderInstrumentation
  "@opentelemetry/instrumentation-dns": DnsInstrumentation
  "@opentelemetry/instrumentation-express": ExpressInstrumentation
  "@opentelemetry/instrumentation-fastify": FastifyInstrumentation
  "@opentelemetry/instrumentation-fs": FsInstrumentation
  "@opentelemetry/instrumentation-generic-pool": GenericPoolInstrumentation
  "@opentelemetry/instrumentation-graphql": GraphQLInstrumentation
  "@opentelemetry/instrumentation-grpc": GrpcInstrumentation
  "@opentelemetry/instrumentation-hapi": HapiInstrumentation
  "@opentelemetry/instrumentation-http": HttpInstrumentation
  "@opentelemetry/instrumentation-ioredis": IORedisInstrumentation
  "@opentelemetry/instrumentation-knex": KnexInstrumentation
  "@opentelemetry/instrumentation-koa": KoaInstrumentation
  "@opentelemetry/instrumentation-lru-memoizer": LruMemoizerInstrumentation
  "@opentelemetry/instrumentation-memcached": MemcachedInstrumentation
  "@opentelemetry/instrumentation-mongodb": MongoDBInstrumentation
  "@opentelemetry/instrumentation-mongoose": MongooseInstrumentation
  "@opentelemetry/instrumentation-mysql2": MySQL2Instrumentation
  "@opentelemetry/instrumentation-mysql": MySQLInstrumentation
  "@opentelemetry/instrumentation-nestjs-core": NestInstrumentation
  "@opentelemetry/instrumentation-net": NetInstrumentation
  "@opentelemetry/instrumentation-pg": PgInstrumentation
  "@opentelemetry/instrumentation-pino": PinoInstrumentation
  "@opentelemetry/instrumentation-redis": RedisInstrumentationV2
  "@opentelemetry/instrumentation-redis-4": RedisInstrumentationV4
  "@opentelemetry/instrumentation-restify": RestifyInstrumentation
  "@opentelemetry/instrumentation-router": RouterInstrumentation
  "@opentelemetry/instrumentation-socket.io": SocketIoInstrumentation
  "@opentelemetry/instrumentation-tedious": TediousInstrumentation
  "@opentelemetry/instrumentation-winston": WinstonInstrumentation
}
// map of instrumentation package names to the name of their exported instrumentation class
const INSTRUMENTATION_NAMES: Record<string, string> = {
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
  "@opentelemetry/instrumentation-http": "HttpInstrumentation",
  "@opentelemetry/instrumentation-ioredis": "IORedisInstrumentation",
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
}

// map of resource detector package names to the names of their exported detectors
const CORE_RESOURCE_DETECTOR_NAMES: Record<string, string[]> = {
  "@opentelemetry/resources": [
    "envDetectorSync",
    "hostDetectorSync",
    "osDetectorSync",
    "processDetectorSync",
  ],
}
const EXTRA_RESOURCE_DETECTOR_NAMES: Record<string, string[]> = {
  "@opentelemetry/resource-detector-aws": ["awsEc2Detector"],
  "@opentelemetry/resource-detector-azure": ["azureAppServiceDetector"],
  "@opentelemetry/resource-detector-container": ["containerDetector"],
}

export type InstrumentationConfigMap = {
  [I in keyof InstrumentationTypes]?: InstrumentationTypes[I] extends {
    setConfig(config: infer C): unknown
  }
    ? C
    : never
}

export function getInstrumentations(
  configs: InstrumentationConfigMap,
  defaultDisabled: boolean,
): Instrumentation[] | Promise<Instrumentation[]> {
  const allConfigs = Object.assign(
    // one entry per available instrumentations
    Object.fromEntries(
      Object.keys(INSTRUMENTATION_NAMES).map((name) => [name, {}]),
    ),
    // override defaults using the entries present in the config while
    // filtering out entries from the config that are not available
    Object.fromEntries(
      Object.entries(configs).filter(([name]) =>
        Object.keys(INSTRUMENTATION_NAMES).includes(name),
      ),
    ),
  )

  const instrumentations = Object.entries(allConfigs)
    .filter(([, config]: [unknown, InstrumentationConfig]) => {
      // explicitly set "enabled" to false if that's the default
      if (defaultDisabled) config.enabled ??= false
      // filter out disabled instrumentations
      return config.enabled !== false
    })
    .map(([name, config]) => {
      // instantiate the instrumentation class exported from package
      const instantiate = (loaded: unknown) => {
        const Class = (
          loaded as Record<
            string,
            new (config: InstrumentationConfig) => Instrumentation
          >
        )[INSTRUMENTATION_NAMES[name]!]!
        return new Class(config)
      }

      // load is synchronous in CJS but async in ESM
      const loaded = load(name)
      if (loaded instanceof Promise) return loaded.then(instantiate)
      else return instantiate(loaded)
    })

  if (instrumentations.length > 0 && instrumentations[0] instanceof Promise)
    return Promise.all(instrumentations)
  else return instrumentations as Instrumentation[]
}

export async function getDetectedResource(extra: boolean): Promise<Resource> {
  let names = { ...CORE_RESOURCE_DETECTOR_NAMES }
  if (extra) {
    names = { ...names, ...EXTRA_RESOURCE_DETECTOR_NAMES }
  }

  const detectors = await Promise.all(
    Object.entries(names).map(async ([name, detectors]) => {
      const loaded = await load(name)
      return Object.entries(loaded as object)
        .filter(([name]) => detectors.includes(name))
        .map(([, detector]) => detector as DetectorSync)
    }),
  )

  return detectResourcesSync({
    detectors: detectors.flat(),
  })
}
