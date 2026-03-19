/* ======================================
   projects_stochastic.js
   ====================================== */

import { PROJECTS_API, getEffectiveMode} from "./projects.js";
import { ensureBrackets,addTestCaseField} from "./utils.js";
import { selectedProject, loggedInUser, stochasticChartInstance, setChartInstance } from "./state.js";

function safeMountProgress(){
  const root = document.getElementById("testProgressContainer");
  if (typeof window.mountProgress === "function") return window.mountProgress(root);
  if (!root) return { finish:()=>{} };
  root.innerHTML = `<div class="progress"><div class="progress-bar bg-info" style="width:95%"></div></div>`;
  return { finish:()=>{ root.innerHTML = `<div class="progress"><div class="progress-bar bg-success" style="width:100%"></div></div>`; } };
}


/* ---------- RUN stochastic ---------- */

export async function runTestsStochasticPOST(project){
  const execDiv   = document.getElementById("executionResults");
  const circDiv   = document.getElementById("circuitImages");
  const verdictEl = document.getElementById("testVerdicts");
  const prog = safeMountProgress();

  try {
    // 1) errorRange desde UI (igual que ya hacías)
    let eraw =
      document.getElementById("errorRangeExecute")?.value ??
      document.getElementById("errorRangeEdit")?.value ??
      document.getElementById("errorRangeEditCreate")?.value ??
      document.getElementById("errorRangeDisplay")?.value ?? "";
    //cambiar esto, porque esta mal no esta haciendo ni el absoluto ni esta tomando el mnero o igaul 
    let errorRange = parseInt(eraw, 10);
    if (!Number.isInteger(errorRange)) errorRange = 0;
    errorRange = Math.max(0, Math.min(100, errorRange));

    // 2) payload JSON para FastAPI local
    const body = {
      mode: "stochastic",
      error_range: errorRange,
      // circuit: del proyecto o del textarea editor
      circuit_file_content:
        project?.circuit_file_content ||
        document.getElementById("circuitSelect")?.value ||
        "",
      // test suite: lo que ya tienes en memoria
      test_file_content:
        project?.test_file_content ||
        "",
    };

    // (opcional) si quieres, valida rápido
    if (!body.circuit_file_content.trim()) {
      alert("Missing circuit_file_content (circuit not loaded).");
      return;
    }
    if (!body.test_file_content.trim()) {
      alert("Missing test_file_content (test suite not loaded).");
      return;
    }

    // 3) llamada correcta: /projects/run_tests
    const userEmail =
      project?.user_email ||
      project?.user ||                  // por tu tempProject.user = loggedInUser
      selectedProject?.user_email ||
      selectedProject?.user ||
      loggedInUser;                     // fallback si lo importas

    if (!userEmail) {
      alert("You must be logged in (missing user email).");
      return;
    }

    const payload = {
      user_email: userEmail,
      mode: "stochastic",
      error_range: errorRange,
      circuit_file_content: body.circuit_file_content,
      test_file_content: body.test_file_content
    };

    const res = await fetch(`${PROJECTS_API}/${encodeURIComponent(project.name)}/run_tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });



    const { raw, json } = await debugFetch(res, "run_tests");

    if (!res.ok) {
      const msg =
        json?.detail ||
        json?.message ||
        raw ||
        `HTTP ${res.status}`;
      alert(msg);
      return;
    }

const data = json; // aquí ya es seguro
if (!data?.success) {
  alert(data?.detail || data?.message || "Run failed");
  return;
}

    verdictEl && (verdictEl.innerHTML = "");

    const percentages = data?.percentages || [];
    const totalShots  = Number(data?.total_shots ?? data?.shots ?? 0) || null;

    if (circDiv){
      circDiv.innerHTML = `
        <h4>CUT Circuit</h4>
        ${data.cut_image_base64 ? `<img src="data:image/png;base64,${data.cut_image_base64}" style="max-width:70%;">` : `<p class="text-danger">CUT image missing</p>`}
        <!--<h4>QTCC Circuit</h4> -->
        <!-- ${data.qtcc_image_base64 ? `<img src="data:image/png;base64,${data.qtcc_image_base64}" style="max-width:80%;">` : `<p class="text-danger">QTCC image missing</p>`} -->
      `;
    }

    document.getElementById("stochasticChartContainer")?.classList.remove("d-none");

    if (typeof window.renderVerdicts === "function") {
      window.renderVerdicts(percentages, "testVerdicts", {
        totalShots,
        errorRange: (data?.error_range ?? errorRange)   
      });

    } else if (verdictEl) {
      verdictEl.innerHTML = `<pre>${JSON.stringify(percentages, null, 2)}</pre>`;
    }

    if (typeof window.renderStochasticChart === "function") {
      window.renderStochasticChart(percentages, { totalShots });
    }

    execDiv?.classList.remove("d-none");

    const total = percentages.length || 0;
    const passed = percentages.filter(r => r.ok === true).length;
    prog.finish(total ? (passed/total)*100 : 0);

  } catch(err){
    execDiv?.classList.remove("d-none");
    verdictEl && (verdictEl.innerHTML = `<p class="text-danger">Error: ${err?.message || err}</p>`);
  }
}

// ===========================
// MODE API: STOCHASTIC
// ===========================
export const modeUI = {
  applyTestcasePlaceholders(leftTA, rightTA) {
    if (leftTA) leftTA.placeholder = "State (e.g. [0,1])";
    if (rightTA) rightTA.placeholder = "% (e.g. 50)";
  }
};

export const modeCUT = {
  // Devuelve formato [[expectedOutArr, probPercent], ...]
  parseTestSuiteFromContainer({ container, ensureBrackets }) {
    if (!container) return { ok: true, test_suite: [] };

    const rows = container.querySelectorAll(".d-flex");
    const test_suite = [];

    for (let i = 0; i < rows.length; i++) {
      const [taL, taR] = rows[i].getElementsByTagName("textarea");
      const leftRaw = (taL?.value || "").trim();
      const rightRaw = (taR?.value || "").trim();
      if (!leftRaw && !rightRaw) continue;

      try {
        const expected_out = JSON.parse(ensureBrackets(leftRaw));
        const prob = Number(rightRaw);

        if (!Array.isArray(expected_out)) {
          return { ok: false, error: `Test case #${i + 1}: Expected output must be an array` };
        }
        if (!(prob >= 0 && prob <= 100)) {
          return { ok: false, error: `Test case #${i + 1}: Probability must be between 0 and 100` };
        }

        test_suite.push([expected_out, prob]);
      } catch (e) {
        return { ok: false, error: `Test case #${i + 1}: ${e.message}` };
      }
    }

    return { ok: true, test_suite };
  },

  // Stochastic sí usa error_range
  readErrorRangeFromUI() {
    const eraw =
      document.getElementById("errorRangeExecute")?.value ||
      document.getElementById("errorRangeEdit")?.value ||
      document.getElementById("errorRangeEditCreate")?.value ||
      "";

    if (eraw === "") return null;

    const n = parseInt(eraw, 10);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      throw new Error("Error Range must be an integer between 0 and 100.");
    }
    return n;
  },

  renderIOTableHTML({ inputsIdx, outputsIdx, testSuite, qubitPrefix = "q", initValues = null }) {
    const mkLabel = (idx) => (idx != null && idx !== "" ? `${qubitPrefix}${idx}` : "");
    const outputCols = Math.max(outputsIdx.length, 1);
    const hasInputsCols = inputsIdx.length > 0;

    const inputsHeaderCols = hasInputsCols
      ? inputsIdx.map(i => `<th class="oi-th">${mkLabel(i)}</th>`).join("")
      : "";

    const outputsHeaderCols = (outputsIdx.length ? outputsIdx : [null])
      .map(i => `<th class="oi-th">${mkLabel(i)}</th>`).join("");

    const theadHtml = `
      <tr>
        <th class="oi-th oi-colnum" rowspan="2">#</th>
        <!--${hasInputsCols ? `<th class="oi-th" colspan="${inputsIdx.length}">QTCCInputs</th>` : ``}-->
        <th class="oi-th" colspan="${outputCols}">Output</th>
        <th class="oi-th" rowspan="2">% expected</th>
      </tr>
      <tr>
        ${hasInputsCols ? inputsHeaderCols : ``}
        ${outputsHeaderCols}
      </tr>
    `;

    const normInit = Array.isArray(initValues) ? initValues : [];
    const showInit = normInit.length > 0;
    const getInitAt = (i) =>
      (normInit[i] !== undefined && normInit[i] !== null && normInit[i] !== "")
        ? normInit[i]
        : "";

    let totalPercent = 0;

    let rowsHtml = (Array.isArray(testSuite) ? testSuite : []).map((pair, r) => {
      const idxHuman = r + 1;

      const expectedOut = Array.isArray(pair?.[0]) ? pair[0] : [];
      const probPercent = Number(pair?.[1]);
      const percentStr = (!Number.isNaN(probPercent)) ? `${probPercent.toFixed(2)}%` : "—";
      if (!Number.isNaN(probPercent)) totalPercent += probPercent;

      const inputTds = hasInputsCols
        ? inputsIdx.map((_, i) => `<td class="oi-td">${showInit ? getInitAt(i) : ""}</td>`).join("")
        : "";

      const outVals = outputsIdx.map((_, i) => (expectedOut[i] ?? ""));
      const outTds  = outVals.map(v => `<td class="oi-td">${v}</td>`).join("");

      return `
        <tr id="oi-row-${idxHuman}" data-case="${idxHuman}">
          <td class="oi-td oi-colnum">#${idxHuman}</td>
          ${inputTds}
          ${outTds}
          <td class="oi-td">${percentStr}</td>
        </tr>
      `;
    }).join("");

    if (!rowsHtml) {
      const placeholderInputs = inputsIdx.map((_, i) => `<td class="oi-td">${getInitAt(i)}</td>`).join("");
      const placeholderOutputs = "<td class='oi-td'></td>".repeat(outputCols);
      rowsHtml = `
        <tr>
          <td class="oi-td oi-colnum"></td>
          ${placeholderInputs}
          ${placeholderOutputs}
          <td class="oi-td"></td>
        </tr>
        <tr>
          <td class="oi-td oi-colnum"></td>
          ${placeholderInputs}
          ${placeholderOutputs}
          <td class="oi-td"></td>
        </tr>
      `;
    } else {
      const remaining = Math.max(0, 100 - totalPercent);
      const emptyInputs = hasInputsCols
        ? inputsIdx.map(() => `<td class="oi-td oi-other-cell">-</td>`).join("")
        : "";
      const emptyOutputs = "<td class='oi-td oi-other-cell'>-</td>".repeat(outputCols);

      rowsHtml += `
        <tr class="oi-row-other">
          <td class="oi-td oi-colnum oi-other-cell">other</td>
          ${emptyInputs}
          ${emptyOutputs}
          <td class="oi-td oi-other-cell">${remaining.toFixed(2)}%</td>
        </tr>
      `;
    }

    return `
      <table class="table oi-table mb-0">
        <thead>${theadHtml}</thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  }
};

// ------------------------------
// Renderiza un gráfico de barras (Chart.js) para stochastic:
// - dataset observado (% observed) y esperado (% expected)
// - calcula “Other” observado y esperado para cerrar al 100%
// - destruye instancia previa antes de recrear (evita duplicados)
// ------------------------------
export function renderStochasticChart(percentages, opts = {}) {
  const ctx = document.getElementById("stochasticChart")?.getContext("2d");
  if (!ctx) return;

  const totalShots = Number(opts?.totalShots);
  const labels = [];
  const observedValues = [];
  const expectedValues = [];

  let sumCountsListed = 0;
  let sumObservedPercentFromCounts = 0;
  let sumExpectedPercent = 0;   

  percentages.forEach(p => {
    const label = Array.isArray(p.output) ? p.output.join(",") : p.output;

    // observado
    let observedPct;
    if (!Number.isNaN(totalShots) && totalShots > 0 && typeof p.counts === "number") {
      observedPct = (p.counts / totalShots) * 100;
      sumCountsListed += p.counts;
    } else {
      observedPct = Number(p.percent || 0);
    }
    sumObservedPercentFromCounts += observedPct;

    // esperado (si no viene, asumimos 0)
    const expectedPct = (p.expected_percent == null) ? 0 : Number(p.expected_percent);
    if (Number.isFinite(expectedPct)) {
      sumExpectedPercent += expectedPct;
    }

    labels.push(label);
    observedValues.push(observedPct);
    expectedValues.push(expectedPct);
  });

  // --- "Other" observado ---
  let otherPct;
  if (!Number.isNaN(totalShots) && totalShots > 0) {
    const otherCounts = Math.max(0, totalShots - sumCountsListed);
    otherPct = (otherCounts / totalShots) * 100;
  } else {
    otherPct = Math.max(0, Number((100 - sumObservedPercentFromCounts).toFixed(4)));
  }

  // --- "Other" esperado: resto hasta 100% ---
  const expectedOther = Math.max(
    0,
    Number((100 - sumExpectedPercent).toFixed(4))
  );

  labels.push("Other");
  observedValues.push(otherPct);
  expectedValues.push(expectedOther);  

  if (stochasticChartInstance) stochasticChartInstance.destroy();

  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "% observed",
          data: observedValues,
          backgroundColor: "rgba(54, 162, 235, 0.5)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1
        },
        {
          label: "% expected",
          data: expectedValues,
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label(ctx) {
              const v = Number(ctx.parsed.y || 0).toFixed(2);
              return `${ctx.dataset.label}: ${v}%`;
            }
          }
        },
        legend: { display: true }
      },
      scales: {
        x: {
          stacked: false,
          ticks: { autoSkip: false }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: v => v + "%" }
        }
      }
    }
  });
  setChartInstance(chart);
}