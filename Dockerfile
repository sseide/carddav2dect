FROM debian:11-slim
LABEL maintainer="Stefan Seide <account-github@seide.st>"
LABEL io.k8s.description="App to sync contacts from CardDAV server to DECT devices like Gigaset Phones"
LABEL io.openshift.tags=carddav,dect,gigaset,contacts
LABEL io.openshift.wants=tokenizer

ARG NODEJS_VERSION=20
ARG SERVICE_USER="app"
ENV SERVICE_USER=$SERVICE_USER

WORKDIR /app

COPY /docker /
COPY . /app

# runtime user put into group "root" for OpenShift compatibility

RUN export DEBIAN_FRONTEND=noninteractive \
  && apt-get update -q \
  && apt-get install -q -y apt-utils \
  && apt-get upgrade -q -y \
  && apt-get install -q -y ca-certificates curl dumb-init jq procps sudo tzdata \
  && adduser --system --gid 0 --uid 20000 --home /app "$SERVICE_USER" \
  && echo "\n---- Install NodeJS from nodesource.com ----------------------" \
  && curl -sL "https://deb.nodesource.com/setup_${NODEJS_VERSION}.x" | APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=1 bash - \
  && apt-get install -y nodejs \
  && echo "\n---- OS release ----------------------------------------------" \
  && cat /etc/os-release \
  && echo "\n---- Node / NPM versions -------------------------------------" \
  && node --version \
  && echo "\n---- Install application dependencies ------------------------" \
  && apt-get install -q -y vdirsyncer chromium \
  && npm ci --production --no-audit \
  && echo "\n---- Check Config file ---------------------------------------" \
  && for i in config/*.json; do echo "checking config $i"; jq empty < "$i"; ret=$?; if [ $ret -ne 0 ]; then exit $ret; fi; done \
  && echo "\n---- Fix access rights ---------------------------------------" \
  && chown -R ${SERVICE_USER}.root /app \
  && chmod -R g+rw /app \
  && mkdir /app/data \
  && chmod g+w /app/data \
  && chmod +x /app/sync.sh \
  && echo "\n---- Cleanup -------------------------------------------------" \
  && apt-get clean \
  && rm -rf /app/docker \
  && rm -rf /tmp/*

# id of newly created service user, number (not name) needed for OpenShift compatibility
USER 20000

ENV NODE_ENV=production
ENV NODE_APP_INSTANCE=docker

ENTRYPOINT [ "/usr/bin/dumb-init", "--" ]
CMD ["/app/docker-entrypoint.sh"]
