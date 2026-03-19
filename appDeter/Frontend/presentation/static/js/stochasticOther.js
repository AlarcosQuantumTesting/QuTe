// ================================
// Helpers: Stochastic "Other" logic
// ================================

// (Opcional) inferir total qubits desde texto de circuito
function inferTotalQubitsFromCircuitText(txt) {
  const s = String(txt || "");

  let m = s.match(/QuantumCircuit\s*\(\s*(\d+)\s*(?:,|\))/i);
  if (m) return parseInt(m[1], 10);

  m = s.match(/qreg\s+\w+\s*\[\s*(\d+)\s*\]\s*;/i);
  if (m) return parseInt(m[1], 10);

  m = s.match(/LineQubit\.range\s*\(\s*(\d+)\s*\)/i);
  if (m) return parseInt(m[1], 10);

  return null;
}

// Inferir ancho de bits desde los outputs observados (ej: [1,1,0] => 3)
function inferBitWidthFromDataOutputs(data) {
  if (!Array.isArray(data)) return null;

  for (const row of data) {
    const out = row?.output;

    if (Array.isArray(out) && out.length > 0) return out.length;

    if (typeof out === "string") {
      const bitsOnly = out.replace(/[^01]/g, "");
      if (bitsOnly.length > 0) return bitsOnly.length;
    }
  }

  return null;
}

// Resolver ancho a usar para enumerar combinaciones faltantes
// Prioridad: opts.totalQubits -> opts.outputBitCount -> project -> infer por circuito -> infer por outputs
function resolveTotalQubits(opts = {}, selectedProject = null, data = null) {
  let n =
    (Number.isInteger(opts?.totalQubits) ? opts.totalQubits : null) ??
    (Number.isInteger(opts?.nQubits) ? opts.nQubits : null) ??
    (Number.isInteger(opts?.outputBitCount) ? opts.outputBitCount : null) ??
    (Number.isInteger(selectedProject?.total_qubits) ? selectedProject.total_qubits : null) ??
    (Number.isInteger(selectedProject?.num_qubits) ? selectedProject.num_qubits : null);

  if (!Number.isInteger(n) || n <= 0) {
    n = inferTotalQubitsFromCircuitText(selectedProject?.circuit_file_content);
  }

  if (!Number.isInteger(n) || n <= 0) {
    n = inferBitWidthFromDataOutputs(data);
  }

  return (Number.isInteger(n) && n > 0) ? n : null;
}

function normalizeOutputToBitstring(out, n) {
  if (!Number.isInteger(n) || n <= 0) return null;

  if (Array.isArray(out)) {
    const bits = out.map(x => String(x).trim()).join("");
    if (/^[01]+$/.test(bits)) return bits.padStart(n, "0").slice(-n);
    return null;
  }

  if (typeof out === "string") {
    const cleaned = out.replace(/[^01]/g, "");
    if (/^[01]+$/.test(cleaned) && cleaned.length > 0) {
      return cleaned.padStart(n, "0").slice(-n);
    }
    return null;
  }

  if (typeof out === "number" && Number.isFinite(out)) {
    const asInt = Math.trunc(out);
    if (asInt < 0) return null;
    return asInt.toString(2).padStart(n, "0").slice(-n);
  }

  return null;
}

function computeMissingBitstrings(seenSet, n, cfg = {}) {
  const maxList = Number.isFinite(cfg?.maxList) ? cfg.maxList : 64;
  const hardCapN = Number.isFinite(cfg?.hardCapN) ? cfg.hardCapN : 12;

  const total = (n > 0) ? (2 ** n) : 0;

  if (!Number.isInteger(n) || n <= 0) {
    return { total, missingCount: 0, listed: [], skipped: true, reason: "invalid_n" };
  }

  const seenSize = (seenSet && typeof seenSet.size === "number") ? seenSet.size : 0;
  const missingCount = Math.max(0, total - seenSize);

  if (n > hardCapN) {
    return { total, missingCount, listed: [], skipped: true, reason: "n_too_large" };
  }

  const listed = [];
  for (let i = 0; i < total; i++) {
    const b = i.toString(2).padStart(n, "0");
    if (!seenSet.has(b)) {
      listed.push(b);
      if (listed.length >= maxList) break;
    }
  }

  return { total, missingCount, listed, skipped: missingCount > listed.length, reason: null };
}

export function buildStochasticOtherModel({
  data,
  shots,
  sumCountsListed,
  sumExpectedPercent,
  errorRange,
  opts = {},
  selectedProject = null
}) {
  if (!Number.isFinite(shots) || shots <= 0) return { ok: false, reason: "no_shots" };

  const otherCounts = Math.max(0, shots - (Number(sumCountsListed) || 0));
  const otherPct = (otherCounts / shots) * 100;
  const expectedOther = Math.max(0, 100 - (Number(sumExpectedPercent) || 0));
  const deviationOther = Math.abs(otherPct - expectedOther);

  const err = Math.max(0, Math.min(100, Number(errorRange) || 0));
  const loO = Math.max(0, expectedOther - err);
  const hiO = Math.min(100, expectedOther + err);
  const okOther = (otherPct >= loO && otherPct <= hiO);

  const bitWidth = resolveTotalQubits(opts, selectedProject, data);

  const seen = new Set();
  if (Number.isInteger(bitWidth) && bitWidth > 0) {
    for (const row of (Array.isArray(data) ? data : [])) {
      const bit = normalizeOutputToBitstring(row?.output, bitWidth);
      if (bit) seen.add(bit);
    }
  }

  // Texto de líneas inferiores (solo combinaciones, sin mensaje técnico)
  let missingInfoText = "";
  if (Number.isInteger(bitWidth) && bitWidth > 0) {
    const miss = computeMissingBitstrings(seen, bitWidth, { maxList: 64, hardCapN: 12 });

    if (miss.reason === "n_too_large") {
      missingInfoText = `${miss.missingCount} combinations not listed (too many).`;
    } else {
      // Solo lista de combinaciones faltantes
      missingInfoText = miss.listed.join(", ");
      if (miss.skipped && missingInfoText) missingInfoText += ", ...";
    }
  }

  return {
    ok: true,
    okOther,
    otherCounts,
    otherPct,
    expectedOther,
    deviationOther,
    otherLabel: "---------other--------------",
    missingInfoText
  };
}

export function appendStochasticOtherRow(tbody, otherModel) {
  if (!tbody || !otherModel?.ok) return;

  const tr = document.createElement("tr");
  if (!otherModel.okOther) tr.classList.add("table-danger");

  const mk = (txt) => {
    const td = document.createElement("td");
    td.textContent = txt;
    return td;
  };

  const tdOut = document.createElement("td");
  tdOut.textContent = otherModel.missingInfoText
    ? `${otherModel.otherLabel}\n${otherModel.missingInfoText}`
    : otherModel.otherLabel;
  tdOut.style.whiteSpace = "pre-wrap";

  tr.append(
    tdOut,
    mk(`${otherModel.expectedOther.toFixed(2)}%`),
    mk(`${otherModel.otherPct.toFixed(2)}%`),
    mk(String(otherModel.otherCounts)),
    mk(`${otherModel.deviationOther.toFixed(2)}%`),
    mk(otherModel.okOther ? "✓" : "✗")
  );

  tbody.appendChild(tr);
}