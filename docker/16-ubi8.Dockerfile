FROM registry.access.redhat.com/ubi8-minimal

RUN microdnf install -y \
    curl \
    git \
    git-lfs \
    tar \
    xz

RUN microdnf module disable -y nodejs && \
    microdnf install -y https://rpm.nodesource.com/pub_16.x/nodistro/repo/nodesource-release-nodistro-1.noarch.rpm && \
    microdnf install -y nodejs && \
    microdnf clean -y all

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
