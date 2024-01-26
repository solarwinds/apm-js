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
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify"
import { FsInstrumentation } from "@opentelemetry/instrumentation-fs"
import { GenericPoolInstrumentation } from "@opentelemetry/instrumentation-generic-pool"
import { GraphQLInstrumentation } from "@opentelemetry/instrumentation-graphql"
import { GrpcInstrumentation } from "@opentelemetry/instrumentation-grpc"
import { HapiInstrumentation } from "@opentelemetry/instrumentation-hapi"
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http"
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis"
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
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg"
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino"
import { RedisInstrumentation as RedisInstrumentationV2 } from "@opentelemetry/instrumentation-redis"
import { RedisInstrumentation as RedisInstrumentationV4 } from "@opentelemetry/instrumentation-redis-4"
import { RestifyInstrumentation } from "@opentelemetry/instrumentation-restify"
import { RouterInstrumentation } from "@opentelemetry/instrumentation-router"
import { SocketIoInstrumentation } from "@opentelemetry/instrumentation-socket.io"
import { TediousInstrumentation } from "@opentelemetry/instrumentation-tedious"
import { WinstonInstrumentation } from "@opentelemetry/instrumentation-winston"
import {
  awsEc2Detector,
  awsLambdaDetector,
} from "@opentelemetry/resource-detector-aws"
import { containerDetector } from "@opentelemetry/resource-detector-container"
import {
  detectResourcesSync,
  envDetectorSync,
  hostDetectorSync,
  osDetectorSync,
  processDetectorSync,
  type Resource,
} from "@opentelemetry/resources"

const INSTRUMENTATIONS = {
  "@opentelemetry/instrumentation-amqplib": AmqplibInstrumentation,
  "@opentelemetry/instrumentation-aws-lambda": AwsLambdaInstrumentation,
  "@opentelemetry/instrumentation-aws-sdk": AwsInstrumentation,
  "@opentelemetry/instrumentation-bunyan": BunyanInstrumentation,
  "@opentelemetry/instrumentation-cassandra-driver":
    CassandraDriverInstrumentation,
  "@opentelemetry/instrumentation-connect": ConnectInstrumentation,
  "@opentelemetry/instrumentation-cucumber": CucumberInstrumentation,
  "@opentelemetry/instrumentation-dataloader": DataloaderInstrumentation,
  "@opentelemetry/instrumentation-dns": DnsInstrumentation,
  "@opentelemetry/instrumentation-express": ExpressInstrumentation,
  "@opentelemetry/instrumentation-fastify": FastifyInstrumentation,
  "@opentelemetry/instrumentation-fs": FsInstrumentation,
  "@opentelemetry/instrumentation-generic-pool": GenericPoolInstrumentation,
  "@opentelemetry/instrumentation-graphql": GraphQLInstrumentation,
  "@opentelemetry/instrumentation-grpc": GrpcInstrumentation,
  "@opentelemetry/instrumentation-hapi": HapiInstrumentation,
  "@opentelemetry/instrumentation-http": HttpInstrumentation,
  "@opentelemetry/instrumentation-ioredis": IORedisInstrumentation,
  "@opentelemetry/instrumentation-knex": KnexInstrumentation,
  "@opentelemetry/instrumentation-koa": KoaInstrumentation,
  "@opentelemetry/instrumentation-lru-memoizer": LruMemoizerInstrumentation,
  "@opentelemetry/instrumentation-memcached": MemcachedInstrumentation,
  "@opentelemetry/instrumentation-mongodb": MongoDBInstrumentation,
  "@opentelemetry/instrumentation-mongoose": MongooseInstrumentation,
  "@opentelemetry/instrumentation-mysql2": MySQL2Instrumentation,
  "@opentelemetry/instrumentation-mysql": MySQLInstrumentation,
  "@opentelemetry/instrumentation-nestjs-core": NestInstrumentation,
  "@opentelemetry/instrumentation-net": NetInstrumentation,
  "@opentelemetry/instrumentation-pg": PgInstrumentation,
  "@opentelemetry/instrumentation-pino": PinoInstrumentation,
  "@opentelemetry/instrumentation-redis": RedisInstrumentationV2,
  "@opentelemetry/instrumentation-redis-4": RedisInstrumentationV4,
  "@opentelemetry/instrumentation-restify": RestifyInstrumentation,
  "@opentelemetry/instrumentation-router": RouterInstrumentation,
  "@opentelemetry/instrumentation-socket.io": SocketIoInstrumentation,
  "@opentelemetry/instrumentation-tedious": TediousInstrumentation,
  "@opentelemetry/instrumentation-winston": WinstonInstrumentation,
}
export type InstrumentationConfigMap = {
  [I in keyof typeof INSTRUMENTATIONS]?: (typeof INSTRUMENTATIONS)[I] extends new (
    config: infer C,
    ...args: unknown[]
  ) => unknown
    ? C
    : never
}

export function getInstrumentations(
  configs: InstrumentationConfigMap,
  defaultDisabled: boolean,
): Instrumentation[] {
  const instrumentations: Instrumentation[] = []
  const c: Record<string, InstrumentationConfig> = configs

  for (const [name, Class] of Object.entries<
    new (config?: InstrumentationConfig) => Instrumentation
  >(INSTRUMENTATIONS)) {
    let config = c[name]

    if (defaultDisabled) (config ??= {}).enabled ??= false
    if (config?.enabled === false) continue

    instrumentations.push(new Class(config))
  }
  return instrumentations
}

export function getDetectedResource(): Resource {
  return detectResourcesSync({
    detectors: [
      containerDetector,
      awsEc2Detector,
      awsLambdaDetector,
      envDetectorSync,
      hostDetectorSync,
      osDetectorSync,
      processDetectorSync,
    ],
  })
}
