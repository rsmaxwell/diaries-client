# ---- build stage -------------------------------------------------
FROM node:20-bookworm-slim AS build

ARG VERSION=0.0.0-SNAPSHOT
ARG BUILD_ID=(none)
ARG BUILD_DATE=(unknown)
ARG VCS_REF=(unknown)
ARG GIT_BRANCH=(unknown)
ARG GIT_URL=(unknown)

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN printf '%s\n' \
      '{' \
      '  "name": "diaries-client",' \
      "  \"version\": \"${VERSION}\"," \
      "  \"buildID\": \"${BUILD_ID}\"," \
      "  \"builddate\": \"${BUILD_DATE}\"," \
      "  \"gitCommit\": \"${VCS_REF}\"," \
      "  \"gitBranch\": \"${GIT_BRANCH}\"," \
      "  \"gitURL\": \"${GIT_URL}\"" \
      '}' \
      > public/assets/build-info.json
RUN npm run build -- --configuration production --base-href /

# ---- runtime stage -----------------------------------------------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist/diaries-client/browser/ /app/www/

EXPOSE 8080

CMD ["serve", "-s", "/app/www", "-l", "8080"]
