/** Shared stdin/file JSON helpers for write-* CLIs. */
import { readFileSync } from "node:fs";

export function readJsonInput(path?: string): unknown {
  const raw = path ? readFileSync(path, "utf8") : readFileSync(0, "utf8");
  return JSON.parse(raw) as unknown;
}

/** MCP query shape: `{ results: [...] }` or a bare results array. */
export function extractResults(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown[] }).results)) {
    return (data as { results: unknown[] }).results;
  }
  throw new Error("Expected { results: [...] } or a bare results array");
}

/** Queue shape: `{ items: [...] }` or a bare items array. */
export function extractItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown[] }).items)) {
    return (data as { items: T[] }).items;
  }
  throw new Error("Expected { items: [...] } or a bare items array");
}
