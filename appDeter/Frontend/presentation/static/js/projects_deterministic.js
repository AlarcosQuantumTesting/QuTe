/* =======================================
   projects_deterministic.js
   ======================================= */
import { PROJECTS_API, getEffectiveMode } from "./projects.js";
import { selectedProject } from "./state.js";
import { ensureBrackets,addTestCaseField } from "./utils.js";


function safeMountProgress(){
  const root = document.getElementById("testProgressContainer");
  if (typeof window.mountProgress === "function") return window.mountProgress(root);
  if (!root) return { setPercent:()=>{}, finish:()=>{} };
  root.innerHTML = `<div class="progress"><div id="execBlue" class="progress-bar bg-info" style="width:0%"></div></div>`;
  const blue = root.querySelector("#execBlue");
  return {
    setPercent: (p)=>{ if (blue) blue.style.width = Math.max(0, Math.min(100, p)) + "%"; },
    finish: ()=>{ if (blue) blue.style.width = "100%"; }
  };
}


/* ---------- RUN deterministic (SSE) ---------- */
export async function runTestsDeterministicPOST(project){
  const execDiv   = document.getElementById("executionResults");
  const circDiv   = document.getElementById("circuitImages");
  const verdictEl = document.getElementById("testVerdicts");

  const prog = safeMountProgress();
  document.getElementById("stochasticChartContainer")?.classList.add("d-none");

  try {
    const body = {
      mode: "deterministic",
      error_range: 0,
      circuit_file_content:
        project?.circuit_file_content ||
        document.getElementById("circuitSelect")?.value ||
        "",
      test_file_content:
        project?.test_file_content ||
        "",
    };

    if (!body.circuit_file_content.trim()) {
      alert("Missing circuit_file_content (circuit not loaded).");
      return;
    }
    if (!body.test_file_content.trim()) {
      alert("Missing test_file_content (test suite not loaded).");
      return;
    }

    const userEmail =
      project?.user_email ||
      project?.user ||                 
      selectedProject?.user_email ||
      selectedProject?.user ||
      loggedInUser;                     // fallback si lo importas

    if (!userEmail) {
      alert("You must be logged in (missing user email).");
      return;
    }

    const payload = {
      user_email: userEmail,
      mode: "deterministic",
      error_range: 0,
      circuit_file_content: body.circuit_file_content,
      test_file_content: body.test_file_content
    };

    const res = await fetch(`${PROJECTS_API}/${encodeURIComponent(project.name)}/run_tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });



    const data = await res.json().catch(()=>null);

    if (!res.ok || !data?.success){
      const det = data?.detail;
      alert(det || data?.message || `HTTP ${res.status}`);
      prog.finish(0);
      return;
    }

    execDiv?.classList.remove("d-none");

    const logs = Array.isArray(data.logs) ? data.logs : [];
    if (typeof window.renderVerdicts === "function") {
      window.renderVerdicts(logs, "testVerdicts");
    } else if (verdictEl) {
      verdictEl.innerHTML = `<pre>${logs.join("\n\n")}</pre>`;
    }

    // ✅ Render imágenes (igual que stochastic)
    if (circDiv) {
      circDiv.innerHTML = `
        <h4>CUT Circuit</h4>
        ${data.cut_image_base64
          ? `<img src="data:image/png;base64,${data.cut_image_base64}" style="max-width:70%;">`
          : `<p class="text-danger">CUT image missing</p>`}
      `;
    }


    prog.finish(100);

  } catch (err) {
    execDiv?.classList.remove("d-none");
    verdictEl && (verdictEl.innerHTML = `<p class="text-danger">Error: ${err?.message || err}</p>`);
    prog.finish(0);
  }
}



// ===========================
// MODE API: DETERMINISTIC
// ===========================
export const modeUI = {
  applyTestcasePlaceholders(leftTA, rightTA) {
    if (leftTA) leftTA.placeholder = "Qubits input (e.g. [0,0,0])";
    if (rightTA) rightTA.placeholder = "Qubits output (e.g. [0,0])";
  }
};

export const modeCUT = {
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
        const inp = JSON.parse(ensureBrackets(leftRaw));
        const outp = JSON.parse(ensureBrackets(rightRaw));
        if (!Array.isArray(inp) || !Array.isArray(outp)) {
          return { ok: false, error: `Test case #${i + 1}: Inputs/Outputs must be arrays` };
        }
        test_suite.push([inp, outp]);
      } catch (e) {
        return { ok: false, error: `Test case #${i + 1}: ${e.message}` };
      }
    }

    return { ok: true, test_suite };
  },

  readErrorRangeFromUI() {
    return null;
  },

  renderIOTableHTML({ inputsIdx, outputsIdx, testSuite, qubitPrefix = "q", initValues = null }) {
    const mkLabel = (idx) => (idx != null && idx !== "" ? `${qubitPrefix}${idx}` : "");


    const inputCols  = Math.max(inputsIdx.length, 1);
    const outputCols = Math.max(outputsIdx.length, 1);

  
    const inputsHeaderCols = (inputsIdx.length ? inputsIdx : [null])
      .map(i => `<th class="oi-th">${mkLabel(i)}</th>`).join("");

    const outputsHeaderCols = (outputsIdx.length ? outputsIdx : [null])
      .map(i => `<th class="oi-th">${mkLabel(i)}</th>`).join("");

    const theadHtml = `
      <tr>
        <th class="oi-th oi-colnum" rowspan="2">#</th>
        <th class="oi-th" colspan="${inputCols}">inputs</th>
        <th class="oi-th" colspan="${outputCols}">outputs</th>
      </tr>
      <tr>
        ${inputsHeaderCols}
        ${outputsHeaderCols}
      </tr>
    `;

  

    let rowsHtml = (Array.isArray(testSuite) ? testSuite : []).map((pair, r) => {
      const idxHuman = r + 1;
      const inp = Array.isArray(pair?.[0]) ? pair[0] : [];
      const out = Array.isArray(pair?.[1]) ? pair[1] : [];

  
      const inpVals = inputsIdx.map((_, i) => (inp[i] ?? ""));
      const outVals = outputsIdx.map((_, i) => (out[i] ?? ""));

      return `
        <tr id="oi-row-${idxHuman}" data-case="${idxHuman}">
          <td class="oi-td oi-colnum">#${idxHuman}</td>
          ${inpVals.map(v => `<td class="oi-td">${v}</td>`).join("")}
          ${outVals.map(v => `<td class="oi-td">${v}</td>`).join("")}
        </tr>
      `;
    }).join("");



    return `
      <table class="table oi-table mb-0">
        <thead>${theadHtml}</thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  }

};