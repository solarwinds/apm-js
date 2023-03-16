FROM amazonlinux:2

RUN yum install -y \
    curl \
    git \
    git-lfs \
    xz

RUN curl -fsSL https://rpm.nodesource.com/setup_16.x | bash - && \
    yum install -y nodejs && \
    yum clean all

RUN corepack enable

WORKDIR /swotel
ENTRYPOINT ["/bin/bash", "-c"]
