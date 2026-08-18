FROM node:22 AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://127.0.0.1:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY . .
RUN npm install
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80