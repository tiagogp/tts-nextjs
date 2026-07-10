import type { NextConfig } from "next";

const whisperTraceIncludes =
  process.platform === "linux" && process.arch === "x64"
    ? ["./node_modules/@kutalia/whisper-node-addon/dist/linux-x64/**/*"]
    : process.platform === "darwin"
      ? [
          `./node_modules/@kutalia/whisper-node-addon/dist/mac-${process.arch}/**/*`,
        ]
      : process.platform === "win32" && process.arch === "x64"
        ? ["./node_modules/@kutalia/whisper-node-addon/dist/win32-x64/**/*"]
        : [];

const sherpaTraceIncludes =
  process.platform === "linux"
    ? [
        `./node_modules/sherpa-onnx-linux-${process.arch === "arm64" ? "arm64" : "x64"}/**/*`,
      ]
    : process.platform === "darwin"
      ? [`./node_modules/sherpa-onnx-darwin-${process.arch}/**/*`]
      : process.platform === "win32"
        ? [
            `./node_modules/sherpa-onnx-win-${process.arch === "ia32" ? "ia32" : "x64"}/**/*`,
          ]
        : [];

const canvasTraceIncludes =
  process.platform === "linux" && process.arch === "x64"
    ? ["./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*"]
    : process.platform === "linux" && process.arch === "arm64"
      ? ["./node_modules/@napi-rs/canvas-linux-arm64-gnu/**/*"]
      : process.platform === "darwin" && process.arch === "arm64"
        ? ["./node_modules/@napi-rs/canvas-darwin-arm64/**/*"]
        : process.platform === "win32" && process.arch === "x64"
          ? ["./node_modules/@napi-rs/canvas-win32-x64-msvc/**/*"]
          : [];

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@kutalia/whisper-node-addon",
    "sherpa-onnx-node",
    "sherpa-onnx-darwin-arm64",
    "sherpa-onnx-linux-arm64",
    "sherpa-onnx-linux-x64",
    "sherpa-onnx-win-ia32",
    "sherpa-onnx-win-x64",
    "sql.js",
    "ankipack",
    "audio-decode",
    "@napi-rs/canvas",
  ],
  outputFileTracingExcludes: {
    "/*": ["./dist/**/*", "./.git/**/*"],
  },
  outputFileTracingIncludes: {
    "/api/**": [
      ...whisperTraceIncludes,
      "./node_modules/ankipack/**/*",
      "./node_modules/@bufbuild/protobuf/**/*",
      "./node_modules/fflate/**/*",
      "./node_modules/sherpa-onnx-node/**/*",
      ...sherpaTraceIncludes,
      "./node_modules/sql.js/dist/sql-asm.js",
      "./node_modules/@napi-rs/canvas/**/*",
      ...canvasTraceIncludes,
    ],
  },
};

export default nextConfig;
