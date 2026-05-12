FROM amazonlinux

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"

RUN dnf install -y \
    curl-minimal \
    git

RUN curl -fsSL https://get.pnpm.io/install.sh | sh -
RUN pnpm runtime set node 22 -g

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
