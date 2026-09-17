FROM node:24-bookworm-slim
WORKDIR /app
RUN mkdir -p /app/node_modules && chown -R node:node /app
USER node
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]