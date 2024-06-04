# Pull node image from Docker Hub
FROM node:18

# Create app directory
WORKDIR /usr/src/app

ENV NODE_OPTIONS=--openssl-legacy-provider

# Install app dependencies
COPY package.json yarn.lock ./
RUN yarn
COPY . ./
RUN yarn build REMOVEME

CMD ["node", "build/index.js"]

