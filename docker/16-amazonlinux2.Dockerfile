FROM amazonlinux:2

RUN amazon-linux-extras install -y epel && \
    yum install -y \
    curl \
    git \
    git-lfs \
    tar \
    xz

RUN yum install -y https://rpm.nodesource.com/pub_16.x/nodistro/repo/nodesource-release-nodistro-1.noarch.rpm && \
    yum install -y nodejs && \
    yum clean all

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
