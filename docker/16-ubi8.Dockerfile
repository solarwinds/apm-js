FROM registry.access.redhat.com/ubi8

RUN dnf install -y \
    curl \
    git \
    git-lfs \
    tar \
    xz

RUN dnf module disable -y nodejs && \
    dnf install -y https://rpm.nodesource.com/pub_16.x/nodistro/repo/nodesource-release-nodistro-1.noarch.rpm && \
    dnf install -y nodejs && \
    dnf clean -y all

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
