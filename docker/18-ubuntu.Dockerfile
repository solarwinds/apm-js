FROM ubuntu

RUN apt-get update && apt-get install -y \
    curl \
    git \
    git-lfs \
    xz-utils

RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean

RUN corepack enable

WORKDIR /swotel
ENTRYPOINT ["/bin/sh", "-c"]
