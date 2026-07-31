# ---- build stage -------------------------------------------------
FROM node:20-bookworm-slim AS build

ARG VERSION
ARG BUILD_ID=(none)
ARG BUILD_DATE=(unknown)
ARG VCS_REF=(unknown)
ARG GIT_BRANCH=(unknown)
ARG GIT_URL=(unknown)


RUN test -n "${VERSION}" || \
    (echo "VERSION build argument is required" >&2 && exit 1)


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
    npm run build -- --configuration production

# ---- runtime stage -----------------------------------------------
FROM nginx:alpine AS runtime

COPY scripts/files/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/diaries-client/browser/ /usr/share/nginx/html/diaries/

EXPOSE 8080
