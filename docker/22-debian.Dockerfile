FROM debian:slim

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"

RUN apt-get update && apt-get install -y \
    curl \
    git \
    libatomic1 \
    && apt-get clean

RUN curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/bash sh -
RUN pnpm runtime set node 22 -g

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/bash", "-c"]
