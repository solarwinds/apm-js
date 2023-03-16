FROM node:18-alpine

RUN apk add --no-cache \
    curl \
    gcompat \
    git \
    git-lfs \
    libc6-compat \
    tar \
    xz

RUN corepack enable

WORKDIR /swotel
ENTRYPOINT ["/bin/sh", "-c"]
