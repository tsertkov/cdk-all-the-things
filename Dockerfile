# Dockerfile
#
# Multi-stage Dockerfile building standalone deployer container image.

ARG node_version

#
# Build stage
#

FROM node:${node_version} AS build

# npm dependencies layer for infra
COPY infra/package.json infra/package-lock.json /app/infra/
RUN cd /app/infra && npm install

# npm dependencies layer for infra lambdas
COPY infra/lambdas /app/infra/lambdas
RUN find /app/infra/lambdas -type f -name package.json -mindepth 2 -maxdepth 2 -execdir npm install \;

COPY infra /app/infra
COPY lambdas /app/lambdas
COPY config.yaml /app
RUN set -e; \
	#
	# infra build and test
	#
	cd /app/infra; \
	npm run build; \
	npm test; \
	# prepare dist
	mkdir /app/infra-dist; \
	find . \( \
		\( -name '*.js' -o -name 'package*.json' \) \
		-a -not -path './node_modules/*' \
		-a -not -path './test/*' \
		\) \
		-exec cp --parents {} /app/infra-dist \;; \
	cp -rt /app/infra-dist \
		package.json \
		package-lock.json \
		cdk.json \
		bootstrap \
		;\
	cd /app/infra-dist; \
	npm install --omit dev; \
	rm -rf /app/infra; \
	mv /app/infra-dist /app/infra; \
	#
	# prepare dist lambdas
	#
	mkdir /app/lambdas-dist; \
	cd /app/lambdas; \
	find . -maxdepth 2 -mindepth 2 -type d -name bin \
		-exec cp --parents -r {} /app/lambdas-dist \;; \
	rm -rf /app/lambdas; \
	mv /app/lambdas-dist /app/lambdas

#
# Final stage
#

FROM public.ecr.aws/lambda/nodejs:${node_version}

ARG sops_version
ARG yq_version
ARG age_version

# override lambda image defaults to use docker cli as default image interface
WORKDIR /app
ENV CI=true
ENTRYPOINT [ "/bin/bash", "-c" ]
CMD [ "make", "ls" ]

# install tools
RUN set -e; \
	#
	# install system packages
	#
	yum update -y; \
	yum install -y tar gzip make awscli; \
	yum -y clean all; \
	rm -rf /var/cache; \
	#
	# install sops and yq
	#
	cd /usr/local/bin; \
	curl -sL -o sops https://github.com/mozilla/sops/releases/download/${sops_version}/sops-${sops_version}.linux.amd64; chmod +x sops; \
	curl -sL -o yq https://github.com/mikefarah/yq/releases/download/${yq_version}/yq_linux_amd64; chmod +x yq; \
	#
	# install age
	#
	mkdir age-tmp; \
	curl -sL https://github.com/FiloSottile/age/releases/download/${age_version}/age-${age_version}-linux-amd64.tar.gz \
		| tar -xz --no-same-owner -C age-tmp age; \
	mv age-tmp/age/age* .; \
	rm -rf age-tmp

# copy assets
COPY --from=build /app /app
COPY --from=build /app/infra/lambdas/deployer ${LAMBDA_TASK_ROOT}
COPY scripts /app/scripts
COPY secrets /app/secrets
COPY Makefile LICENSE config.yaml /app/
