FROM registry.access.redhat.com/ubi8

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"

RUN dnf install -y \
    curl \
    git \
    tar \
    libatomic

RUN curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/bash sh -
RUN pnpm runtime set node 20 -g

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
