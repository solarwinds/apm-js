FROM node:18-alpine3.17

RUN apk add --no-cache \
    curl \
    gcompat \
    git \
    libc6-compat

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/sh", "-c"]
