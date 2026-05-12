FROM amazonlinux:2023

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"

RUN dnf install -y \
    curl-minimal \
    git \
    libatomic

RUN curl -fsSL https://get.pnpm.io/install.sh | sh -
RUN pnpm runtime set node 18 -g

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
