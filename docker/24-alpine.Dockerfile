FROM node:24-alpine

RUN apk add --no-cache \
    curl \
    gcompat \
    git \
    libc6-compat

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/sh", "-c"]
