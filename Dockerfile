FROM node:16.13.2-alpine AS BUILD

WORKDIR /build

COPY package.json .
COPY package-lock.json .
RUN npm install

COPY src/ src/
COPY tsconfig.json .
RUN npx tsc


FROM node:16.13.2-alpine

WORKDIR /app

COPY --from=BUILD /build/node_modules/ node_modules/
COPY --from=BUILD /build/dist/app.js .
CMD node app.js
