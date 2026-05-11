#!/bin/bash

# Phase 7 - Build and Push Docker Image Script
# This script builds the Docker image and pushes it to Docker Hub

set -e

VERSION="1.4.0"
DOCKER_REPO="lvxiaoyu/video-subtitle-translator"
IMAGE_NAME="$DOCKER_REPO"

echo "🔨 Building Docker image for Phase 7 (v$VERSION)..."

# Build the Docker image
docker build -t $IMAGE_NAME:$VERSION -t $IMAGE_NAME:latest .

echo "✅ Docker image built successfully!"
echo "   - Latest tag: $IMAGE_NAME:latest"
echo "   - Version tag: $IMAGE_NAME:$VERSION"

# Check if user wants to push
read -p "🚀 Push to Docker Hub? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Logging in to Docker Hub..."
  docker login -u lvxiaoyu
  
  echo "Pushing image..."
  docker push $IMAGE_NAME:$VERSION
  docker push $IMAGE_NAME:latest
  
  echo "✅ Successfully pushed to Docker Hub!"
  echo "   - https://hub.docker.com/r/$DOCKER_REPO"
  echo ""
  echo "Image ready for deployment:"
  echo "   docker pull $IMAGE_NAME:latest"
else
  echo "⏭️  Skipping push to Docker Hub"
  echo ""
  echo "To push later, run:"
  echo "   docker login -u lvxiaoyu"
  echo "   docker push $IMAGE_NAME:$VERSION"
  echo "   docker push $IMAGE_NAME:latest"
fi

echo ""
echo "📝 Image information:"
docker images | grep $DOCKER_REPO | head -2
