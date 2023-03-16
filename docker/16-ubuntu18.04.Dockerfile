FROM ubuntu:18.04

RUN apt-get install -y software-properties-common

RUN add-apt-repository ppa:git-core/ppa && \
    apt-get update && apt-get install -y \
    curl \
    git \
    git-lfs \
    xz-utils

RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean

RUN corepack enable

WORKDIR /swotel
ENTRYPOINT ["/bin/sh", "-c"]
