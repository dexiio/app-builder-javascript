FROM node:9.4.0

RUN mkdir -p /var/workspace

ADD package.json /opt/builder/

WORKDIR /opt/builder

RUN npm install

ADD src/ /opt/builder/src
ADD build.js /opt/builder/

VOLUME /var/workspace/target
VOLUME /var/workspace/source

ENV SOURCE_FOLDER "/var/workspace/source"
ENV TARGET_FOLDER "/var/workspace/target"

CMD ["node", "build.js"]