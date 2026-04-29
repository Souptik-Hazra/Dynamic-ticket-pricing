#!/usr/bin/env node
import killPort from 'kill-port';

const ports = [4000, 5000, 5173];

async function killAll() {
  for (const p of ports) {
    try {
      await killPort(p);
      console.log(`Process on port ${p} killed`);
    } catch (err) {
      // ignore errors — the goal is best-effort cleanup
    }
  }
  process.exit(0);
}

killAll();
