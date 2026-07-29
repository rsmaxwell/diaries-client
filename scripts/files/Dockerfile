# ---- build stage -------------------------------------------------
FROM node:20-bookworm-slim AS build

ARG VERSION=0.0.1-SNAPSHOT
ARG BUILD_ID=(none)
ARG BUILD_DATE=(unknown)
ARG VCS_REF=(unknown)
ARG GIT_BRANCH=(unknown)
ARG GIT_URL=(unknown)

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN VERSION="${VERSION}" \
    BUILD_ID="${BUILD_ID}" \
    BUILD_DATE="${BUILD_DATE}" \
    GIT_COMMIT="${VCS_REF}" \
    GIT_BRANCH="${GIT_BRANCH}" \
    GIT_URL="${GIT_URL}" \
    npm run build -- --configuration production --base-href /diaries/

# ---- runtime stage -----------------------------------------------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist/diaries-client/browser/ /app/www/

EXPOSE 8080

CMD ["serve", "-s", "/app/www", "-l", "8080"]
