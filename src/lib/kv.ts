import { promises as fs } from "fs";
import path from "path";

const hasKv = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

const LOCAL_DATA_DIR = path.join(process.cwd(), ".local-data");

let warnedLocalFallback = false;

function warnLocalFallbackOnce() {
  if (warnedLocalFallback) return;
  warnedLocalFallback = true;
  console.warn(
    "[kv] KV_REST_API_URL / KV_REST_API_TOKEN が未設定のため、" +
      `ローカルファイル (${LOCAL_DATA_DIR}) にフォールバックします。` +
      "本番環境ではVercelでRedis(旧KV)ストアを作成し環境変数を設定してください。"
  );
}

function localFilePath(key: string): string {
  return path.join(LOCAL_DATA_DIR, `${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
}

async function localGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(localFilePath(key), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function localSet(key: string, value: unknown): Promise<void> {
  await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
  await fs.writeFile(localFilePath(key), JSON.stringify(value), "utf-8");
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (!hasKv) {
    warnLocalFallbackOnce();
    return localGet<T>(key);
  }
  const { kv } = await import("@vercel/kv");
  const value = await kv.get<T>(key);
  return value ?? null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  if (!hasKv) {
    warnLocalFallbackOnce();
    return localSet(key, value);
  }
  const { kv } = await import("@vercel/kv");
  await kv.set(key, value);
}
