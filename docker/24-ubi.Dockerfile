FROM registry.access.redhat.com/ubi10

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"

RUN dnf install -y \
    curl-minimal \
    git \
    libatomic

RUN curl -fsSL https://get.pnpm.io/install.sh | sh -
RUN pnpm runtime set node 24 -g

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
