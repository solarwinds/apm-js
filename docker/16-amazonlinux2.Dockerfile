FROM amazonlinux:2

RUN amazon-linux-extras install -y epel && \
    yum install -y \
    curl \
    git \
    git-lfs \
    tar \
    xz

RUN curl -fsSL https://rpm.nodesource.com/setup_16.x | bash - && \
    yum install -y nodejs && \
    yum clean all

RUN corepack enable

WORKDIR /swotel
ENTRYPOINT ["/bin/bash", "-c"]
