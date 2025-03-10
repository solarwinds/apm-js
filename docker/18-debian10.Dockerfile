FROM node:18-buster-slim

RUN apt-get update && apt-get install -y \
    curl \
    git \
    git-lfs \
    xz-utils \
    && apt-get clean

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
