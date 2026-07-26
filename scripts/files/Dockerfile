# ---- build stage -------------------------------------------------
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production --base-href /


# ---- runtime stage -----------------------------------------------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist/diaries-client/browser/ /app/www/

EXPOSE 8080

CMD ["serve", "-s", "/app/www", "-l", "8080"]
