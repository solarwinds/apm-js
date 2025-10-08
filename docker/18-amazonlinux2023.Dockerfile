FROM amazonlinux:2023

RUN dnf install -y \
    curl-minimal \
    git

RUN curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - && \
    dnf install -y nodejs && \
    dnf clean -y all

RUN corepack enable

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
