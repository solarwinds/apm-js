FROM node:24-alpine

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
