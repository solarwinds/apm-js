FROM registry.access.redhat.com/ubi9-minimal

RUN microdnf install -y \
    curl-minimal \
    git \
    git-lfs \
    tar \
    xz

RUN microdnf module disable -y nodejs && \
    microdnf install -y https://rpm.nodesource.com/pub_18.x/nodistro/repo/nodesource-release-nodistro-1.noarch.rpm && \
    microdnf install -y nodejs && \
    microdnf clean -y all

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
