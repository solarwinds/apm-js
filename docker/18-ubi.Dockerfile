FROM registry.access.redhat.com/ubi9-minimal

RUN microdnf install -y \
    curl \
    git \
    git-lfs \
    xz

RUN curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - && \
    microdnf module disable nodejs && \
    microdnf install -y nodejs && \
    microdnf clean all

RUN corepack enable

WORKDIR /swotel
ENTRYPOINT ["/bin/bash", "-c"]
