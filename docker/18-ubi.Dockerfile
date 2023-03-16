FROM registry.access.redhat.com/ubi9/nodejs-18

RUN yum install -y \
    curl \
    git \
    git-lfs \
    xz

RUN corepack enable

WORKDIR /swotel
ENTRYPOINT ["/bin/bash", "-c"]
