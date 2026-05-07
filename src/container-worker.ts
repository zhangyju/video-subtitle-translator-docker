/**
 * Worker entry point that routes requests to the Cloudflare Container
 * This acts as a gateway between Cloudflare's edge and the container running on Region:Earth
 */

import { Container, getContainer } from "@cloudflare/containers";

export class VideoSubtitleContainer extends Container {
  // Port the container is listening on
  defaultPort = 3000;

  // Stop the instance after 30 minutes of inactivity
  sleepAfter = "30m";
}

export default {
  async fetch(request: Request, env: any, _ctx: any) {
    try {
      // Handle root path
      const url = new URL(request.url);
      if (url.pathname === '/') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Video Subtitle Translator - Cloudflare Containers',
            version: 'v1.0.3',
            endpoints: {
              upload: 'POST /api/upload (multipart/form-data)',
              videos: 'GET /api/videos',
              health: 'GET /api/health',
              progress: 'GET /api/progress/:videoId'
            }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Get or create a container instance
      // Using "default" session ID means all requests go to the same container
      const container = getContainer(env.CONTAINER, "default");

      // Forward the request to the container
      const response = await container.fetch(request);

      return response;
    } catch (error) {
      console.error("[Container Error]", error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Container request failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
