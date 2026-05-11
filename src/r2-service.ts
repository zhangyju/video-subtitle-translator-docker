/**
 * R2 Storage Service for Express Server
 * Note: This is a placeholder for local development.
 * In production, R2StorageService in Worker will handle uploads.
 */

import fs from 'fs';
import path from 'path';

/**
 * Mock R2 Storage Service for local development
 * Simulates R2 behavior by storing files locally
 */
export class MockR2StorageService {
  private localStoragePath: string;
  private baseUrl: string;

  constructor(storagePath: string = '/tmp/r2-storage') {
    this.localStoragePath = storagePath;
    this.baseUrl = 'http://localhost:3000/r2';

    // Create storage directory if it doesn't exist
    if (!fs.existsSync(this.localStoragePath)) {
      fs.mkdirSync(this.localStoragePath, { recursive: true });
    }
  }

  /**
   * Upload video file
   */
  async uploadVideo(
    userId: string,
    videoId: string,
    fileData: Buffer,
    fileName: string,
    contentType: string
  ): Promise<{ url: string; key: string }> {
    const fileExtension = fileName.split('.').pop() || 'mp4';
    const key = `users/${userId}/videos/${videoId}/original.${fileExtension}`;
    const filePath = path.join(this.localStoragePath, key);

    try {
      // Create directory structure
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(filePath, fileData);

      const url = `${this.baseUrl}/${key}`;
      console.log(`[MockR2] Video uploaded: ${key} (${Math.round(fileData.length / 1024 / 1024)} MB)`);

      return { url, key };
    } catch (error) {
      console.error('[MockR2] Upload error:', error);
      throw new Error('Failed to upload video to R2');
    }
  }

  /**
   * Upload subtitle
   */
  async uploadSubtitle(
    videoId: string,
    language: string,
    vttContent: string
  ): Promise<string> {
    const key = `videos/${videoId}/subtitles/${language}.vtt`;
    const filePath = path.join(this.localStoragePath, key);

    try {
      // Create directory structure
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(filePath, vttContent, 'utf-8');

      const url = `${this.baseUrl}/${key}`;
      console.log(`[MockR2] Subtitle uploaded: ${key}`);

      return url;
    } catch (error) {
      console.error('[MockR2] Subtitle upload error:', error);
      throw new Error('Failed to upload subtitle to R2');
    }
  }

  /**
   * Get video URL
   */
  getVideoUrl(userId: string, videoId: string, fileExtension: string = 'mp4'): string {
    return `${this.baseUrl}/users/${userId}/videos/${videoId}/original.${fileExtension}`;
  }

  /**
   * Get subtitle URL
   */
  getSubtitleUrl(videoId: string, language: string): string {
    return `${this.baseUrl}/videos/${videoId}/subtitles/${language}.vtt`;
  }

  /**
   * Delete video and all related files
   */
  async deleteVideo(userId: string, videoId: string): Promise<void> {
    const dirPath = path.join(this.localStoragePath, `users/${userId}/videos/${videoId}`);

    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`[MockR2] Deleted video folder: ${dirPath}`);
      }
    } catch (error) {
      console.error('[MockR2] Delete error:', error);
      throw new Error('Failed to delete video from R2');
    }
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(userId: string, videoId: string, fileExtension: string): Promise<any> {
    const filePath = path.join(this.localStoragePath, `users/${userId}/videos/${videoId}/original.${fileExtension}`);

    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = fs.statSync(filePath);
      return {
        key: `users/${userId}/videos/${videoId}/original.${fileExtension}`,
        size: stats.size,
        uploadedAt: stats.birthtimeMs,
        contentType: 'video/mp4',
      };
    } catch (error) {
      console.error('[MockR2] Metadata error:', error);
      return null;
    }
  }

  /**
   * Upload metadata JSON
   */
  async uploadMetadata(userId: string, videoId: string, metadata: any): Promise<string> {
    const key = `users/${userId}/videos/${videoId}/metadata.json`;
    const filePath = path.join(this.localStoragePath, key);

    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const jsonContent = JSON.stringify(metadata, null, 2);
      fs.writeFileSync(filePath, jsonContent, 'utf-8');

      console.log(`[MockR2] Metadata uploaded: ${key}`);
      return `${this.baseUrl}/${key}`;
    } catch (error) {
      console.error('[MockR2] Metadata upload error:', error);
      throw new Error('Failed to upload metadata to R2');
    }
  }

  /**
   * Get local file path for serving
   */
  getLocalFilePath(key: string): string {
    return path.join(this.localStoragePath, key);
  }

  /**
   * Check if file exists
   */
  fileExists(key: string): boolean {
    const filePath = path.join(this.localStoragePath, key);
    return fs.existsSync(filePath);
  }
}

/**
 * Production R2 Storage Service
 * Uses actual Cloudflare R2 API
 */
export class R2StorageService {
  private r2Client: any;
  private baseUrl: string = 'https://r2.myzhangyujie.com';

  constructor(r2Client?: any) {
    this.r2Client = r2Client;

    if (!r2Client) {
      console.warn('[R2] No R2 client provided, using mock service');
    }
  }

  /**
   * Upload video file
   */
  async uploadVideo(
    userId: string,
    videoId: string,
    fileData: Buffer,
    fileName: string,
    contentType: string
  ): Promise<{ url: string; key: string }> {
    const fileExtension = fileName.split('.').pop() || 'mp4';
    const key = `users/${userId}/videos/${videoId}/original.${fileExtension}`;

    try {
      if (!this.r2Client) {
        throw new Error('R2 client not initialized');
      }

      await this.r2Client.put(key, fileData, {
        httpMetadata: {
          contentType,
          cacheControl: 'max-age=31536000',
        },
      });

      const url = `${this.baseUrl}/${key}`;
      console.log(`[R2] Video uploaded: ${key} (${Math.round(fileData.length / 1024 / 1024)} MB)`);

      return { url, key };
    } catch (error) {
      console.error('[R2] Upload error:', error);
      throw new Error('Failed to upload video to R2');
    }
  }

  /**
   * Upload subtitle
   */
  async uploadSubtitle(videoId: string, language: string, vttContent: string): Promise<string> {
    const key = `videos/${videoId}/subtitles/${language}.vtt`;

    try {
      if (!this.r2Client) {
        throw new Error('R2 client not initialized');
      }

      await this.r2Client.put(key, vttContent, {
        httpMetadata: {
          contentType: 'text/vtt;charset=utf-8',
          cacheControl: 'max-age=86400',
        },
      });

      const url = `${this.baseUrl}/${key}`;
      console.log(`[R2] Subtitle uploaded: ${key}`);

      return url;
    } catch (error) {
      console.error('[R2] Subtitle upload error:', error);
      throw new Error('Failed to upload subtitle to R2');
    }
  }

  /**
   * Get video URL
   */
  getVideoUrl(userId: string, videoId: string, fileExtension: string = 'mp4'): string {
    return `${this.baseUrl}/users/${userId}/videos/${videoId}/original.${fileExtension}`;
  }

  /**
   * Get subtitle URL
   */
  getSubtitleUrl(videoId: string, language: string): string {
    return `${this.baseUrl}/videos/${videoId}/subtitles/${language}.vtt`;
  }

  /**
   * Delete video
   */
  async deleteVideo(userId: string, videoId: string): Promise<void> {
    const prefix = `users/${userId}/videos/${videoId}/`;

    try {
      if (!this.r2Client) {
        throw new Error('R2 client not initialized');
      }

      const listResponse = await this.r2Client.list({ prefix });
      const deletePromises = listResponse.objects.map((obj: any) => this.r2Client.delete(obj.key));

      await Promise.all(deletePromises);
      console.log(`[R2] Deleted video folder: ${prefix}`);
    } catch (error) {
      console.error('[R2] Delete error:', error);
      throw new Error('Failed to delete video from R2');
    }
  }
}
