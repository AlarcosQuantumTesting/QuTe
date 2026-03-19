
import { selectedProject, currentMode, loggedInUser, projects, setProjects } from "./state.js";
import { PROJECTS_API, getEffectiveMode,getModeAdapter} from "./projects.js"; 
import { ensureBrackets } from "./utils.js";
import { renderStochasticChart } from "./projects_stochastic.js";
import {buildStochasticOtherModel, appendStochasticOtherRow} from "./stochasticOther.js"
// o importa solo PROJECTS_API + getEffectiveMode si lo demás lo accedes por window


// ------------------------------
// Habilita la edición de un textarea por id.
// Caso especial: si el textarea es el del circuito ("circuitSelect"),
// alterna los botones Edit/Save/Cancel para reflejar el modo edición.
// ------------------------------
export function enableEditing(textareaId){
  let ta, isCircuit;
  ta = document.getElementById(textareaId);
  if (!ta) return;
  ta.disabled = false;
  ta.focus();
  isCircuit = (textareaId === "circuitSelect");
  if (isCircuit){
    document.getElementById("editCircuitButton")?.classList.add("d-none");
    document.getElementById("saveCircuitButton")?.classList.remove("d-none");
    document.getElementById("cancelCircuitButton")?.classList.remove("d-none");
  }
}
// ------------------------------
// Cancela la edición del circuito:
// - deshabilita el textarea
// - restaura el estado de botones (muestra Edit, oculta Save/Cancel)
// No restaura el contenido; solo revierte el UI del modo edición.
// ------------------------------
export function cancelCircuitEditing(){
  let ta;
  ta = document.getElementById("circuitSelect");
  if (ta) ta.disabled = true;
  document.getElementById("saveCircuitButton")?.classList.add("d-none");
  document.getElementById("cancelCircuitButton")?.classList.add("d-none");
  document.getElementById("editCircuitButton")?.classList.remove("d-none");
}

// ------------------------------
// Persiste cambios del código de circuito a backend (FastAPI) mediante PUT.
// - valida que exista proyecto seleccionado
// - evita guardar si no hay cambios
// - pide confirmación (porque puede romper el código)
// - envía SESSION_TOKEN con credentials: "include"
// - en éxito: actualiza el estado local (selectedProject) y repinta librería
// ------------------------------
export async function saveCircuitChanges(){
  let ta, updated, projectName;
  let resp, raw, data;
  let ok;

  ta = document.getElementById("circuitSelect");
  if (!ta || !selectedProject) return alert("Please select a project before saving changes.");

  updated = ta.value ?? "";
  if ((selectedProject.circuit_file_content || "") === updated){
    alert("No changes have been made.");
    return;
  }
  ok = confirm("Are you sure? Changes can break the code.");
  if (!ok) return;

  projectName = selectedProject.name;

  try {
      resp = await fetch(
      `${PROJECTS_API}/${encodeURIComponent(projectName)}/circuit`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updated_content: updated,
          user_email: loggedInUser || selectedProject?.user_email || selectedProject?.user
        }),

        credentials: "include"
      }
    );


    raw = await resp.text();
    data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    if (!resp.ok || !data?.success) {
      const msg = (data?.detail?.message || data?.detail || data?.message || raw || `HTTP ${resp.status}`);
      alert("Error guardando circuito: " + msg);
      return;
    }

    selectedProject.circuit_file_content = updated;

    if (typeof window.cancelCircuitEditing === "function") window.cancelCircuitEditing();
    if (typeof window.renderProjectLibrary === "function") window.renderProjectLibrary();

    alert("Circuit code saved.");
  } catch (err) {
    console.error(err);
    alert("Network error saving circuit: " + (err?.message || err));
  }
}

// ------------------------------
// Muestra el formulario de edición de CUT config.
// - oculta el contenedor “readonly” y muestra el form
// - carga la config actual desde servidor (si existe loadCutConfig)
// - detecta el modo efectivo (stochastic/deterministic)
// - ajusta el label de test cases según modo
// - en stochastic muestra/precarga error_range; en deterministic lo oculta
// ------------------------------
export function showEditCutForm(){
  if (!selectedProject) return alert("Select a project.");

  document.getElementById("cutConfigContainer")?.classList.add("d-none");
  document.getElementById("cutConfigForm")?.classList.remove("d-none");

  if (window.loadCutConfig) window.loadCutConfig(selectedProject.name);

  const erow = document.getElementById("errorRangeEditRow");
  const einf = document.getElementById("errorRangeEdit");
  const mode = window.getEffectiveMode
    ? window.getEffectiveMode()
    : String(
        currentMode ||
        selectedProject?.mode ||
        document.getElementById("modeSelect")?.value ||
        "deterministic"
      ).toLowerCase();

  // 🔹 Cambiar el texto del label según el modo
  const tcLabel = document.getElementById("testCasesLabel");
  if (tcLabel) {
    tcLabel.textContent = (mode === "stochastic")
      ? "Distribution of probabilities"
      : "Test Cases";
  }

  if (mode === "stochastic") {
    erow?.classList.remove("d-none");
    if (einf) einf.value = (selectedProject.error_range ?? "");
  } else {
    erow?.classList.add("d-none");
    if (einf) einf.value = "";
  }
}

// ------------------------------
// Lee la CUT config desde el UI, la valida y la guarda en backend.
// Flujo:
// 1) valida proyecto seleccionado
// 2) determina modo efectivo y obtiene adapter por modo (parseo/validación específica)
// 3) parsea inputs/outputs/shots/init_values desde inputs del DOM
// 4) parsea test_suite desde el contenedor (delegado al adapter)
// 5) lee error_range si aplica (stochastic)
// 6) serializa JSON y lo manda a PUT /test_config con cookie SESSION_TOKEN
// 7) en éxito: actualiza selectedProject y projects[], repinta tablas y UI
// ------------------------------
export async function saveTestConfigToDB() {
  if (!selectedProject) {
    alert("Select a project first.");
    return;
  }

  const projectName = selectedProject.name;
  const mode = String(selectedProject?.mode || getEffectiveMode() || "deterministic").toLowerCase();
  const { cut } = getModeAdapter(mode);

  const inStr =
    document.getElementById("cutInputs")?.value ||
    document.getElementById("cutInputsCreate")?.value ||
    "";

  const outStr =
    document.getElementById("cutOutputs")?.value ||
    document.getElementById("cutOutputsCreate")?.value ||
    "";

  const shots =
    parseInt(
      document.getElementById("cutShots")?.value ||
      document.getElementById("cutShotsCreate")?.value,
      10
    ) || 1024;

  const input_indexes = inStr
    .split(",")
    .map(x => parseInt(x.trim(), 10))
    .filter(Number.isInteger);

  const output_indexes = outStr
    .split(",")
    .map(x => parseInt(x.trim(), 10))
    .filter(Number.isInteger);

  const initValsStr =
    document.getElementById("cutInitValsEdit")?.value ||
    document.getElementById("cutInitValsCreate")?.value ||
    "";

  const input_init_values = initValsStr
    ? initValsStr.split(",").map(v => v.trim().toLowerCase())
    : [];

  if (input_init_values.length && input_init_values.length !== input_indexes.length) {
    alert("Initial values length must match Input Indexes length.");
    return;
  }

  // ✅ Parse test suite delegando por modo
  const container =
    document.getElementById("testCasesContainer") ||
    document.getElementById("testCasesContainerCreate");

  const parsed = cut.parseTestSuiteFromContainer({
    container,
    ensureBrackets
  });

  if (!parsed.ok) {
    alert(parsed.error);
    return;
  }
  const test_suite = parsed.test_suite;

  let error_range = null;
  try {
    error_range = cut.readErrorRangeFromUI?.() ?? null;
  } catch (e) {
    alert(e.message);
    return;
  }

  const jsonPayload = {
    input_indexes,
    output_indexes,
    test_suite,
    shots
  };

  if (input_init_values.length) {
    jsonPayload.input_init_values = input_init_values;
  }

  const body = {
    updated_content: JSON.stringify(jsonPayload, null, 2),
    user_email: loggedInUser || selectedProject?.user_email || selectedProject?.user,
    mode, // "deterministic" | "stochastic"
    ...(error_range !== null ? { error_range } : {})
  };



  try {
    const resp = await fetch(
      `${PROJECTS_API}/${encodeURIComponent(projectName)}/test_config`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include" // <-- CRÍTICO para que viaje SESSION_TOKEN

      }
    );

    const raw = await resp.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}
    console.group("[saveTestConfigToDB] payload");
    console.log("projectName =", projectName);
    console.log("mode =", mode);
    console.log("user_email =", body.user_email);
    console.log("endpoint =", `${PROJECTS_API}/${encodeURIComponent(projectName)}/test_config`);
    console.log("body =", body);
    if (!resp.ok || !data?.success) {
      alert(data?.detail || data?.message || raw || `HTTP ${resp.status}`);
      return;
    }

    selectedProject.test_file_content = body.updated_content;
    if (error_range !== null) selectedProject.error_range = error_range;

    // ✅ Mantén coherente projects[] (muchas pantallas repintan desde ahí)
    try {
      const idx = (projects || []).findIndex(p => p.name === selectedProject.name);
      if (idx >= 0) {
        projects[idx].test_file_content = body.updated_content;
        if (error_range !== null) projects[idx].error_range = error_range;
        projects[idx].mode = mode;
      }
    } catch {}

    console.group("[saveTestConfigToDB] response");
    console.log("HTTP status =", resp.status, "ok =", resp.ok);
    console.log("raw =", raw);
    console.log("data =", data);
    console.groupEnd();
      // 1) repinta tabla del editor
    window.renderIOTableFromStrings?.(
      input_indexes.join(","),
      output_indexes.join(","),
      test_suite,
      "oiMapTable",
      "q",
      mode,
      input_init_values
    );

    // 2) repinta tabla de ejecución (si existe en el DOM)
    window.renderIOTableFromStrings?.(
      input_indexes.join(","),
      output_indexes.join(","),
      test_suite,
      "oiMapTableExecute",
      "q",
      mode,
      input_init_values
    );

    
    alert("CUT configuration saved.");
    const setAll = (ids, value) => {
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) el.value = value;
      }
    };

    setAll(["cutInputsDisplay", "cutInputs", "cutInputsCreate", "cutInputsExecute"], input_indexes.join(","));
    setAll(["cutOutputsDisplay", "cutOutputs", "cutOutputsCreate", "cutOutputsExecute"], output_indexes.join(","));
    setAll(["cutShotsDisplay", "cutShots", "cutShotsCreate", "cutShotsExecute"], String(shots));
    setAll(["cutInitValsCreate","cutInitValsEdit"], (input_init_values || []).join(","));

    if (mode === "stochastic") {
      setAll(["errorRangeDisplay","errorRangeEdit","errorRangeEditCreate","errorRangeExecute"], String(error_range ?? ""));
    }
    
    if (typeof window.cancelEditCutForm === "function") window.cancelEditCutForm();

  } catch (err) {
    console.error(err);
    alert("Network error while saving CUT configuration.");
  }
 

}

export function cancelEditCutForm(){
  document.getElementById("cutConfigForm")?.classList.add("d-none");
  document.getElementById("cutConfigContainer")?.classList.remove("d-none");
}

// ------------------------------
// Renderiza la tabla de resultados/veredictos en un contenedor.
// Soporta 2 formatos:
// - Deterministic: logs tipo "Input: ... Expected: ... Verdict: True/False"
// - Stochastic: objetos con output/expected_percent/counts/percent
// Además añade un banner global (verde/rojo) según pasen o fallen.
// ------------------------------
export function renderVerdicts(data, containerId = "testVerdicts", opts = {}) {
  const cont = document.getElementById(containerId);
  if (!cont) return;

  cont.innerHTML = "";

  if (!Array.isArray(data) || data.length === 0) {
    cont.textContent = "No hay resultados para mostrar.";
    return;
  }

  const isObjArray = typeof data[0] === "object" && data[0] !== null && !Array.isArray(data[0]);
  const isStochastic =
    isObjArray &&
    (("output" in data[0]) || ("expected_percent" in data[0]) || ("counts" in data[0]) || ("percent" in data[0]));

  // wrapper + tabla
  const wrapper = document.createElement("div");
  wrapper.className = "table-responsive";

  const table = document.createElement("table");
  table.className = "table table-striped table-bordered table-hover";

  const thead = document.createElement("thead");
  thead.className = "table-light";
  const headerRow = document.createElement("tr");

  const headers = isStochastic
    ? ["Output", "% expected", "Observed", "Counts", "Deviation", "Hit"]
    : ["#", "Input", "Expected", "Verdict"];

  headers.forEach(t => {
    const th = document.createElement("th");
    th.textContent = t;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  // Banner
  const banner = document.createElement("div");
  banner.style.fontSize = "1.1rem";
  banner.style.fontWeight = "700";
  banner.style.padding = "12px 16px";
  banner.style.borderRadius = "12px";
  banner.style.margin = "10px 0 14px";
  banner.style.textAlign = "center";

  const setBanner = (allOk) => {
    banner.className = allOk ? "alert alert-success" : "alert alert-danger";
    banner.textContent = allOk ? "All tests passed ✓" : "Some tests failed ✗";
  };

  let overallOk = true;

  if (isStochastic) {
    // considero todos estos porque tanto al cambiar el edit, crear, crear y tal se guardan de manera distinta y entonces si editar no coje la misma variable
    //pero si ponia la misma se solapaban
    let eraw =
      (Number.isFinite(opts?.errorRange) ? String(opts.errorRange) : null) ??
      document.getElementById("errorRangeExecute")?.value ??     // ✅ CLAVE
      document.getElementById("errorRangeEdit")?.value ??
      document.getElementById("errorRangeEditCreate")?.value ??
      document.getElementById("errorRangeDisplay")?.value ??
      "";

    eraw = String(eraw ?? "").trim().replace(",", ".");
    let err = Number(eraw);
    if (!Number.isFinite(err)) err = 0;
    err = Math.max(0, Math.min(100, err));
    console.log("[renderVerdicts] errorRange used =", err, "raw=", eraw);


    const totalShotsOpt = Number(opts?.totalShots);
    const SHOTS = (Number.isFinite(totalShotsOpt) && totalShotsOpt > 0) ? totalShotsOpt : null;

    let sumCountsListed = 0;
    let sumExpectedPercent = 0;

    data.forEach((row) => {
      const out = row.output;
      const exp = (row.expected_percent == null) ? null : Number(row.expected_percent);
      const counts = (typeof row.counts === "number") ? row.counts : null;

      if (exp !== null && Number.isFinite(exp)) sumExpectedPercent += exp;

      const observedPct =
        (SHOTS && counts != null) ? (counts / SHOTS) * 100 : Number(row.percent || 0);

      if (SHOTS && counts != null) sumCountsListed += counts;

      let okCalc = null;
      let deviation = null;

      if (exp !== null && Number.isFinite(exp)) {
        deviation = Math.abs(observedPct - exp);

        const lo = Math.max(0, exp - err);
        const hi = Math.min(100, exp + err);

        okCalc = (observedPct >= lo && observedPct <= hi);

        if (!okCalc) overallOk = false;
      }


      const tr = document.createElement("tr");
      if (okCalc === false) tr.classList.add("table-danger");

      const tdOut = document.createElement("td");
      tdOut.textContent = Array.isArray(out) ? out.join(",") : String(out ?? "");

      const tdExp = document.createElement("td");
      tdExp.textContent = (exp === null) ? "—" : `${exp.toFixed(2)}%`;

      const tdObs = document.createElement("td");
      tdObs.textContent = `${observedPct.toFixed(2)}%`;

      const tdCounts = document.createElement("td");
      tdCounts.textContent = (counts != null) ? String(counts) : "—";

      const tdDev = document.createElement("td");
      tdDev.textContent = (deviation === null) ? "—" : `${deviation.toFixed(2)}%`;

      const tdHit = document.createElement("td");
      tdHit.textContent = okCalc === true ? "✓" : okCalc === false ? "✗" : "—";

      tr.append(tdOut, tdExp, tdObs, tdCounts, tdDev, tdHit);
      tbody.appendChild(tr);
    });

    // "Other"
    
    // al final del if (isStochastic) { ... } justo después del data.forEach(...)ç
    if (SHOTS) {
      const otherModel = buildStochasticOtherModel({
        data,
        shots: SHOTS,
        sumCountsListed,
        sumExpectedPercent,
        errorRange: err,   
        opts,
        selectedProject
      });

      appendStochasticOtherRow(tbody, otherModel);

      if (otherModel.ok && !otherModel.okOther) overallOk = false;
    }




    } else {
      data.forEach((rawLog, i) => {
        const s = String(rawLog ?? "");
        let inp = "", exp = "", verdict = "";

        if (s.includes("→")) {
          const parts = s.split("→").map(x => x.trim());
          inp     = (parts[0] || "").replace(/^Input:\s*/i, "");
          exp     = (parts[1] || "").replace(/^Expected(?: Result)?:\s*/i, "");
          verdict = (parts[2] || "").replace(/^Verdict:\s*/i, "");
        } else {
          inp     = (s.match(/Input:\s*([^\n\r]+)/i)?.[1] ?? "").trim();
          exp     = (s.match(/Expected(?: Result)?:\s*([^\n\r]+)/i)?.[1] ?? "").trim();
          verdict = (s.match(/Verdict:\s*(True|False)/i)?.[1] ?? "").trim();
          if (!inp && !exp && !verdict) inp = s.trim();
        }

        const ok = (verdict === "True");
        if (verdict && !ok) overallOk = false;

        const tr = document.createElement("tr");
        if (verdict && !ok) tr.classList.add("table-danger");

        const tdN = document.createElement("td"); tdN.textContent = `#${i+1}`;
        const tdI = document.createElement("td"); tdI.textContent = inp || "—";
        const tdE = document.createElement("td"); tdE.textContent = exp || "—";
        const tdV = document.createElement("td"); tdV.textContent = verdict || "—";

        tr.append(tdN, tdI, tdE, tdV);
        tbody.appendChild(tr);
      });
    }

    setBanner(overallOk);
    cont.appendChild(banner);

    table.appendChild(tbody);
    wrapper.appendChild(table);
    cont.appendChild(wrapper);
}


// ------------------------------
// Monta una barra de progreso en un contenedor rootEl.
// - arranca automáticamente un “fake progress” azul hasta 95% (sensación de trabajo)
// - permite setPercent(p) para actualizar manualmente
// - finish(passPct) reemplaza la barra por una franja final verde/roja
//   según % de tests OK.
// Devuelve { setPercent, finish } para integrarlo en flujos async.
// ------------------------------

function mountProgress(rootEl){
  if (!rootEl) return { finish: () => {} };
  rootEl.innerHTML = `<div class="progress">
    <div id="execBlue" class="progress-bar bg-info" style="width:0%"></div>
  </div>`;
  const blue = rootEl.querySelector("#execBlue");
  let timer = null;

  
  function start(stepPct = 3, stepMs = 120){
    stop(); // por si acaso
    timer = setInterval(() => {
      if (!blue) return stop();
      const cur = parseFloat(blue.style.width || "0");
      const next = Math.min(cur + stepPct, 95);
      blue.style.width = next + "%";
      if (next >= 95) stop();
    }, stepMs);
  }

  function setPercent(p){
    if (!blue) return;
    blue.style.width = Math.max(0, Math.min(100, p)) + "%";
  }

  function stop(){
    if (timer) { clearInterval(timer); timer = null; }
  }

  // Cuando terminan los tests: sustituimos por franja verde/roja
  function finish(passPct){
    stop();
    const ok = Math.max(0, Math.min(100, Number(passPct) || 0));
    const allOk = (ok === 100);

    const colorClass = allOk ? "bg-success" : "bg-danger";
    const title = `${ok.toFixed(1)}% ok`;

    rootEl.innerHTML = `
      <div class="progress">
        <div class="progress-bar ${colorClass}" 
             style="width:100%" 
             title="${title}">
        </div>
      </div>
    `;
  }
  // arrancamos de inmediato el relleno azul
  start();
  return { setPercent, finish };
}

//para que repinte bien 
window.refreshExecuteFromServer = async function () {
  if (!selectedProject?.name) return;
  await loadCutConfig(selectedProject.name); // esto ya pinta oiMapTableExecute si existe
};

// ------------------------------
// Exporta funciones a window para poder llamarlas desde HTML inline,
// otros módulos legacy o handlers no modularizados.
// ------------------------------
window.enableEditing = enableEditing;
window.cancelCircuitEditing = cancelCircuitEditing;
window.saveCircuitChanges = saveCircuitChanges;
window.showEditCutForm = showEditCutForm;
window.cancelEditCutForm = cancelEditCutForm;
window.renderVerdicts = renderVerdicts;
window.renderStochasticChart = renderStochasticChart; // si lo usas desde otros módulos
window.mountProgress = mountProgress;                 // para que safeMountProgress lo encuentre
window.saveTestConfigToDB = saveTestConfigToDB;
