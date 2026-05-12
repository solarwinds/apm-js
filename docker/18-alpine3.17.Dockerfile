FROM alpine:3.17

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME/bin:$PATH"

RUN apk add --no-cache curl git

RUN curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/sh sh -
RUN pnpm runtime set node 18 -g

RUN apk add --no-cache gcompat libc6-compat

WORKDIR /solarwinds-apm
ENTRYPOINT ["/bin/sh", "-c"]
