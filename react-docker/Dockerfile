FROM node:24
RUN mkdir /app
WORKDIR /app
COPY package*.json ./
RUN npm install

CMD [ "npm","start" ]
