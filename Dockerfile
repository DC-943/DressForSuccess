# --- 阶段 1: 构建前端 (Vite) ---
FROM node:18-alpine AS build-frontend
WORKDIR /app/frontend
# 复制前端配置文件
COPY frontend/package*.json ./
RUN npm install
# 复制所有前端源码并打包
COPY frontend/ ./
RUN npm run build

# --- 阶段 2: 运行后端服务器 ---
FROM node:22-alpine
WORKDIR /app

# 安装后端依赖
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# 复制后端源码
COPY backend/ ./backend/

# 将阶段 1 生成的 dist 文件夹复制到后端的静态资源目录
# 注意：你需要确保后端 server.js 中配置了静态托管这个目录
COPY --from=build-frontend /app/frontend/dist ./backend/public

# 设置环境变量（可选）
ENV PORT=8080
EXPOSE 8080

# 启动后端
WORKDIR /app/backend
CMD ["node", "server.js"]
