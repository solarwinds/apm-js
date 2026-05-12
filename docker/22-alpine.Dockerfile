FROM alpine

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"

RUN apk add --no-cache \
    curl \
    gcompat \
    git \
    libc6-compat

RUN curl -fsSL https://get.pnpm.io/install.sh | sh -
RUN pnpm runtime set node 22 -g

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/sh", "-c"]
