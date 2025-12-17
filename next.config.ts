import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  // Ensure native/node-only packages are not bundled by Turbopack into server chunks.
  // This avoids runtime errors like "Failed to load native binding".
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas', 'pdfjs-dist', 'docx'],
};

export default nextConfig;


