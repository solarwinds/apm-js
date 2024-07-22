FROM ubuntu

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    git \
    git-lfs \
    xz-utils

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get update && \
    apt-get install -y nodejs && \
    apt-get clean

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/sh", "-c"]
