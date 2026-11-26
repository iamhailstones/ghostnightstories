FROM golang:1.22-alpine AS b
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /ghostnight .
FROM alpine:3.20
RUN adduser -D app && mkdir /data && chown app /data
USER app
COPY --from=b /ghostnight /ghostnight
ENV DATA_FILE=/data/data.json
ENV UPLOAD_DIR=/data/uploads
EXPOSE 8080
CMD ["/ghostnight"]
