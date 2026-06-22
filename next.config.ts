import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@kutalia/whisper-node-addon",
    "sherpa-onnx-node",
    "sherpa-onnx-darwin-arm64",
    "sql.js",
    "ankipack",
    "audio-decode",
    "@napi-rs/canvas",
  ],
  outputFileTracingIncludes: {
    "/api/*": [
      "./node_modules/@kutalia/whisper-node-addon/dist/mac-arm64/**/*",
      "./node_modules/sherpa-onnx-node/**/*",
      "./node_modules/sherpa-onnx-darwin-arm64/**/*",
      "./node_modules/sql.js/dist/sql-wasm.wasm",
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-darwin-arm64/**/*",
    ],
  },
};

export default nextConfig;
