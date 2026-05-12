FROM amazonlinux

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"

RUN dnf install -y \
    curl-minimal \
    git \
    tar \
    libatomic

RUN curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/bash sh -
RUN pnpm runtime set node 20 -g

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
