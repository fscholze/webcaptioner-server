FROM node:20.11.1-bookworm
MAINTAINER Daniel Sobe <daniel.sobe@sorben.com>

# docker build -f docker/Dockerfile -t webcaptioner-ng-back .
# docker build -f docker/Dockerfile -t webcaptioner-ng-back . --no-cache

RUN mkdir -p /webcaptioner-ng-back/src

COPY package.json package-lock.json tsconfig.json /webcaptioner-ng-back/
COPY src    /webcaptioner-ng-back/src

RUN cd webcaptioner-ng-back && npm install

COPY docker/startme.sh /

CMD ["/bin/bash", "-c", "/startme.sh"] 
