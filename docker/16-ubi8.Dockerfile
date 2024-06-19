FROM registry.access.redhat.com/ubi8

RUN dnf install -y \
    curl \
    git \
    git-lfs \
    tar \
    xz

RUN dnf module disable -y nodejs && \
    curl -fsSL https://rpm.nodesource.com/setup_16.x | bash - && \
    dnf install -y nodejs && \
    dnf clean -y all

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
