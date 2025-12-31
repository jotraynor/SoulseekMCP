import { SlskClient } from 'soulseek-ts';
import * as fs from 'fs';
import * as path from 'path';

export interface SearchResult {
  username: string;
  filename: string;
  size: number;
  bitrate: number | null;
  duration: number | null;
  slotsFree: boolean;
  speed: number;
  queueLength: number;
}

export interface DownloadResult {
  success: boolean;
  filePath: string;
  filename: string;
  size: number;
}

class SoulseekClientWrapper {
  private client: SlskClient | null = null;
  private connected: boolean = false;
  private username: string = '';
  private password: string = '';
  private downloadPath: string = '';

  async connect(username: string, password: string, downloadPath: string): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    this.username = username;
    this.password = password;
    this.downloadPath = downloadPath;

    this.client = new SlskClient();

    try {
      await this.client.login(username, password, 30000);
      this.connected = true;
      console.error(`[Soulseek] Connected as ${username}`);
    } catch (error) {
      this.client.destroy();
      this.client = null;
      this.connected = false;
      throw new Error(`Failed to connect to Soulseek: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async ensureConnected(): Promise<void> {
    if (!this.connected || !this.client) {
      const username = process.env.SOULSEEK_USERNAME;
      const password = process.env.SOULSEEK_PASSWORD;
      const downloadPath = process.env.DOWNLOAD_PATH || './downloads';

      if (!username || !password) {
        throw new Error('SOULSEEK_USERNAME and SOULSEEK_PASSWORD environment variables are required');
      }

      await this.connect(username, password, downloadPath);
    }
  }

  async search(query: string, limit: number = 50): Promise<SearchResult[]> {
    await this.ensureConnected();

    if (!this.client) {
      throw new Error('Client not connected');
    }

    const results: SearchResult[] = [];

    try {
      const searchResults = await this.client.search(query, {
        timeout: 10000,
        onResult: (result) => {
          for (const file of result.files) {
            // Extract attributes
            const bitrate = file.attrs.get(0) ?? null; // FileAttribute.Bitrate = 0
            const duration = file.attrs.get(1) ?? null; // FileAttribute.Duration = 1

            results.push({
              username: result.username,
              filename: file.filename,
              size: Number(file.size),
              bitrate,
              duration,
              slotsFree: result.slotsFree,
              speed: result.avgSpeed,
              queueLength: result.queueLength,
            });
          }
        },
      });

      // Sort by: slots free first, then by speed descending
      results.sort((a, b) => {
        if (a.slotsFree !== b.slotsFree) {
          return a.slotsFree ? -1 : 1;
        }
        return b.speed - a.speed;
      });

      return results.slice(0, limit);
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async download(username: string, filename: string): Promise<DownloadResult> {
    await this.ensureConnected();

    if (!this.client) {
      throw new Error('Client not connected');
    }

    // Ensure download directory exists
    await fs.promises.mkdir(this.downloadPath, { recursive: true });

    // Extract just the filename from the full path
    const basename = path.basename(filename.replace(/\\/g, '/'));
    const filePath = path.join(this.downloadPath, basename);

    try {
      const download = await this.client.download(username, filename);

      // Write the stream to file
      const writeStream = fs.createWriteStream(filePath);

      return new Promise((resolve, reject) => {
        let totalBytes = 0;

        download.stream.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
        });

        download.stream.pipe(writeStream);

        download.stream.on('end', () => {
          console.error(`[Soulseek] Download complete: ${basename} (${totalBytes} bytes)`);
          resolve({
            success: true,
            filePath,
            filename: basename,
            size: totalBytes,
          });
        });

        download.stream.on('error', (err: Error) => {
          reject(new Error(`Download stream error: ${err.message}`));
        });

        writeStream.on('error', (err: Error) => {
          reject(new Error(`Write error: ${err.message}`));
        });
      });
    } catch (error) {
      throw new Error(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getStatus(): { connected: boolean; username: string | null } {
    return {
      connected: this.connected,
      username: this.connected ? this.username : null,
    };
  }

  disconnect(): void {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.connected = false;
      console.error('[Soulseek] Disconnected');
    }
  }
}

// Singleton instance
export const soulseekClient = new SoulseekClientWrapper();
