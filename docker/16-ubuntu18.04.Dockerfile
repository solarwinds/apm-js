FROM ubuntu:18.04

RUN apt-get update && apt-get install -y \
    curl \
    git \
    git-lfs \
    xz-utils

RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs

RUN corepack enable

WORKDIR /swotel
ENTRYPOINT ["/bin/sh", "-c"]
