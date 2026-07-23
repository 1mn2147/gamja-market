const origin = process.env.API_ORIGIN ?? 'http://127.0.0.1:4000';
// Stay below the API's per-client 100 requests/minute guard for the default
// smoke run. Higher-volume tests must distribute source identities or use a
// staging-only load-test policy so rate limiting is measured separately.
const requests = Number(process.env.PERF_REQUESTS ?? 80);
const concurrency = Number(process.env.PERF_CONCURRENCY ?? 10);
const thresholdMs = Number(process.env.PERF_P95_MS ?? 1_000);
const samples = [];
let failures = 0;

async function hit() {
  const started = performance.now();
  try {
    const response = await fetch(`${origin}/api/v1/products?limit=20`, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) failures += 1;
  } catch {
    failures += 1;
  } finally {
    samples.push(performance.now() - started);
  }
}

for (let offset = 0; offset < requests; offset += concurrency) {
  await Promise.all(Array.from({ length: Math.min(concurrency, requests - offset) }, () => hit()));
}

samples.sort((a, b) => a - b);
const percentile = (value) => samples[Math.min(samples.length - 1, Math.ceil(samples.length * value) - 1)] ?? Infinity;
const result = { requests, concurrency, failures, p50Ms: Math.round(percentile(0.5)), p95Ms: Math.round(percentile(0.95)), p99Ms: Math.round(percentile(0.99)), thresholdMs };
console.log(JSON.stringify(result));
if (failures > 0 || result.p95Ms > thresholdMs) process.exitCode = 1;
