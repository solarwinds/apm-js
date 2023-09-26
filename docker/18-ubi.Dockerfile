FROM registry.access.redhat.com/ubi9

RUN dnf install -y \
    curl-minimal \
    git \
    git-lfs \
    tar \
    xz

RUN dnf module disable -y nodejs && \
    dnf install -y https://rpm.nodesource.com/pub_18.x/nodistro/repo/nodesource-release-nodistro-1.noarch.rpm && \
    update-crypto-policies --set LEGACY && \
    dnf install -y nodejs && \
    update-crypto-policies --set DEFAULT && \
    dnf clean -y all

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
