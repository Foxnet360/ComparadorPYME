FROM node:20

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY dist ./dist
RUN if [ -f .env.production ]; then cp .env.production .env; fi

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

EXPOSE 8080

CMD ["node", "dist/index.js"]
