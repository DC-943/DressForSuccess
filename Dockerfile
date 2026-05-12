# --- 阶段 1: 构建前端 ---
FROM node:22-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- 阶段 2: 运行后端服务器 ---
FROM node:22-alpine
# 安装 SQLite 编译所需的 Linux 工具
RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# 先安装后端依赖
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# 复制后端源码
COPY backend/ ./backend/

# 【关键】从阶段 1 复制打包好的前端文件
COPY --from=build-frontend /app/frontend/dist ./backend/public

# 设置工作目录并启动
WORKDIR /app/backend
EXPOSE 8080
CMD ["node", "server.js"]

