FROM centos:7

RUN yum install -y epel-release "https://packages.endpointdev.com/rhel/7/os/$(arch)/endpoint-repo.$(arch).rpm" && \
    yum install -y \
    curl \
    git \
    git-lfs \
    xz

RUN curl -fsSL https://rpm.nodesource.com/setup_14.x | bash - && \
    yum install -y nodejs

RUN corepack enable

WORKDIR /swotel
ENTRYPOINT ["/bin/bash", "-c"]
