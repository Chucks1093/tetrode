import { spawn } from 'node:child_process';

const PIPELINE_INTERVAL_HOURS = Number(
   process.env.PIPELINE_INTERVAL_HOURS ?? '2'
);
const PIPELINE_INTERVAL_MS = Math.max(1, PIPELINE_INTERVAL_HOURS) * 60 * 60 * 1000;

const COMMENTS_REPLY_INTERVAL_MINUTES = Number(
   process.env.COMMENTS_REPLY_INTERVAL_MINUTES ?? '30'
);
const COMMENTS_REPLY_INTERVAL_MS =
   Math.max(1, COMMENTS_REPLY_INTERVAL_MINUTES) * 60 * 1000;

const PIPELINE_RUN_IMMEDIATELY = process.env.PIPELINE_RUN_IMMEDIATELY !== 'false';
const COMMENTS_REPLY_RUN_IMMEDIATELY =
   process.env.COMMENTS_REPLY_RUN_IMMEDIATELY !== 'false';

let pipelineInProgress = false;
let commentsInProgress = false;

function nowIso(): string {
   return new Date().toISOString();
}

function runCommand(command: string): Promise<void> {
   return new Promise((resolve, reject) => {
      const child = spawn('pnpm', [command], {
         stdio: 'inherit',
         shell: process.platform === 'win32',
      });

      child.on('error', reject);
      child.on('exit', code => {
         if (code === 0) {
            resolve();
            return;
         }
         reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
      });
   });
}

async function runPipelineIfIdle(trigger: 'startup' | 'interval'): Promise<void> {
   if (pipelineInProgress) {
      console.log(`[pipeline-scheduler][${nowIso()}] Skip pipeline (${trigger}): already running.`);
      return;
   }

   pipelineInProgress = true;
   console.log(`[pipeline-scheduler][${nowIso()}] Start pipeline (${trigger}).`);

   try {
      await runCommand('pipeline:run');
      console.log(`[pipeline-scheduler][${nowIso()}] Success pipeline (${trigger}).`);
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[pipeline-scheduler][${nowIso()}] Failed pipeline (${trigger}): ${message}`);
   } finally {
      pipelineInProgress = false;
   }
}

async function runCommentsIfIdle(trigger: 'startup' | 'interval'): Promise<void> {
   if (commentsInProgress) {
      console.log(`[pipeline-scheduler][${nowIso()}] Skip comments (${trigger}): already running.`);
      return;
   }

   commentsInProgress = true;
   console.log(`[pipeline-scheduler][${nowIso()}] Start comments (${trigger}).`);

   try {
      await runCommand('comments:reply');
      console.log(`[pipeline-scheduler][${nowIso()}] Success comments (${trigger}).`);
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[pipeline-scheduler][${nowIso()}] Failed comments (${trigger}): ${message}`);
   } finally {
      commentsInProgress = false;
   }
}

function startScheduler(): void {
   console.log(
      `[pipeline-scheduler] Full pipeline every ${PIPELINE_INTERVAL_HOURS} hour(s).`
   );
   console.log(
      `[pipeline-scheduler] Comments reply every ${COMMENTS_REPLY_INTERVAL_MINUTES} minute(s).`
   );

   if (PIPELINE_RUN_IMMEDIATELY) {
      void runPipelineIfIdle('startup');
   }

   if (COMMENTS_REPLY_RUN_IMMEDIATELY) {
      void runCommentsIfIdle('startup');
   }

   const pipelineTimer = setInterval(() => {
      void runPipelineIfIdle('interval');
   }, PIPELINE_INTERVAL_MS);

   const commentsTimer = setInterval(() => {
      void runCommentsIfIdle('interval');
   }, COMMENTS_REPLY_INTERVAL_MS);

   process.on('SIGINT', () => {
      clearInterval(pipelineTimer);
      clearInterval(commentsTimer);
      console.log('[pipeline-scheduler] Stopped (SIGINT).');
      process.exit(0);
   });

   process.on('SIGTERM', () => {
      clearInterval(pipelineTimer);
      clearInterval(commentsTimer);
      console.log('[pipeline-scheduler] Stopped (SIGTERM).');
      process.exit(0);
   });
}

startScheduler();
