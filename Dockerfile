FROM node:16 AS build
WORKDIR /app
COPY config.yaml .
COPY lambdas lambdas
COPY infra infra
RUN set -e; \
	# infra test & build
	cd infra; \
	npm install; \
	npm run test; \
	npm run build; \
	# prepare infra for packaging
	npm pack; \
	tar xzf infra-*.tgz; \
	cd -; \
	# prepare lambdas for packaging
	cd lambdas; \
	mkdir -p package/go-app; \
	cp -r go-app/bin package/go-app

FROM node:16-alpine
ARG sops_version
ENTRYPOINT [ "/usr/bin/make" ]
CMD []
WORKDIR /app
RUN set -e; \
	# install make and aws-cli
	apk add --no-cache make aws-cli yq; \
	# install sops
	cd /usr/local/bin; \
	wget https://github.com/mozilla/sops/releases/download/${sops_version}/sops-${sops_version}.linux.amd64; \
	chmod +x sops-${sops_version}.linux.amd64; \
	mv sops-${sops_version}.linux.amd64 sops
COPY config.yaml .
COPY secrets.sops.yaml .
COPY Makefile .
COPY --from=build /app/lambdas/package ./lambdas
COPY --from=build /app/infra/package/ ./infra
RUN set -e; \
	# install final npm deps
	cd infra; \
	npm install --omit=dev
