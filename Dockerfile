# Dockerfile
#
# Multi-stage Dockerfile building standalone deployer container image.

ARG node_version

#
# 1. Base stage for building final lambda-compatible image
#

FROM public.ecr.aws/lambda/nodejs:${node_version} as lambda_base

ARG sops_version
ARG yq_version
ARG age_version
ARG sops_sha1sum
ARG yq_sha1sum
ARG age_sha1sum

ENV CI=true APPROOT=/app

# override lambda image defaults to use docker cli as default image interface
WORKDIR /app
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
	echo ${sops_sha1sum} /usr/local/bin/sops | sha1sum -c; \
	echo ${yq_sha1sum} /usr/local/bin/yq | sha1sum -c; \
	#
	# install age
	#
	mkdir age-tmp; \
	curl -sL https://github.com/FiloSottile/age/releases/download/${age_version}/age-${age_version}-linux-amd64.tar.gz \
		| tar -xz --no-same-owner -C age-tmp age; \
	mv age-tmp/age/age* .; \
	echo ${age_sha1sum} /usr/local/bin/age | sha1sum -c; \
	rm -rf age-tmp

#
# 2. Build stage
#

FROM node:${node_version} AS build

ENV APPROOT=/app

# npm dependencies layer for infra
COPY infra/package.json infra/package-lock.json ${APPROOT}/infra/
RUN cd ${APPROOT}/infra && npm install

# npm dependencies layer for infra lambdas
COPY infra/lambdas ${APPROOT}/infra/lambdas
RUN find ${APPROOT}/infra/lambdas -type f -name package.json -mindepth 2 -maxdepth 2 -execdir npm install \;

COPY infra ${APPROOT}/infra
COPY lambdas ${APPROOT}/lambdas
COPY config.yaml ${APPROOT}
RUN set -e; \
	#
	# infra build and test
	#
	cd ${APPROOT}/infra; \
	npm run build; \
	npm test; \
	# prepare dist
	mkdir ${APPROOT}/infra-dist; \
	find . \( \
		\( -name '*.js' -o -name 'package*.json' \) \
		-a -not -path '*/node_modules/*' \
		-a -not -path '*/test/*' \
		-a -not -path './lambdas/*/package-lock.json' \
		\) \
		-exec cp --parents {} ${APPROOT}/infra-dist \;; \
	cp -rt ${APPROOT}/infra-dist \
		package.json \
		package-lock.json \
		cdk.json \
		bootstrap \
		;\
	cd ${APPROOT}/infra-dist; \
	npm install --omit dev; \
	rm -rf ${APPROOT}/infra; \
	mv ${APPROOT}/infra-dist ${APPROOT}/infra

# lambdas layer
# COPY lambdas ${APPROOT}/lambdas
RUN set -e; \
	mkdir ${APPROOT}/lambdas-dist; \
	cd ${APPROOT}/lambdas; \
	find . -maxdepth 2 -mindepth 2 -type d -name bin \
		-exec cp --parents -r {} ${APPROOT}/lambdas-dist \;; \
	rm -rf ${APPROOT}/lambdas; \
	mv ${APPROOT}/lambdas-dist ${APPROOT}/lambdas

#
# 3. Final stage
#

FROM lambda_base

# copy assets from build stage
COPY --from=build ${APPROOT} ${APPROOT}
COPY --from=build ${APPROOT}/infra/lambdas/deployer ${LAMBDA_TASK_ROOT}

# copy raw assets from context
COPY scripts ${APPROOT}/scripts
COPY secrets ${APPROOT}/secrets
COPY Makefile LICENSE config.yaml ${APPROOT}/
