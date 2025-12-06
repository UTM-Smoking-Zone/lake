FROM node:20-alpine
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Build
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

EXPOSE 3001
CMD ["node","dist/main.js"]
