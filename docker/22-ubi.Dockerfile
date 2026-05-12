FROM registry.access.redhat.com/ubi10

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"

RUN dnf install -y \
    curl-minimal \
    git \
    libatomic

RUN curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/bash sh -
RUN pnpm runtime set node 22 -g

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
