# --- 阶段 2: 运行后端服务器 ---
FROM node:22-alpine
# 安装构建原生模块所需的工具（SQLite 需要重新编译）
RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# 1. 先复制 package.json
COPY backend/package*.json ./backend/

# 2. 在容器内编译安装（这会生成适合 Linux 的 sqlite3 二进制文件）
RUN cd backend && npm install --production

# 3. 复制后端源码（因为有 .dockerignore，所以不会复制本地错误的 node_modules）
COPY backend/ ./backend/

# 4. 复制前端构建产物
COPY --from=build-frontend /app/frontend/dist ./backend/public

EXPOSE 8080
WORKDIR /app/backend
CMD ["node", "server.js"]
