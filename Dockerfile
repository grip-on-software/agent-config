FROM node:20-alpine
EXPOSE 8080

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
COPY package*.json /usr/src/app/
RUN npm install && npm cache clean --force
COPY . /usr/src/app/

CMD ["npm", "start"]
