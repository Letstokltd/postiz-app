import 'source-map-support/register';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

import { NestFactory } from '@nestjs/core';
import { AppModule } from '@gitroom/orchestrator/app.module';
import * as dns from 'node:dns';
import * as net from 'node:net';

dns.setDefaultResultOrder('ipv4first');

function parseTemporalAddress(address: string): { host: string; port: number } {
  const [host, portPart] = address.split(':');
  const port = parseInt(portPart || '7233', 10);
  return { host, port };
}

/**
 * Ensures Temporal frontend accepts TCP before workers bootstrap. Avoids a race where the
 * Temporal client connects but the worker SDK gets connection refused (no retry in nestjs-temporal-core),
 * leaving post workflows stuck with no pollers on task queue "main".
 */
async function waitForTemporalTcp(
  host: string,
  port: number,
  attempts = 45,
  delayMs = 2000
): Promise<void> {
  let lastErr: Error | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({ host, port }, () => {
          socket.end();
          resolve();
        });
        socket.on('error', reject);
        socket.setTimeout(8000, () => {
          socket.destroy();
          reject(new Error('connect timeout'));
        });
      });
      return;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw new Error(
    `Temporal not reachable at ${host}:${port} after ${attempts} attempts: ${lastErr?.message}`
  );
}

async function bootstrap() {
  if (!process.env.SKIP_TEMPORAL_READINESS_WAIT) {
    const raw = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    const { host, port } = parseTemporalAddress(raw);
    await waitForTemporalTcp(host, port);
    const settleMs = parseInt(
      process.env.TEMPORAL_STARTUP_SETTLE_MS || '1500',
      10
    );
    if (settleMs > 0) {
      await new Promise((r) => setTimeout(r, settleMs));
    }
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
}

bootstrap();
