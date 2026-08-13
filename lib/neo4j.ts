import neo4j, { type Driver, type Integer, type Record as Neo4jRecord } from 'neo4j-driver';

const POOL_MAX = 6;
const CONNECTION_TIMEOUT_MS = 10_000;

declare global {
  // eslint-disable-next-line no-var
  var __shipgraphDriver: Driver | undefined;
}

export class DbUnreachableError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`graph database unreachable: ${reason}`);
    this.name = 'DbUnreachableError';
    this.reason = reason;
  }
}

function env(name: string): string | undefined {
  return process.env[name];
}

/** Sanitise a driver/connection error so credentials can never leak into a response. */
function sanitize(msg: string): string {
  let out = msg;
  for (const secret of [env('COGNODB_PASSWORD'), env('COGNODB_USERNAME')]) {
    if (secret && secret.length > 0) {
      out = out.split(secret).join('***');
    }
  }
  const uri = env('COGNODB_URI');
  if (uri) {
    // URI may embed credentials (bolt+s://user:pass@host). Strip any such pair.
    out = out.replace(/\/\/[^@\s]+@/, '//***@');
    out = out.split(uri).join('<cognodb-uri>');
  }
  return out;
}

function credsAvailable(): boolean {
  return Boolean(env('COGNODB_URI') && env('COGNODB_USERNAME') && env('COGNODB_PASSWORD'));
}

/**
 * Lazily initialised singleton driver. Env is read at call time (not module
 * scope) so `next build` and cold starts can survive missing COGNODB_*.
 */
function getDriver(): Driver | null {
  if (!credsAvailable()) return null;
  if (globalThis.__shipgraphDriver) return globalThis.__shipgraphDriver;
  const driver = neo4j.driver(
    env('COGNODB_URI')!,
    neo4j.auth.basic(env('COGNODB_USERNAME')!, env('COGNODB_PASSWORD')!),
    {
      maxConnectionPoolSize: POOL_MAX,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      disableLosslessIntegers: false,
    },
  );
  globalThis.__shipgraphDriver = driver;
  return driver;
}

export function driverStatus(): { db: boolean; reason?: string } {
  const driver = getDriver();
  if (!driver) {
    return { db: false, reason: 'missing COGNODB_URI/USERNAME/PASSWORD' };
  }
  return { db: true };
}

// ---------------------------------------------------------------------------
// Integer / value conversion (driver returns lossless Integer objects)
// ---------------------------------------------------------------------------

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type UnknownRecord = Record<string, unknown>;

function isInteger(v: unknown): v is Integer {
  return neo4j.isInt(v);
}

function convertInteger(v: Integer): number | string {
  return v.inSafeRange() ? v.toNumber() : v.toString();
}

function convertValue(v: unknown): JsonValue {
  if (v === null || v === undefined) return null;
  if (isInteger(v)) return convertInteger(v);
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : String(v);
  if (Array.isArray(v)) return v.map(convertValue);
  if (typeof v === 'object') {
    const anyV = v as UnknownRecord;
    if (typeof anyV.identity === 'object' && Array.isArray(anyV.labels)) {
      return convertValue(anyV.properties);
    }
    if (typeof anyV.start === 'object' && typeof anyV.type === 'string') {
      const props = convertValue(anyV.properties);
      if (props !== null && typeof props === 'object' && !Array.isArray(props)) {
        return { type: String(anyV.type), ...props };
      }
      return { type: String(anyV.type) };
    }
    if (Array.isArray(anyV.segments) && anyV.start !== undefined) {
      return convertValue(anyV.segments);
    }
    const out: { [k: string]: JsonValue } = {};
    for (const [k, val] of Object.entries(anyV)) out[k] = convertValue(val);
    return out;
  }
  return String(v);
}

function recordToJson(record: Neo4jRecord): UnknownRecord {
  const out: UnknownRecord = {};
  const keys = record.keys as string[];
  for (const key of keys) out[key] = convertValue(record.get(key));
  return out;
}

/**
 * Run Cypher with parameters. Session is ALWAYS closed in finally.
 * Throws DbUnreachableError when the DB is unavailable.
 */
export async function runQuery<T = UnknownRecord>(
  cypher: string,
  params: UnknownRecord = {},
): Promise<T[]> {
  const driver = getDriver();
  if (!driver) {
    throw new DbUnreachableError('missing COGNODB_URI/USERNAME/PASSWORD');
  }
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map(recordToJson) as unknown as T[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new DbUnreachableError(sanitize(msg));
  } finally {
    await session.close();
  }
}

