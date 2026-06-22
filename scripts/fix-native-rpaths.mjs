import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

if (process.platform === "darwin") {
  const require = createRequire(import.meta.url);
  const entry = require.resolve("@kutalia/whisper-node-addon");
  const addon = join(dirname(entry), "..", `mac-${process.arch}`, "whisper.node");
  if (existsSync(addon)) {
    const current = spawnSync("/usr/bin/otool", ["-l", addon], { encoding: "utf8" });
    if (!current.stdout?.includes("path @loader_path")) {
      const result = spawnSync(
        "/usr/bin/install_name_tool",
        ["-add_rpath", "@loader_path", addon],
        { stdio: "inherit" },
      );
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
  }
}
