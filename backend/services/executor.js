const { spawn, execFile } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const TMP_ROOT = path.join(__dirname, "..", "tmp_runs");
const TIME_LIMIT_MS = 5000;
const MEMORY_LIMIT = "256m";
const CPU_LIMIT = "0.5";
const PIDS_LIMIT = "64";
const MAX_OUTPUT_CHARS = 100_000;

const LANGUAGES = {
  python: {
    filename: "solution.py",
    image: "python:3.11-slim",
    compile: null,
    run: ["python3", "solution.py"],
  },
  cpp: {
    filename: "solution.cpp",
    image: "gcc:latest",
    compile: ["sh", "-c", "g++ -O2 -o solution solution.cpp 2> compile_err.txt"],
    run: ["./solution"],
  },
  java: {
    filename: "Main.java",
    image: "eclipse-temurin:17-jdk",
    compile: ["sh", "-c", "javac Main.java 2> compile_err.txt"],
    run: ["java", "Main"],
  },
};

function execFileAsync(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 10_000 }, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
}

/**
 * Runs a docker container for a single step (compile or execute a test case).
 * Uses a named, non-detached `docker run --rm` so a timeout can be enforced
 * with `docker kill <name>` — killing the CLI process alone would not stop
 * the container since it isn't attached in detached mode.
 */
function runDockerStep({ image, cmd, tmpDir, writable, input, timeoutMs }) {
  return new Promise((resolve) => {
    const containerName = `oj-run-${crypto.randomUUID()}`;
    const mount = `${tmpDir}:/code${writable ? "" : ":ro"}`;
    const args = [
      "run",
      "--rm",
      "--name",
      containerName,
      "-i",
      "--network",
      "none",
      `--memory=${MEMORY_LIMIT}`,
      `--cpus=${CPU_LIMIT}`,
      `--pids-limit=${PIDS_LIMIT}`,
      "-v",
      mount,
      "-w",
      "/code",
      image,
      ...cmd,
    ];

    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(async () => {
      timedOut = true;
      await execFileAsync("docker", ["kill", containerName]);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (stdout.length < MAX_OUTPUT_CHARS) stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < MAX_OUTPUT_CHARS) stderr += chunk.toString();
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, timedOut });
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr + `\n${err.message}`, exitCode: -1, timedOut: false });
    });

    if (input !== undefined) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

function normalizeOutput(str) {
  return str.replace(/\r\n/g, "\n").trim();
}

async function runSubmission({ language, code, testCases }) {
  const config = LANGUAGES[language];
  if (!config) {
    return { verdict: "Compilation Error", passedCount: 0, totalCount: testCases.length, errorMessage: `Unsupported language: ${language}` };
  }

  const runId = crypto.randomUUID();
  const tmpDir = path.join(TMP_ROOT, runId);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    await fs.writeFile(path.join(tmpDir, config.filename), code, "utf8");

    if (config.compile) {
      const compileResult = await runDockerStep({
        image: config.image,
        cmd: config.compile,
        tmpDir,
        writable: true,
        timeoutMs: 15_000,
      });

      let compileErr = "";
      try {
        compileErr = await fs.readFile(path.join(tmpDir, "compile_err.txt"), "utf8");
      } catch {
        // no compile_err.txt written — fall back to stderr from the docker step itself
        compileErr = compileResult.stderr;
      }

      if (compileResult.exitCode !== 0) {
        return {
          verdict: "Compilation Error",
          passedCount: 0,
          totalCount: testCases.length,
          errorMessage: compileErr.trim().slice(0, 4000) || "Compilation failed",
        };
      }
    }

    let passedCount = 0;
    for (const tc of testCases) {
      const result = await runDockerStep({
        image: config.image,
        cmd: config.run,
        tmpDir,
        writable: false,
        input: tc.input,
        timeoutMs: TIME_LIMIT_MS,
      });

      if (result.timedOut) {
        return {
          verdict: "Time Limit Exceeded",
          passedCount,
          totalCount: testCases.length,
          errorMessage: `Exceeded ${TIME_LIMIT_MS}ms on test case ${passedCount + 1}`,
        };
      }

      if (result.exitCode !== 0) {
        return {
          verdict: "Runtime Error",
          passedCount,
          totalCount: testCases.length,
          errorMessage: result.stderr.trim().slice(0, 4000) || `Process exited with code ${result.exitCode}`,
        };
      }

      if (normalizeOutput(result.stdout) !== normalizeOutput(tc.output)) {
        return {
          verdict: "Wrong Answer",
          passedCount,
          totalCount: testCases.length,
          errorMessage: `Mismatch on test case ${passedCount + 1}`,
        };
      }

      passedCount += 1;
    }

    return { verdict: "Accepted", passedCount, totalCount: testCases.length, errorMessage: "" };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { runSubmission, LANGUAGES };
