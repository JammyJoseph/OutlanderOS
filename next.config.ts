import type { NextConfig } from "next";
import path from "path";
import { existsSync } from "fs";

function findRoot(dir: string): string {
  if (existsSync(path.join(dir, "node_modules", "next", "package.json"))) return dir;
  const parent = path.dirname(dir);
  if (parent === dir) return dir;
  return findRoot(parent);
}

const nextConfig: NextConfig = {
  turbopack: {
    root: findRoot(path.resolve(__dirname)),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // "0", not "1; mode=block". The old XSS auditor this switched on has
          // been removed from every browser, and where it lingered it could be
          // abused to blank out parts of a legitimate page. OWASP's current
          // advice is to turn it off explicitly.
          { key: "X-XSS-Protection", value: "0" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Browsers remember to use HTTPS for a year, so a stray http:// link
          // can never send the session cookie in the clear. No includeSubDomains
          // or preload: both are hard to undo, and this app does not own every
          // subdomain of the hostnames it is served on.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          // Nothing in the app uses the camera, microphone, location or payment
          // APIs, so no page can — including any script that gets in somehow.
          // Clipboard is left alone: eight screens have copy buttons.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          // A deliberately narrow policy. It restricts what can never be
          // legitimate here — being framed by another site, a <base> tag
          // redirecting relative URLs, forms posting off-site, plugin content —
          // without touching scripts, styles or images, which would need every
          // inline script and third-party embed audited first. A full script
          // policy is the next step, not this one.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
