# Use a specific Node version
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app /app
# Port will be passed via ENV or defined in compose
EXPOSE 4001
USER node
CMD ["node", "index.js"]
