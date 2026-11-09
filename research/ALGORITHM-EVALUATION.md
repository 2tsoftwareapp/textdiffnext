# 6. Algorithm Evaluation

## Executive Overview

No single diff or patch algorithm is universally optimal across all document topologies. An optimal diff engine must combine complementary algorithms tailored to specific workloads: character-level edits, refactored code blocks, natural language prose, and continuous streaming input.

This document analyzes the mathematical mechanics, time/space complexities, real-world strengths, and pathological vulnerabilities of seven key diffing and matching algorithms.

---

## 1. Algorithm Breakdown & Comparative Analysis

### 1. Myers Difference Algorithm ($O(ND)$)
- **Invented By:** Eugene Myers (1986).
- **Core Mechanism:** Models edit sequences as paths through an Edit Graph (directed acyclic grid of size $N \times M$). It searches for the shortest path from $(0,0)$ to $(N,M)$ along diagonals $k = x - y$, incrementing the edit distance $D$ step-by-step.
- **Time Complexity:** $O((N + M) D)$ where $D$ is the number of differences. Best-case $O(N)$ when texts are identical ($D=0$); worst-case $O(N^2)$ when texts are disjoint ($D \approx N$).
- **Space Complexity:** Standard forward/backward Myers requires $O(D)$ or $O(N)$ with linear-space divide-and-conquer (Hirschberg refinement).
- **Practical Strengths:** Guaranteed to produce the mathematically minimal edit script (shortest edit distance / longest common subsequence).
- **Pathological Failure:** When applied to unaligned or completely different files without bounds, exploring the diagonal frontier consumes enormous memory and time ($O(N^2)$), as seen in `jsdiff` during our benchmarks.
- **DMP Optimization:** Neil Fraser augmented Myers with two critical safeguards:
  1. Prefix / suffix trimming ($O(\text{prefix} + \text{suffix})$ upfront).
  2. Half-match heuristic (`diff_halfMatch_`): Finds if a substring of length $\ge \min(N,M)/4$ exists in both texts, splitting the problem into two smaller subproblems.
  3. `Diff_Timeout`: Truncates diagonal traversal when clock time exceeds 1.0s.

---

### 2. Patience Difference Algorithm
- **Invented By:** Bram Cohen (2001, for BitTorrent / Bazaar).
- **Core Mechanism:**
  1. Identifies lines (or tokens) that appear **uniquely exactly once** in both Text A and Text B.
  2. Finds the Longest Increasing Subsequence (LIS) of these unique anchors using patience sorting in $O(U \log U)$ time, where $U$ is the number of unique matches.
  3. Uses these anchors as fixed synchronization points, and recursively applies diffing to the segments between anchors.
- **Strengths in Code & Refactoring:**
  - Avoids Myers' "misleading alignment" flaw where recurring boilerplate (such as `}`, `return;`, `break;`, `else {`) binds to the wrong function block.
  - When an entire function or class is moved or rewritten, Patience matches the unique function headers and preserves the integrity of moved blocks.
- **Weaknesses:**
  - Ineffective on repetitive prose or short documents with few unique tokens.
  - Falls back to standard Myers when no unique lines exist.

---

### 3. Histogram Difference Algorithm
- **Origin:** JGit / Git default (`git diff --histogram`).
- **Core Mechanism:** An enhancement of Patience diff that addresses the "lack of unique lines" limitation.
  1. Builds a frequency histogram of all elements in both documents.
  2. Selects the element with the **lowest non-zero frequency** (the rarest token, even if not globally unique) to serve as a synchronization anchor.
  3. Recursively divides the problem around the rarest anchor.
- **Strengths:**
  - Significantly faster than standard Myers on large files with localized modifications.
  - Produces visually cleaner, more intuitive diffs than Myers for programming languages.
- **Weaknesses:**
  - Slightly non-minimal edit scripts in pathological edge cases.

---

### 4. Bitap Fuzzy Matching Algorithm (Shift-Or / Shift-And)
- **Invented By:** Ricardo Baeza-Yates & Gaston Gonnet (1992); Wu & Manber (1992).
- **Core Mechanism:** Represents the search pattern as bitmasks where each bit represents a character state. It shifts state bitmasks across the target text using fast bitwise `AND`, `OR`, and bitshifts (`<< 1`), calculating Levenshtein edit distance up to $k$ errors without dynamic programming matrices.
- **Strengths:**
  - Extreme speed for short patterns ($\le 32$ or $64$ characters). In JavaScript, 32-bit bitwise operations execute as single CPU machine instructions.
  - Distance penalty weighting: Incorporates expected match location and penalizes matches that drift far from original positions.
- **Limitations:**
  - In pure JavaScript, bitwise operators operate on 32-bit signed integers. Patterns longer than 32 characters must be chunked or simulated via `BigInt` (which adds garbage collection and allocation overhead).
  - High error thresholds ($k > 4$) degrade throughput.

---

### 5. Incremental & AST-Aware Diffing
- **Core Mechanism:**
  - **Character Incremental:** Maintains an existing diff and updates only the touched range upon single keystrokes (used in CodeMirror / Monaco).
  - **Tree-sitter / AST:** Parses source code into syntax trees and diffs tree nodes (e.g. GumTree algorithm).
- **Evaluation for TextDiffNext:**
  - Highly specialized for code; ineffective for arbitrary natural language prose, markdown, or JSON.
  - Heavy runtime dependencies (Tree-sitter WASM grammars). Unsuitable as the foundational core of a general-purpose text diff library, but valuable as an optional language plugin.

---

### 6. Token-Aware & Granular Diffing
- **Core Mechanism:**
  - Instead of operating strictly at character code units, text is tokenized into word spans, whitespace tokens, or programming language lexemes before computing LCS.
- **Evaluation for TextDiffNext:**
  - Solves Google DMP Issue #142 (unnatural character splices in prose).
  - Dramatically reduces the effective length of the sequence ($N$ drops from 10,000 characters to 1,500 words), speeding up Myers by 50x while producing natural word-level diffs.

---

### 7. Resource-Bounded Execution
- **Core Mechanism:**
  - Guarantees worst-case $O(N)$ execution bounds via three cooperative gates:
    1. **Pre-computation length filter:** Rejects or degrades inputs exceeding max safety bounds.
    2. **Timeout timer:** Checks `performance.now()` periodically inside inner loops; aborts or drops to greedy chunking when time limit expires.
    3. **Iteration counter:** Limits the maximum number of diagonal paths $D$ explored in Myers to $D_{\max} = 10,000$.
- **Evaluation:** Mandatory for production multi-tenant web applications and cloud services to prevent denial-of-service (ReDoS-like CPU exhaustion).

---

## 2. Workload Suitability Matrix

| Workload / Topology | Recommended Primary Algorithm | Secondary / Fallback | Why It Wins / Why Myers Fails |
|---|---|---|---|
| **Small inline edits (< 1 KB)** | **Myers with prefix/suffix trim** | None needed | Minimal overhead; Myers is instantaneous ($< 0.1\text{ ms}$). |
| **Large Source Code (> 1,000 lines)** | **Histogram / Patience Diff** | Myers on subsegments | Avoids binding to common syntax braces (`{`, `}`); preserves function blocks. |
| **Natural Language Prose** | **Token-Aware Myers + Semantic Cleanup** | Standard Myers | Prevents character-level word splitting (solves Issue #142). |
| **Repetitive Token Blocks** | **Myers + Strict Prefix/Suffix** | Line-hash encoding | Prevents ambiguous diagonal drift in Myers. |
| **Completely Different Texts** | **Half-match heuristic + Timeout Guard** | Abort to full replace | Pure Myers blows up to $O(N^2)$; timeout guard prevents thread lockup. |
| **Drifted Patch Application** | **Bitap Fuzzy Search (Shift-Or)** | Exact index lookup | Recovers moved text with typos; location weighting prioritizes original vicinity. |
| **Unicode Astral / Emoji Text** | **Grapheme-Cluster Preserving Myers** | Standard Myers | Guarantees Regional Indicator and surrogate pairs are never sliced apart. |
