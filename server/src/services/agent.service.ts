import { spawn, type ChildProcessByStdio } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { envConfig } from '../config';

interface OpenCodeHealth {
   healthy: true;
   version: string;
}

interface OpenCodeSession {
   id: string;
   title?: string | null;
}

interface OpenCodeMessagePart {
   type: string;
   text?: string;
}

interface OpenCodeMessageResponse {
   info: {
      id: string;
      role: string;
   };
   parts: OpenCodeMessagePart[];
}

interface CreateAgentInput {
   title?: string;
}

interface OpenCodeModelSelection {
   providerID: string;
   modelID: string;
}

class AgentService {
   private readonly projectRoot = path.resolve(__dirname, '../..');
   private serverProcess: ChildProcessByStdio<null, Readable, Readable> | null =
      null;
   private serverStartedByService = false;
   private startupPromise: Promise<string> | null = null;
   private serverLog = '';
   private serverUrl = envConfig.OPENCODE_BASE_URL;

   async startServer() {
      if (this.startupPromise) {
         return this.startupPromise;
      }

      this.startupPromise = this.startServerInternal();

      try {
         return await this.startupPromise;
      } catch (error) {
         this.startupPromise = null;
         throw error;
      }
   }

   async listAgents() {
      await this.startServer();
      return this.request<OpenCodeSession[]>('/session');
   }

   async createAgent(input: CreateAgentInput = {}) {
      await this.startServer();
      return this.request<OpenCodeSession>('/session', {
         method: 'POST',
         body: {
            title: input.title,
         },
      });
   }

   async promptAgent(agentId: string, prompt: string) {
      await this.startServer();
      return this.request<OpenCodeMessageResponse>(
         `/session/${encodeURIComponent(agentId)}/message`,
         {
            method: 'POST',
            body: {
               model: this.getPromptModel(),
               parts: [
                  {
                     type: 'text',
                     text: prompt,
                  },
               ],
            },
         }
      );
   }

   async promptAgentText(agentId: string, prompt: string) {
      const response = await this.promptAgent(agentId, prompt);
      return this.getTextFromParts(response.parts);
   }

   async deleteAgent(agentId: string) {
      await this.startServer();
      return this.request<boolean>(`/session/${encodeURIComponent(agentId)}`, {
         method: 'DELETE',
      });
   }

   // ⚠️  DANGER — DO NOT CALL THIS CASUALLY ⚠️
   // This permanently destroys every active OpenCode agent session on the server.
   // Calling this mid-game will kill all AI participants instantly, break any
   // running room, and leave human players with no agents to interact with.
   // Only use this for emergency cleanup, test teardown, or server reset.
   // There is no undo.
   async deleteAllAgents() {
      await this.startServer();
      const sessions = await this.listAgents();
      await Promise.all(sessions.map(s => this.deleteAgent(s.id)));
   }

   getServerUrl() {
      return this.serverUrl;
   }

   async stopServer() {
      this.startupPromise = null;

      if (!this.serverStartedByService || !this.serverProcess) {
         return;
      }

      const child = this.serverProcess;
      this.serverProcess = null;
      this.serverStartedByService = false;

      await new Promise<void>(resolve => {
         let settled = false;

         const finish = () => {
            if (settled) {
               return;
            }

            settled = true;
            resolve();
         };

         child.once('close', finish);
         child.kill('SIGTERM');

         setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) {
               child.kill('SIGKILL');
            }
            finish();
         }, 3000);
      });
   }

   private async startServerInternal() {
      const existingServerReady = await this.isServerReady();
      if (existingServerReady) {
         this.serverUrl = envConfig.OPENCODE_BASE_URL;
         this.serverStartedByService = false;
         return this.getServerUrl();
      }

      const serverOptions = await this.getLaunchServerOptions();
      this.serverUrl = `http://${serverOptions.hostname}:${serverOptions.port}`;
      this.serverLog = '';
      const child = spawn('pnpm', this.buildServeArgs(serverOptions), {
         cwd: this.projectRoot,
         env: process.env,
         stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.serverProcess = child;
      this.serverStartedByService = true;

      child.stdout.on('data', chunk => {
         this.serverLog += String(chunk);
      });

      child.stderr.on('data', chunk => {
         this.serverLog += String(chunk);
      });

      child.once('close', () => {
         if (this.serverProcess?.pid === child.pid) {
            this.serverProcess = null;
            this.serverStartedByService = false;
         }
      });

      await this.waitForServerReady();

      return this.getServerUrl();
   }

   private buildServeArgs(serverOptions: { hostname: string; port: number }) {
      return [
         'exec',
         'opencode',
         'serve',
         '--hostname',
         serverOptions.hostname,
         '--port',
         String(serverOptions.port),
      ];
   }

   private getPromptModel(): OpenCodeModelSelection {
      return {
         providerID: envConfig.OPENCODE_PROVIDER,
         modelID: envConfig.OPENCODE_MODEL_ID,
      };
   }

   private getServerOptions() {
      const url = new URL(envConfig.OPENCODE_BASE_URL);
      return {
         hostname: url.hostname,
         port: Number(url.port || '4096'),
      };
   }

   private async getLaunchServerOptions() {
      const preferred = this.getServerOptions();
      const port = await this.findAvailablePort(preferred.hostname, preferred.port);

      return {
         hostname: preferred.hostname,
         port,
      };
   }

   private async findAvailablePort(hostname: string, preferredPort: number) {
      const preferredIsFree = await this.isPortAvailable(hostname, preferredPort);
      if (preferredIsFree) {
         return preferredPort;
      }

      return new Promise<number>((resolve, reject) => {
         const server = net.createServer();

         server.once('error', reject);
         server.listen(0, hostname, () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
               server.close(() => {
                  reject(new Error('Failed to resolve a free OpenCode port.'));
               });
               return;
            }

            const { port } = address;
            server.close(error => {
               if (error) {
                  reject(error);
                  return;
               }

               resolve(port);
            });
         });
      });
   }

   private async isPortAvailable(hostname: string, port: number) {
      return new Promise<boolean>(resolve => {
         const server = net.createServer();

         server.once('error', () => {
            resolve(false);
         });

         server.listen(port, hostname, () => {
            server.close(() => resolve(true));
         });
      });
   }

   private async waitForServerReady() {
      const timeoutMs = 20000;
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeoutMs) {
         if (this.serverProcess && this.serverProcess.exitCode !== null) {
            throw new Error(
               `OpenCode server exited before becoming ready.\n${this.serverLog.trim()}`
            );
         }

         const ready = await this.isServerReady();
         if (ready) {
            return;
         }

         await new Promise(resolve => setTimeout(resolve, 500));
      }

      throw new Error(
         `Timed out waiting for OpenCode server at ${this.getServerUrl()}.\n${this.serverLog.trim()}`
      );
   }

   private async isServerReady() {
      const apiReady = await this.canListSessions();
      if (apiReady) {
         return true;
      }

      const health = await this.getHealth().catch(() => null);
      return Boolean(health?.healthy);
   }

   private async canListSessions() {
      try {
         await this.request<OpenCodeSession[]>('/session', {
            timeoutMs: 1000,
         });
         return true;
      } catch {
         return false;
      }
   }

   private async getHealth() {
      return this.request<OpenCodeHealth>('/global/health');
   }

   private async request<T>(
      pathname: string,
      init?: {
         method?: 'GET' | 'POST' | 'DELETE';
         body?: unknown;
         timeoutMs?: number;
      }
   ) {
      const controller = new AbortController();
      const timeoutMs = init?.timeoutMs ?? 15000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;

      try {
         response = await fetch(`${this.getServerUrl()}${pathname}`, {
            method: init?.method ?? 'GET',
            headers: {
               'Content-Type': 'application/json',
            },
            body: init?.body ? JSON.stringify(init.body) : undefined,
            signal: controller.signal,
         });
      } catch (error) {
         if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(
               `OpenCode request timed out after ${timeoutMs}ms: ${pathname}`
            );
         }

         throw error;
      } finally {
         clearTimeout(timeout);
      }

      if (!response.ok) {
         const errorText = await response.text();
         throw new Error(
            `OpenCode request failed: ${response.status} ${response.statusText}\n${errorText}`
         );
      }

      if (response.status === 204) {
         return undefined as T;
      }

      return (await response.json()) as T;
   }

   private getTextFromParts(parts: OpenCodeMessagePart[]) {
      return parts
         .filter(part => part.type === 'text' && typeof part.text === 'string')
         .map(part => part.text?.trim())
         .filter(Boolean)
         .join('\n');
   }
}

export const agentService = new AgentService();
