/**
 * macOS focus helpers — keep headed automation from yanking the user off their work.
 * No-ops on other platforms.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function isDarwin(): boolean {
  return process.platform === "darwin";
}

export async function getFrontmostAppName(): Promise<string | null> {
  if (!isDarwin()) return null;
  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      'tell application "System Events" to get name of first application process whose frontmost is true',
    ]);
    const name = stdout.trim();
    return name || null;
  } catch {
    return null;
  }
}

export async function activateApp(name: string): Promise<void> {
  if (!isDarwin() || !name) return;
  try {
    await execFileAsync("osascript", [
      "-e",
      `tell application ${JSON.stringify(name)} to activate`,
    ]);
  } catch {
    /* best-effort — Accessibility may deny */
  }
}

/** Run `fn`, then return focus to whatever app was frontmost beforehand. */
export async function withPreservedFocus<T>(fn: () => Promise<T>): Promise<T> {
  const previous = await getFrontmostAppName();
  try {
    return await fn();
  } finally {
    if (previous) await activateApp(previous);
  }
}

function isChromeFamilyApp(name: string): boolean {
  return /chrome|chromium|playwright|msedge|edge/i.test(name);
}

/**
 * Session guard: remember the user's frontmost app and bounce focus back when
 * our headed Chrome becomes frontmost (launch, new tab, navigation).
 */
export class FocusGuard {
  private previous: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private restoring = false;

  async start(): Promise<void> {
    if (!isDarwin()) return;
    this.previous = await getFrontmostAppName();
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 400);
    this.timer.unref?.();
  }

  async restore(): Promise<void> {
    if (!this.previous) return;
    await activateApp(this.previous);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (!this.previous || this.restoring) return;
    const front = await getFrontmostAppName();
    if (!front || front === this.previous) return;
    // Only pull back when automation Chrome stole focus — leave the user alone
    // if they switched to some other non-browser app themselves.
    if (!isChromeFamilyApp(front)) return;
    this.restoring = true;
    try {
      await activateApp(this.previous);
    } finally {
      this.restoring = false;
    }
  }
}
