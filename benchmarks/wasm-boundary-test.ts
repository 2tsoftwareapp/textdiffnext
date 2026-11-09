import * as fs from "fs";
import * as path from "path";
import fastDiff from "fast-diff";
import GoogleDMP from "diff-match-patch";

const wasmPath = path.join(
  process.cwd(),
  "benchmarks/wasm_probe/target/wasm32-unknown-unknown/release/wasm_probe.wasm"
);
const wasmBuffer = fs.readFileSync(wasmPath);

async function initWasm() {
  const wasmModule = await WebAssembly.instantiate(wasmBuffer, {});
  return wasmModule.instance.exports as {
    wasm_alloc: (size: number) => number;
    wasm_dealloc: (ptr: number, size: number) => void;
    boundary_memory_ping_pong: (
      ptrA: number,
      lenA: number,
      ptrB: number,
      lenB: number
    ) => number;
    rust_diff_bytes: (
      ptrA: number,
      lenA: number,
      ptrB: number,
      lenB: number
    ) => number;
    memory: WebAssembly.Memory;
  };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface BoundaryMeasurement {
  sizeLabel: string;
  bytesCount: number;
  jsFastDiffMs: number;
  jsGoogleDmpMs: number;
  wasmEncodeCopyAllocMs: number; // serialization + boundary transfer
  wasmDiffComputeMs: number;     // actual Rust execution in WASM
  wasmTotalEndToEndMs: number;   // total wall time
  boundaryOverheadPercent: number;
}

async function runTest() {
  const wasm = await initWasm();
  const testSizes = [
    { label: "100 B", size: 100 },
    { label: "1 KB", size: 1000 },
    { label: "10 KB", size: 10000 },
    { label: "100 KB", size: 100000 },
    { label: "500 KB", size: 500000 },
  ];

  const results: BoundaryMeasurement[] = [];
  const ITERS = 15;

  console.log("=== WASM BOUNDARY & SERIALIZATION OVERHEAD BENCHMARK ===\n");

  for (const { label, size } of testSizes) {
    // Generate base string and modified string (single edit in middle)
    const base = "A".repeat(size / 2) + "X" + "B".repeat(size / 2);
    const mod  = "A".repeat(size / 2) + "Y" + "B".repeat(size / 2);

    // 1. Pure JS: fast-diff
    let jsFastTotal = 0;
    for (let i = 0; i < ITERS; i++) {
      const t0 = performance.now();
      fastDiff(base, mod);
      jsFastTotal += performance.now() - t0;
    }
    const jsFastDiffMs = Number((jsFastTotal / ITERS).toFixed(4));

    // 2. Pure JS: Google DMP
    const dmp = new GoogleDMP();
    let jsDmpTotal = 0;
    for (let i = 0; i < ITERS; i++) {
      const t0 = performance.now();
      const d = dmp.diff_main(base, mod);
      dmp.diff_cleanupSemantic(d);
      jsDmpTotal += performance.now() - t0;
    }
    const jsGoogleDmpMs = Number((jsDmpTotal / ITERS).toFixed(4));

    // 3. WASM Boundary Transfer only (Encode + Alloc + Memory Copy + Dealloc)
    let wasmTransferTotal = 0;
    for (let i = 0; i < ITERS; i++) {
      const t0 = performance.now();
      const bytesA = encoder.encode(base);
      const bytesB = encoder.encode(mod);
      const ptrA = wasm.wasm_alloc(bytesA.length);
      const ptrB = wasm.wasm_alloc(bytesB.length);
      const memA = new Uint8Array(wasm.memory.buffer, ptrA, bytesA.length);
      const memB = new Uint8Array(wasm.memory.buffer, ptrB, bytesB.length);
      memA.set(bytesA);
      memB.set(bytesB);
      wasm.boundary_memory_ping_pong(ptrA, bytesA.length, ptrB, bytesB.length);
      wasm.wasm_dealloc(ptrA, bytesA.length);
      wasm.wasm_dealloc(ptrB, bytesB.length);
      wasmTransferTotal += performance.now() - t0;
    }
    const wasmEncodeCopyAllocMs = Number((wasmTransferTotal / ITERS).toFixed(4));

    // 4. WASM End-to-End (Encode + Copy + Rust Diff Execution + Cleanup)
    let wasmE2ETotal = 0;
    let wasmComputeOnlyTotal = 0;
    for (let i = 0; i < ITERS; i++) {
      const t0 = performance.now();
      const bytesA = encoder.encode(base);
      const bytesB = encoder.encode(mod);
      const ptrA = wasm.wasm_alloc(bytesA.length);
      const ptrB = wasm.wasm_alloc(bytesB.length);
      const memA = new Uint8Array(wasm.memory.buffer, ptrA, bytesA.length);
      const memB = new Uint8Array(wasm.memory.buffer, ptrB, bytesB.length);
      memA.set(bytesA);
      memB.set(bytesB);

      const tComp0 = performance.now();
      wasm.rust_diff_bytes(ptrA, bytesA.length, ptrB, bytesB.length);
      const tComp1 = performance.now();
      wasmComputeOnlyTotal += tComp1 - tComp0;

      wasm.wasm_dealloc(ptrA, bytesA.length);
      wasm.wasm_dealloc(ptrB, bytesB.length);
      wasmE2ETotal += performance.now() - t0;
    }
    const wasmDiffComputeMs = Number((wasmComputeOnlyTotal / ITERS).toFixed(4));
    const wasmTotalEndToEndMs = Number((wasmE2ETotal / ITERS).toFixed(4));
    const boundaryOverheadPercent = Number(
      ((wasmEncodeCopyAllocMs / wasmTotalEndToEndMs) * 100).toFixed(1)
    );

    results.push({
      sizeLabel: label,
      bytesCount: size,
      jsFastDiffMs,
      jsGoogleDmpMs,
      wasmEncodeCopyAllocMs,
      wasmDiffComputeMs,
      wasmTotalEndToEndMs,
      boundaryOverheadPercent,
    });

    console.log(
      `Payload [${label}]: JS fast-diff=${jsFastDiffMs}ms, JS DMP=${jsGoogleDmpMs}ms | WASM: Transfer=${wasmEncodeCopyAllocMs}ms, Compute=${wasmDiffComputeMs}ms, E2E=${wasmTotalEndToEndMs}ms (Transfer = ${boundaryOverheadPercent}% of total)`
    );
  }

  console.log("\n### WASM Overhead Analysis Table");
  console.log(
    "| Payload Size | JS fast-diff (ms) | JS Google DMP (ms) | WASM Transfer/Alloc (ms) | WASM Compute (ms) | WASM Total E2E (ms) | Boundary Overhead (%) |"
  );
  console.log(
    "|---|---|---|---|---|---|---|"
  );
  for (const r of results) {
    console.log(
      `| ${r.sizeLabel} | ${r.jsFastDiffMs} | ${r.jsGoogleDmpMs} | ${r.wasmEncodeCopyAllocMs} | ${r.wasmDiffComputeMs} | ${r.wasmTotalEndToEndMs} | ${r.boundaryOverheadPercent}% |`
    );
  }

  fs.writeFileSync(
    path.join(process.cwd(), "benchmarks/wasm-boundary-results.json"),
    JSON.stringify(results, null, 2)
  );
}

runTest().catch(console.error);
