#!/bin/bash

# Docker Build & Push Script
# 用于 Codespaces 或 GitHub Actions 环境

set -e

VERSION="v1.2.0"
DOCKER_USER="lvxiaoyu"
IMAGE_NAME="video-subtitle-translator"
FULL_IMAGE="$DOCKER_USER/$IMAGE_NAME:$VERSION"
LATEST_IMAGE="$DOCKER_USER/$IMAGE_NAME:latest"

echo "🐳 Docker Build & Push Script"
echo "==============================="
echo "Building: $FULL_IMAGE"
echo ""

# 1. 验证 npm build 成功
echo "[1/4] Verifying npm build..."
npm run build
echo "✅ Build successful"

# 2. 构建 Docker 镜像
echo "[2/4] Building Docker image..."
docker build \
  --build-arg NODE_ENV=production \
  -t "$FULL_IMAGE" \
  -t "$LATEST_IMAGE" \
  .

if [ $? -ne 0 ]; then
  echo "❌ Docker build failed"
  exit 1
fi
echo "✅ Docker image built"

# 3. 测试镜像
echo "[3/4] Testing Docker image..."
echo "Starting container..."
docker run -d \
  --name test-container \
  -p 3000:3000 \
  -e NODE_ENV=production \
  "$FULL_IMAGE" &

CONTAINER_ID=$!
sleep 3

# 检查容器是否运行
if docker ps | grep -q test-container; then
  echo "✅ Container is running"
  
  # 测试健康检查
  HEALTH=$(curl -s http://localhost:3000/api/health || echo "failed")
  echo "Health check result: $HEALTH"
  
  # 清理
  docker kill test-container || true
  docker rm test-container || true
  echo "✅ Container test passed"
else
  echo "❌ Container failed to start"
  exit 1
fi

# 4. 推送到 Docker Hub
echo "[4/4] Pushing to Docker Hub..."

if [ -z "$DOCKER_TOKEN" ]; then
  echo "⚠️  DOCKER_TOKEN not set, skipping push"
  echo "To push manually, run:"
  echo "  docker login --username $DOCKER_USER"
  echo "  docker push $FULL_IMAGE"
  echo "  docker push $LATEST_IMAGE"
else
  echo "$DOCKER_TOKEN" | docker login -u "$DOCKER_USER" --password-stdin
  docker push "$FULL_IMAGE"
  docker push "$LATEST_IMAGE"
  docker logout
  echo "✅ Pushed to Docker Hub"
fi

echo ""
echo "================================="
echo "✅ Docker build completed!"
echo ""
echo "📋 Image Information:"
echo "  Version: $VERSION"
echo "  Full Image: $FULL_IMAGE"
echo "  Latest: $LATEST_IMAGE"
echo ""
echo "🚀 To deploy:"
echo "  wrangler deploy"
