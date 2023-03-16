FROM registry.access.redhat.com/ubi8/nodejs-16

RUN yum install -y \
    curl \
    git \
    git-lfs \
    xz

RUN corepack enable

WORKDIR /swotel
ENTRYPOINT ["/bin/bash", "-c"]
