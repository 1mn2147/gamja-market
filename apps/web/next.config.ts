import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'Content-Security-Policy', value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.tosspayments.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: http://localhost:4000",
    "connect-src 'self' http://localhost:4000 ws://localhost:4000",
    "frame-src https://payment-gateway-sandbox.tosspayments.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ') },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
];

const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
} satisfies NextConfig;

export default nextConfig;
