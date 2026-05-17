FROM golang:1.25-alpine AS build

WORKDIR /src

COPY go.work ./
COPY services/api/go.mod services/api/go.sum ./services/api/
RUN cd services/api && go mod download

COPY services/api ./services/api

RUN go build -o /out/api ./services/api/cmd/api \
  && go build -o /out/worker ./services/api/cmd/worker \
  && go build -o /out/migrate ./services/api/cmd/migrate

FROM alpine:3.21

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=build /out/api ./api
COPY --from=build /out/worker ./worker
COPY --from=build /out/migrate ./migrate
COPY services/api/migrations ./services/api/migrations

USER app
EXPOSE 8080

CMD ["./api"]
