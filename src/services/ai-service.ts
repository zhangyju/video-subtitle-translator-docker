import { Worker } from '../types';
import { ProgressService } from './progress-service';

export const aiService = {
  /**
   * Transcribe audio using Whisper model with progress tracking
   */
  async transcribeAudio(
    audioData: ArrayBuffer,
    env: Worker,
    language?: string,
    videoId?: string
  ): Promise<{ text: string; timestamps: any[] }> {
    try {
      // 发送开始信息
      if (videoId) {
        ProgressService.sendProgress(videoId, 'transcription', 10, '初始化转录...', language);
      }

      // Call Whisper model via Workers AI
      const response: any = await env.AI.run(
        '@cf/openai/whisper-large-v3-turbo',
        {
          audio: Array.from(new Uint8Array(audioData)),
          language: language || 'en',
        }
      );

      // 发送完成信息
      if (videoId) {
        ProgressService.sendProgress(videoId, 'transcription', 100, '转录完成', language);
      }

      return {
        text: response.text || '',
        timestamps: response.timestamps || [],
      };
    } catch (error) {
      if (videoId) {
        ProgressService.sendError(
          videoId,
          `转录失败: ${error instanceof Error ? error.message : '未知错误'}`,
          'TRANSCRIPTION_ERROR'
        );
      }
      console.error('Transcription error:', error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Generate VTT subtitle from text with timestamps
   */
  generateVTT(text: string, timestamps: any[] = []): string {
    let vtt = 'WEBVTT\n\n';

    if (timestamps && timestamps.length > 0) {
      // If we have timestamps, use them
      timestamps.forEach((segment: any) => {
        const startTime = formatTimestamp(segment.start || 0);
        const endTime = formatTimestamp(segment.end || 1);
        vtt += `${startTime} --> ${endTime}\n`;
        vtt += `${segment.text || ''}\n\n`;
      });
    } else {
      // Fallback: simple split into lines
      const lines = text.split('\n').filter(line => line.trim());
      lines.forEach((line, index) => {
        const startTime = formatTimestamp(index * 5);
        const endTime = formatTimestamp((index + 1) * 5);
        vtt += `${startTime} --> ${endTime}\n`;
        vtt += `${line}\n\n`;
      });
    }

    return vtt;
  },

  /**
   * Translate text to target language with progress tracking
   */
  async translateText(
    text: string,
    targetLanguage: string,
    env: Worker,
    videoId?: string
  ): Promise<string> {
    try {
      // 发送开始信息
      if (videoId) {
        ProgressService.sendProgress(
          videoId,
          'translation',
          20,
          `正在翻译为 ${targetLanguage}...`,
          targetLanguage
        );
      }

      // Using Workers AI translation models
      const response: any = await env.AI.run(
        '@cf/meta/m2m-100-12b',
        {
          text,
          source_lang: 'eng_Latn', // English
          target_lang: getM2MLanguageCode(targetLanguage),
        }
      );

      // 发送进度更新
      if (videoId) {
        ProgressService.sendProgress(
          videoId,
          'translation',
          80,
          `${targetLanguage} 翻译进行中...`,
          targetLanguage
        );
      }

      return response.translated_text || text;
    } catch (error) {
      if (videoId) {
        ProgressService.sendError(
          videoId,
          `翻译失败 (${targetLanguage}): ${error instanceof Error ? error.message : '未知错误'}`,
          'TRANSLATION_ERROR'
        );
      }
      console.error('Translation error:', error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Translate VTT subtitle to target language with progress tracking
   */
  async translateVTT(
    vttContent: string,
    targetLanguage: string,
    env: Worker,
    videoId?: string
  ): Promise<string> {
    try {
      // 发送开始信息
      if (videoId) {
        ProgressService.sendProgress(
          videoId,
          'translation',
          15,
          `准备翻译字幕为 ${targetLanguage}...`,
          targetLanguage
        );
      }

      // Parse VTT content
      const lines = vttContent.split('\n');
      const translatedLines: string[] = [];
      let processedLines = 0;
      const totalLines = lines.length;

      for (const line of lines) {
        // Skip VTT metadata
        if (line.startsWith('WEBVTT') || line.includes('-->') || line.trim() === '') {
          translatedLines.push(line);
        } else if (line.trim()) {
          // Translate the text line
          const translated = await this.translateText(line, targetLanguage, env);
          translatedLines.push(translated);

          // 发送进度更新
          processedLines++;
          if (videoId && processedLines % 5 === 0) {
            const progress = 15 + (processedLines / totalLines) * 80;
            ProgressService.sendProgress(
              videoId,
              'translation',
              progress,
              `已翻译 ${processedLines}/${totalLines} 行...`,
              targetLanguage
            );
          }
        } else {
          translatedLines.push(line);
          processedLines++;
        }
      }

      // 发送完成信息
      if (videoId) {
        ProgressService.sendProgress(
          videoId,
          'translation',
          95,
          `${targetLanguage} 翻译完成，保存中...`,
          targetLanguage
        );
      }

      return translatedLines.join('\n');
    } catch (error) {
      if (videoId) {
        ProgressService.sendError(
          videoId,
          `字幕翻译失败 (${targetLanguage}): ${error instanceof Error ? error.message : '未知错误'}`,
          'VTT_TRANSLATION_ERROR'
        );
      }
      console.error('VTT translation error:', error);
      throw error;
    }
  },
};

/**
 * Format time to VTT format (HH:MM:SS.mmm)
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/**
 * Map ISO 639-1 language codes to M2M-100 format
 */
function getM2MLanguageCode(langCode: string): string {
  const languageMap: Record<string, string> = {
    en: 'eng_Latn',
    zh: 'zho_Hans',
    es: 'spa_Latn',
    fr: 'fra_Latn',
    de: 'deu_Latn',
    ja: 'jpn_Jpan',
    ko: 'kor_Hang',
    pt: 'por_Latn',
    ru: 'rus_Cyrl',
    ar: 'ara_Arab',
    hi: 'hin_Deva',
    it: 'ita_Latn',
    nl: 'nld_Latn',
    pl: 'pol_Latn',
    vi: 'vie_Latn',
    th: 'tha_Thai',
  };

  return languageMap[langCode] || 'eng_Latn'; // Default to English
}

/**
 * Language code list for UI
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文 (Chinese)' },
  { code: 'es', name: 'Español (Spanish)' },
  { code: 'fr', name: 'Français (French)' },
  { code: 'de', name: 'Deutsch (German)' },
  { code: 'ja', name: '日本語 (Japanese)' },
  { code: 'ko', name: '한국어 (Korean)' },
  { code: 'pt', name: 'Português (Portuguese)' },
  { code: 'ru', name: 'Русский (Russian)' },
  { code: 'ar', name: 'العربية (Arabic)' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'it', name: 'Italiano (Italian)' },
  { code: 'nl', name: 'Nederlands (Dutch)' },
  { code: 'pl', name: 'Polski (Polish)' },
  { code: 'vi', name: 'Tiếng Việt (Vietnamese)' },
  { code: 'th', name: 'ไทย (Thai)' },
];
