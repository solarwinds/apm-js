FROM amazonlinux

RUN dnf install -y \
    curl-minimal \
    git \
    git-lfs \
    tar \
    xz

RUN dnf install -y https://rpm.nodesource.com/pub_20.x/nodistro/repo/nodesource-release-nodistro-1.noarch.rpm && \
    dnf install -y nodejs && \
    dnf clean -y all

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
