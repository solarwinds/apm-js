FROM registry.access.redhat.com/ubi9

RUN dnf install -y \
    curl-minimal \
    git \
    git-lfs \
    tar \
    xz

RUN dnf module disable -y nodejs && \
    update-crypto-policies --set LEGACY && \
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && \
    dnf install -y nodejs && \
    update-crypto-policies --set DEFAULT && \
    dnf clean -y all

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
