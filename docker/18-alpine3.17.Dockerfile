FROM node:18-alpine3.17

RUN apk add --no-cache \
    curl \
    gcompat \
    git \
    git-lfs \
    libc6-compat \
    tar \
    xz

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/sh", "-c"]
