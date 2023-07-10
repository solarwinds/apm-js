FROM registry.access.redhat.com/ubi9-minimal

RUN microdnf install -y \
    curl-minimal \
    git \
    git-lfs \
    tar \
    xz

RUN curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - && \
    microdnf module disable -y nodejs && \
    microdnf install -y nodejs && \
    microdnf clean -y all

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
