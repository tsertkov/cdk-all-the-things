FROM node:18 AS build

WORKDIR /app/infra
COPY infra/package.json infra/package-lock.json .
RUN npm install

WORKDIR /app
COPY . .
RUN set -e; \
	# infra test & build
	cd infra; \
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

FROM node:18-alpine
ARG sops_version
ENTRYPOINT [ "/usr/bin/make" ]
CMD []
RUN set -e; \
	# install make and aws-cli
	apk add --no-cache make aws-cli yq; \
	# install sops
	cd /usr/local/bin; \
	wget https://github.com/mozilla/sops/releases/download/${sops_version}/sops-${sops_version}.linux.amd64; \
	chmod +x sops-${sops_version}.linux.amd64; \
	mv sops-${sops_version}.linux.amd64 sops
WORKDIR /app/infra
COPY infra/package.json infra/package-lock.json .
RUN npm install

WORKDIR /app
COPY Makefile LICENSE config.yaml .
COPY secrets/encrypted secrets/encrypted
COPY --from=build /app/lambdas/package ./lambdas
COPY --from=build /app/infra/package/ ./infra
