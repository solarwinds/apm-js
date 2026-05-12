FROM alpine:3.17

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"

RUN apk add --no-cache \
    curl \
    git \
    libstdc++

RUN curl -fsSL https://get.pnpm.io/install.sh | ENV=/root/.profile SHELL=/bin/sh sh -
RUN pnpm runtime set node 18 -g

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/sh", "-c"]
