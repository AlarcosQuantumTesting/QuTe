/* ===========================
   projects.js  (COMÚN)
   =========================== */
import "./execute.js";
import {
  loggedInUser,
  projects,
  itemsPerPage,
  currentPage,
  setProjects,
  setCurrentPage,
  setSelectedProject,
  setCurrentMode,
  selectedProject
} from "./state.js";

import { ensureBrackets, base64EncodeUnicode, base64DecodeUnicode, openSidePanelText } from "./utils.js";

import {
  runTestsDeterministicPOST,
  modeUI as deterministicUI,
  modeCUT as deterministicCUT
} from "./projects_deterministic.js";

import {
  runTestsStochasticPOST,
  modeUI as stochasticUI,
  modeCUT as stochasticCUT
} from "./projects_stochastic.js";


export const API_BASE = "http://127.0.0.1:8000";
export const PROJECTS_API = `${API_BASE}/projects`;

const ALLOWED_INIT = ["", "0","1","h","y","z","s","t"]; // "" = sin valor
/* ---------------------------
   Convierte tokens init -> entryIndexes (índices en ALLOWED_INIT)
   Normaliza longitud si se pasa nQubits
   --------------------------- */

export function initTokensToEntryIndexes(tokens, nQubits = null) {
  let arr = Array.isArray(tokens) ? tokens.map(v => String(v ?? "").toLowerCase().trim()) : [];
  if (typeof nQubits === "number") {
    // ajusta longitud exacta: rellena con "" o recorta
    if (arr.length < nQubits) arr = arr.concat(new Array(nQubits - arr.length).fill(""));
    if (arr.length > nQubits) arr = arr.slice(0, nQubits);
  }

  const idxs = arr.map((tok, i) => {
    const idx = ALLOWED_INIT.indexOf(tok);
    if (idx === -1) throw new Error(`Init token inválido "${tok}" en posición ${i}`);
    return idx;
  });

  return idxs;
}
/* ---------------------------
   Convierte entryIndexes -> tokens init /saurom
   Valida rango (0..ALLOWED_INIT.length-1)
   --------------------------- */
export function entryIndexesToInitTokens(entryIdxs) {
  const arr = Array.isArray(entryIdxs) ? entryIdxs : [];
  return arr.map((n, i) => {
    const idx = parseInt(n, 10);
    if (!Number.isInteger(idx) || idx < 0 || idx >= ALLOWED_INIT.length) {
      throw new Error(`entryIndex inválido "${n}" en posición ${i}`);
    }
    return ALLOWED_INIT[idx];
  });
}

/* ---------- Navegación / Estado ---------- */

export function goToCreateProject(){
  document.querySelector("#cutEditorSection")?.classList.add("d-none");
  document.querySelector("#createProjectSection")?.classList.remove("d-none");
  hardResetCreateProjectSection();
}

/* ---------------------------
   Reset “duro” del formulario de creación:
   limpia campos, oculta errorRange, borra testcases/tabla y resetea modo
   --------------------------- */
function hardResetCreateProjectSection(){
  if (typeof window.resetCreateProjectForm === "function") window.resetCreateProjectForm();

  [
    "cutInputsCreate",
    "cutOutputsCreate",
    "cutShotsCreate",
    "cutInitValsCreate",
    "errorRangeEditCreate"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const erowCreate = document.getElementById("errorRangeEditRowCreate");
  erowCreate?.classList.add("d-none");

  const tcCreate = document.getElementById("testCasesContainerCreate");
  if (tcCreate) tcCreate.innerHTML = "";

  const oiTable = document.getElementById("oiMapTable");
  if (oiTable) oiTable.innerHTML = "";

  const initValsPerQubit = document.getElementById("cutInitValsPerQubit");
  if (initValsPerQubit) initValsPerQubit.innerHTML = "";

  setSelectedProject(null);
  setCurrentMode("deterministic");
}

/** Prioriza SIEMPRE el modo del proyecto seleccionado */
export function getEffectiveMode() {
  return String(
    (selectedProject?.mode) ||
    document.getElementById("modeSelect")?.value ||
    "deterministic"
  ).toLowerCase();
}

/* ---------------------------
   Adapter por modo:
   devuelve handlers UI/CUT específicos (deterministic vs stochastic)
   --------------------------- */
export function getModeAdapter(mode = getEffectiveMode()) {
  const m = String(mode).toLowerCase();
  if (m === "stochastic") return { ui: stochasticUI, cut: stochasticCUT };
  return { ui: deterministicUI, cut: deterministicCUT };
}

/* ---------- CRUD Proyecto ---------- */

export function createProject(){
  const nombre      = document.getElementById("nombre_proyecto")?.value?.trim();
  const colaborador = document.getElementById("cooperador_proyecto-createProject")?.value?.trim();
  const descripcion = document.getElementById("descripcion")?.value?.trim();
  const mode = (document.getElementById("modeSelect")?.value || "deterministic").toLowerCase();
  const circuitFile = document.getElementById("circuitFile-createProject")?.files?.[0];

  if (!nombre || !descripcion){
    alert("Project name and description are required.");
    return;
  }
  if (!loggedInUser){
    alert("You must be logged in.");
    return;
  }
  if (!circuitFile){
    alert("Please upload a circuit file (.py or .txt).");
    return;
  }
  const tempProject = {
    id: nombre,          
    name: nombre,
    user: loggedInUser,
    collaborator: colaborador || "",
    description: descripcion,
    mode
  };
  window.__pendingCreateProject = { tempProject, circuitFile };

  setSelectedProject(tempProject);
  setCurrentMode(mode);
  goToTestSuite(tempProject);
}

function goToTestSuite(project){
  document.querySelector("#createProjectSection")?.classList.add("d-none");
  document.querySelector("#cutEditorSection")?.classList.remove("d-none");

  setSelectedProject(project);
  setCurrentMode(project.mode || "deterministic");

  const modeSel = document.getElementById("modeSelect");
  if (modeSel) modeSel.value = String(project.mode || "deterministic").toLowerCase();

  const erow = document.getElementById("errorRangeEditRowCreate");
  if (String(project.mode || "").toLowerCase() === "stochastic") erow?.classList.remove("d-none");
  else erow?.classList.add("d-none");

  const isPending = !!window.__pendingCreateProject;
  if (!isPending && typeof window.loadCutConfig === "function") {
    window.loadCutConfig(project.name);
  }

  if (typeof window.afterProjectLoadedOrConfigLoaded === "function") {
    window.afterProjectLoadedOrConfigLoaded();
  }

  try { window.location.hash = "#test-suite"; } catch {}
  renderInitValueInputs();
}
//La creacion de la libreria
export function renderProjectLibrary(){
  const projectLibrary = document.getElementById("projectLibrary");
  if (!projectLibrary) return;

  if (!loggedInUser) {
    projectLibrary.innerHTML = "<p>You must be logged in to load projects.</p>";
    return;
  }

  projectLibrary.innerHTML = "";

  fetch(`${PROJECTS_API}/?user_email=${encodeURIComponent(loggedInUser)}`, {
    method: "GET",
    credentials: "include"
  })
    .then(async (r) => {
      const rawText = await r.text();
      let data = null;
      try { data = rawText ? JSON.parse(rawText) : null; } catch {}

      if (!r.ok) {
        const msg =
          (typeof data?.detail === "string") ? data.detail :
          data?.detail ? JSON.stringify(data.detail, null, 2) :
          rawText || `HTTP ${r.status}`;
        throw new Error(msg);
      }

      const projectsArr = Array.isArray(data)
        ? data
        : (Array.isArray(data?.projects) ? data.projects : []);

      if (Array.isArray(data?.bad) && data.bad.length) {
        console.warn("[renderProjectLibrary] some projects were skipped/bad:", data.bad);
      }

      return projectsArr;
    })
    .then((projectsArr) => {
      if (!projectsArr.length) {
        setProjects([]);
        projectLibrary.innerHTML = "<p>No projects found</p>";
        renderPaginationControls(); // opcional
        return;
      }

      setProjects(projectsArr);
      displayProjectsForPage(currentPage);
    })
    .catch(err => {
      console.error("Error loading projects:", err);
      projectLibrary.innerHTML = `<p>Error loading projects: ${String(err.message || err)}</p>`;
    });
}

//Como moverse por la libreria
export function displayProjectsForPage(page){
  const projectLibrary = document.getElementById("projectLibrary");
  const tpl = document.getElementById("projectCardTemplate");
  if (!projectLibrary || !tpl) return;

  const start = (page - 1) * itemsPerPage;
  const end   = start + itemsPerPage;
  const slice = (projects || []).slice(start, end);

  projectLibrary.innerHTML = "";

  slice.forEach(p => {
    const node = tpl.content.cloneNode(true);

    node.querySelector('[data-field="name"]').textContent = p.name || "";
    node.querySelector('[data-field="user"]').textContent = `User: ${p.user_email || ""}`;
    node.querySelector('[data-field="cooperator"]').textContent = `Cooperator: ${p.collaborator || "no collaborator"}`;
    node.querySelector('[data-field="description"]').textContent = `Description: ${p.description || ""}`;

    node.querySelector('[data-action="delete"]').addEventListener("click", () => {
      window.deleteProject(p.name);
    });

    node.querySelector('[data-action="circuit"]').addEventListener("click", async () => {
      await viewCutCodeByProject(p.name);
    });

    node.querySelector('[data-action="test"]').addEventListener("click", async () => {
      await viewTestingCodeByProject(p.name);
    });

    node.querySelector('[data-action="notes"]').addEventListener("click", () => {
      viewNotesByProject(p.name);
    });

    projectLibrary.appendChild(node);
  });

  renderPaginationControls();
}
//Ver proyectos de la libreria 
async function viewCutCodeByProject(projectName){
  const url = `${PROJECTS_API}/${encodeURIComponent(projectName)}/cut_config?user_email=${encodeURIComponent(loggedInUser)}`;
  const r = await fetch(url, { credentials:"include" });
  const raw = await r.text();

  if (!r.ok) return openSidePanelText(raw || `HTTP ${r.status}`);

  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}

  const code = data?.project?.circuit_file_content || "";
  openSidePanelText(code || "(vacío)");
}

async function viewTestingCodeByProject(projectName){
  const url = `${PROJECTS_API}/${encodeURIComponent(projectName)}/cut_config?user_email=${encodeURIComponent(loggedInUser)}`;
  const r = await fetch(url, { credentials:"include" });
  const raw = await r.text();

  if (!r.ok) return openSidePanelText(raw || `HTTP ${r.status}`);

  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}

  const cfg = data?.cut_config ?? {};
  const text = (typeof cfg === "string") ? cfg : JSON.stringify(cfg, null, 2);
  openSidePanelText(text || "(vacío)", "Testing Config");
}


async function viewNotesByProject(projectName){
  const email = loggedInUser; // viene de state.js

  if (!projectName) return openSidePanelText("Missing projectName");
  if (!email) return openSidePanelText("Missing loggedInUser (email)");

  const base = API_BASE || "http://127.0.0.1:8000";
  const url = `${base}/notes/?projectId=${encodeURIComponent(projectName)}&email=${encodeURIComponent(email)}`;

  const r = await fetch(url, { credentials: "include" });
  const raw = await r.text();

  if (!r.ok) {
    return openSidePanelText(raw || `HTTP ${r.status}`, "Notes (error)");
  }

  let notes = [];
  try { notes = raw ? JSON.parse(raw) : []; } catch { notes = []; }

  // formateo bonito tipo “preview”
  if (!Array.isArray(notes) || !notes.length) {
    return openSidePanelText("(no notes yet)", `Notes · ${projectName}`);
  }

  const text = notes.map((n, i) => {
    const title = n?.title || "(untitled)";
    const type  = n?.type || "general";
    const ts    = n?.timestamp ? new Date(n.timestamp).toLocaleString() : "";
    const body  = (n?.text || "").trim();

    return [
      `#${i+1}  ${title}`,
      `type: ${type}${ts ? " · " + ts : ""}`,
      body ? body : "(empty)",
      ""
    ].join("\n");
  }).join("\n");

  openSidePanelText(text, `Notes · ${projectName}`);
}

export function renderPaginationControls(){
  let paginationDiv = document.getElementById("pagination-controls");
  const totalPages = Math.ceil((projects || []).length / itemsPerPage) || 1;

  if (!paginationDiv){
    const libroDiv = document.getElementById("libro");
    paginationDiv = document.createElement("div");
    paginationDiv.id = "pagination-controls";
    paginationDiv.className = "d-flex justify-content-center mt-3";
    if (!libroDiv){ console.error("El contenedor 'libro' no existe en el DOM."); return; }
    libroDiv.appendChild(paginationDiv);
  } else {
    paginationDiv.innerHTML = "";
  }

  for (let i = 1; i <= totalPages; i++){
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = "btn btn-secondary mx-1";
    if (i === currentPage) btn.classList.add("active");

    btn.addEventListener("click", () => {
      setCurrentPage(i);
      displayProjectsForPage(i);
    });

    paginationDiv.appendChild(btn);
  }
}
  /* ---------------------------
   Renderiza la tabla del proyecto IO (inputs/outputs + test suite) desde strings CSV.
   Delegado al adapter del modo para que el HTML sea consistente.
   --------------------------- */
export function renderIOTableFromStrings(inputsStr,outputsStr,testSuite = [],mountId = "oiMapTable",qubitPrefix = "q",mode = "deterministic",initValues = null) {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const toIntList = (s) => (s || "")
      .split(",")
      .map(x => parseInt(String(x).trim(), 10))
      .filter(n => Number.isInteger(n));

    const inputsIdx  = toIntList(inputsStr);
    const outputsIdx = toIntList(outputsStr);

    const { cut } = getModeAdapter(mode);

    mount.innerHTML = cut.renderIOTableHTML({
      inputsIdx,
      outputsIdx,
      testSuite,
      qubitPrefix,
      initValues
    });

    wireCaseRowSync();
  }
/* ---------------------------
   Sincroniza badges (#1, #2...) con filas de la tabla:
   al click, hace scroll y resalta la row correspondiente.
   --------------------------- */
function wireCaseRowSync() {
  const flash = (el) => {
    if (!el) return;
    el.classList.add("oi-hl");
    setTimeout(() => el.classList.remove("oi-hl"), 900);
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const badges = document.querySelectorAll("#cutTestCasesDisplay .badge");
  badges.forEach(b => {
    const n = parseInt(String(b.textContent || "").replace("#","").trim(), 10);
    if (!Number.isNaN(n)) {
      b.style.cursor = "pointer";
      b.onclick = () => flash(document.getElementById(`oi-row-${n}`));
    }
  });
}

/* ---------------------------
   Rellena el <select> de proyectos desde backend.
   También sincroniza projects[] del estado.
   --------------------------- */

export async function populateProjectSelect(){
  const projectSelect = document.getElementById("projectSelect");
  if (!projectSelect) return;

  projectSelect.innerHTML = '<option value="" selected>Elige un proyecto</option>';

  try {
    const r = await fetch(`${PROJECTS_API}/?user_email=${encodeURIComponent(loggedInUser)}`, {
      method: "GET",
      credentials: "include"
    });

    const raw = await r.json().catch(() => null);

    const projectsArr = Array.isArray(raw)
      ? raw
      : (Array.isArray(raw?.projects) ? raw.projects : []);

    if (!projectsArr.length) {
      console.warn("No projects found or unexpected response:", raw);
      setProjects([]);
      alert("No hay proyectos disponibles para este usuario.");
      return;
    }

    if (Array.isArray(raw?.bad) && raw.bad.length) {
      console.warn("Some projects were skipped/bad:", raw.bad);
    }

    setProjects(projectsArr);

    projectsArr.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.name;
      opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });

  } catch (err) {
    console.error("Error fetching projects:", err);
    alert("Error fetching projects.");
  }
}

export async function loadCircuitIntoEditor(projectName){
  const res = await fetch(
    `${PROJECTS_API}/${encodeURIComponent(projectName)}/cut_config?user_email=${encodeURIComponent(loggedInUser)}`,
    { credentials: "include" }
  );

  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch {}

  if (!res.ok) {
    const msg =
      (typeof data?.detail === "string") ? data.detail :
      data?.detail ? JSON.stringify(data.detail, null, 2) :
      raw || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const code = data?.project?.circuit_file_content || "";
  const ta = document.getElementById("circuitSelect");
  if (ta) ta.value = code;

  if (selectedProject) selectedProject.circuit_file_content = code;

  return code;
}


export async function selectProject(){
  const name = document.getElementById("projectSelect")?.value;
  if (!name) return;

  const proj = (projects || []).find(p => p.name === name);
  if (!proj){
    console.warn("Project not found in state for:", name);
    return;
  }

  // 1) Modo inicial (lo que venga en la lista)
  const initialMode = String(proj.mode || "deterministic").toLowerCase();

  setSelectedProject(proj);
  setCurrentMode(initialMode);
  if (selectedProject) selectedProject.mode = initialMode; 

  // 2) circuito
  const hasCircuit = (proj.circuit_file_content || proj.circuitFileContent);
  if (hasCircuit){
    const ta = document.getElementById("circuitSelect");
    if (ta) ta.value = hasCircuit;
  } else {
    await loadCircuitIntoEditor(proj.name);
  }

  // 3) esto es lo que manda de verdad: aquí ya recalculas modeStr con data.mode
  await loadCutConfig(proj.name);

  renderInitValueInputs();
}

/* ---------- Delete ---------- */

export function deleteProject(projectName){
  if (!projectName){
    alert("This project is not valid for deleting.");
    return;
  }
  if (!confirm(`are you sure "${projectName}"? .`)) return;

    fetch(`${PROJECTS_API}/${encodeURIComponent(projectName)}?user_email=${encodeURIComponent(loggedInUser)}`, {
      method: "DELETE",
      credentials: "include"
    })


    .then(r => r.json())
    .then(data => {
      if (data.success){
        const filtered = (projects || []).filter(p => p.name !== projectName);
        alert(`Proyecto "${projectName}" Delete successfully.`);
        setProjects(filtered);
        displayProjectsForPage(currentPage);
      } else {
        alert("Delete error: " + data.message);
      }
    })
    .catch(err => console.error("Error eliminando proyecto:", err));
}

/* ---------- Cut config load/save ---------- */

/* ---------------------------
   Carga el circuito del proyecto y lo mete en el textarea editor.
   Si falla, lanza error con detalle parseado.
   --------------------------- */
export async function loadCutConfig(projectName){
  try{
    const resp = await fetch(
      `${PROJECTS_API}/${encodeURIComponent(projectName)}/cut_config?user_email=${encodeURIComponent(loggedInUser)}`,
      { credentials: "include" }
    );


    const raw = await resp.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}

    if (!resp.ok) {
      const msg =
        (typeof data?.detail === "string") ? data.detail :
        data?.detail ? JSON.stringify(data.detail, null, 2) :
        raw;
      console.error("loadCutConfig failed:", resp.status, msg);
      alert(`loadCutConfig HTTP ${resp.status}:\n\n${msg}`);
      return;
    }


    const cut_config = data?.cut_config;
    
    const cfg = (typeof cut_config === "string")
      ? JSON.parse(cut_config || "{}")
      : (cut_config || {});

    selectedProject.test_file_content = JSON.stringify(cfg);
    console.log("[loadCutConfig] cfg.input_indexes =", cfg.input_indexes);
    console.log("[loadCutConfig] cfg.input_init_values (RAW) =", cfg.input_init_values);
    console.log("[loadCutConfig] cfg FULL =", cfg);

    const setAll = (ids, value) => {
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = value;
      });
    };

    setAll(["cutInputs", "cutInputsCreate", "cutInputsExecute", "cutInputsDisplay"], (cfg.input_indexes || []).join(","));
    setAll(["cutOutputs","cutOutputsCreate","cutOutputsExecute","cutOutputsDisplay"], (cfg.output_indexes || []).join(","));
    setAll(["cutShots", "cutShotsCreate", "cutShotsExecute", "cutShotsDisplay"], String(cfg.shots ?? ""));

    const initVals = Array.isArray(cfg.input_init_values) ? cfg.input_init_values : [];
    setAll(["cutInitValsCreate","cutInitValsEdit"], initVals.join(","));

    const modeStr = String(
      data?.mode ??
      selectedProject?.mode ??
      document.getElementById("modeSelect")?.value ??
      "deterministic"
    ).toLowerCase();
    setCurrentMode(modeStr);
    if (selectedProject) selectedProject.mode = modeStr;   

    const formEl = document.getElementById("cutConfigForm");
    const container = formEl?.querySelector("#testCasesContainer") || document.getElementById("testCasesContainer");
    if (container){
      container.innerHTML = "";
      if (Array.isArray(cfg.test_suite) && cfg.test_suite.length){
        cfg.test_suite.forEach(pair => {
          const row = document.createElement("div");
          row.className = "d-flex align-items-center mt-2";

          const taIn = document.createElement("textarea");
          taIn.className = "form-control me-2";
          taIn.rows = 2;
          taIn.style.resize = "vertical";

          const taOut = document.createElement("textarea");
          taOut.className = "form-control me-2";
          taOut.rows = 2;
          taOut.style.resize = "vertical";

          taIn.value  = JSON.stringify(pair?.[0] ?? []);
          taOut.value = JSON.stringify(pair?.[1] ?? []);

          if (modeStr === "stochastic") {
            taIn.placeholder  = "State (e.g. [0,1])";
            taOut.placeholder = "% (e.g. 50)";
          } else {
            taIn.placeholder  = "Qubits input (e.g. [0,0,0])";
            taOut.placeholder = "Qubits output (e.g. [0,0])";
          }

          const btnDel = document.createElement("button");
          btnDel.type = "button";
          btnDel.className = "btn btn-outline-danger ms-2";
          btnDel.innerHTML = "🗑";
          btnDel.onclick = () => row.remove();

          row.append(taIn, taOut, btnDel);
          container.appendChild(row);
        });
      } else {
        addTestCaseField(container);
      }
    }

    //  init values UI + tabla
    renderInitValueInputs();
  
    const renderTableInto = (tableId) => {
      const host = document.getElementById(tableId);
      if (!host) return;

      const inputs = Array.isArray(cfg.input_indexes) ? cfg.input_indexes : [];
      let initArr = Array.isArray(cfg.input_init_values) ? cfg.input_init_values : [];
      //para que la tabla se vea bonita
      if (initArr.length < inputs.length) initArr = initArr.concat(new Array(inputs.length - initArr.length).fill(""));
      if (initArr.length > inputs.length) initArr = initArr.slice(0, inputs.length);

      renderIOTableFromStrings?.(
        inputs.join(","),
        (cfg.output_indexes || []).join(","),
        cfg.test_suite || [],
        tableId,
        "q",
        modeStr,
        initArr
      );
    };

// pinta en el editor (si existe) y en execute (si existe)
    renderTableInto("oiMapTable");
    renderTableInto("oiMapTableExecute");

    const errValue = data?.error_range ?? selectedProject?.error_range ?? "";
    const errRow = document.getElementById("errorRangeDisplayRow");
    const errInp = document.getElementById("errorRangeDisplay");
    if (modeStr === "stochastic") {
      errRow?.classList.remove("d-none");
      if (errInp) errInp.value = String(errValue);
    } else {
      errRow?.classList.add("d-none");
      if (errInp) errInp.value = "";
    }

  } catch(err){
    console.error(err);
    alert("Error with loading CUT configuration.");
  }
}
/* ---------- Init Values UI ---------- */

function parseInputIndexes() {
  const rawCreate = (document.getElementById("cutInputsCreate")?.value || "").trim();
  const rawEdit   = (document.getElementById("cutInputs")?.value || "").trim();
  const raw = rawCreate || rawEdit;
  if (!raw) return [];
  return raw.split(",").map(x => parseInt(String(x).trim(), 10)).filter(n => Number.isInteger(n));
}

/* ---------------------------
   Lee init tokens desde hidden input (create/edit) como array.
   --------------------------- */
function getInitValsArrayFromHidden(){
  const hidden = document.getElementById("cutInitValsCreate") || document.getElementById("cutInitValsEdit");
  if (!hidden) return [];
  const v = String(hidden.value || "").trim();
  if (!v) return [];
  return v.split(",").map(t => t.trim().toLowerCase());
}

function setHiddenFromArray(arr){
  const val = (arr || []).join(",");
  const hidCreate = document.getElementById("cutInitValsCreate");
  const hidEdit   = document.getElementById("cutInitValsEdit");
  if (hidCreate) hidCreate.value = val;
  if (hidEdit)   hidEdit.value   = val;
}
/* ---------------------------
   Pinta selects por cada input qubit (qX) para elegir init token.
   Sincroniza el resultado en hidden inputs.
   --------------------------- */
export function renderInitValueInputs(){
  const container = document.getElementById("cutInitValsPerQubit");
  if (!container) return;

  const idxs = parseInputIndexes();
  const prev = getInitValsArrayFromHidden();
  container.innerHTML = "";

  idxs.forEach((idx, i) => {
    const wrap = document.createElement("div");
    wrap.className = "d-flex align-items-center gap-2";

    const label = document.createElement("label");
    label.className = "form-label mb-0 me-2";
    label.textContent = `q${idx}`;

    const sel = document.createElement("select");
    sel.className = "form-select init-val-select";
    sel.dataset.qindex = String(i);

    ALLOWED_INIT.forEach(tok => {
      const opt = document.createElement("option");
      opt.value = tok;
      opt.textContent = tok === "" ? "(none)" : tok;
      sel.appendChild(opt);
    });

    if (prev[i] && ALLOWED_INIT.includes(prev[i])) sel.value = prev[i];
    sel.addEventListener("change", syncInitValsHiddenFromUI);

    wrap.appendChild(label);
    wrap.appendChild(sel);
    container.appendChild(wrap);
  });

  syncInitValsHiddenFromUI();
}


/* ---------------------------
   Lee los selects del UI y actualiza hidden init vals.
   --------------------------- */
function syncInitValsHiddenFromUI(){
  const sels = Array.from(document.querySelectorAll("#cutInitValsPerQubit .init-val-select"));
  if (!sels.length) { setHiddenFromArray([]); return; }
  const arr = sels.map(s => (s.value || "").toLowerCase()).map(v => v === "" ? "" : v);
  setHiddenFromArray(arr);
}

document.addEventListener("input", (ev) => {
  if (ev.target?.id === "cutInputsCreate") renderInitValueInputs();
});

export function afterProjectLoadedOrConfigLoaded(){
  renderInitValueInputs();
}

/* ---------------------------
   Paso final “create”: POST /save_full con FormData:
   - metadatos proyecto + circuit_file
   - cut_config_json (inputs/outputs/test_suite/shots/init values)
   - error_range si stochastic
   --------------------------- */

export async function saveTestSuiteFromCreate(){
  const pending = window.__pendingCreateProject;
  if (!pending?.tempProject || !pending?.circuitFile){
    alert("No pending project data. Go back and create the project again.");
    return;
  }

  const proj = pending.tempProject;
  const circuitFile = pending.circuitFile;

  const mode = getEffectiveMode();

  let er = 0;
  if (mode === "stochastic") {
    const raw = document.getElementById("errorRangeEditCreate")?.value;
    const num = Number(String(raw ?? "").replace(",", "."));
    if (Number.isFinite(num) && num >= 0 && num <= 100) er = num;

  }

  const shots = parseInt(document.getElementById("cutShotsCreate")?.value, 10) || 1024;

  const inputIndexes = (document.getElementById("cutInputsCreate")?.value || "")
    .split(",").map(x => parseInt(String(x).trim(), 10)).filter(n => !isNaN(n));

  const outputIndexes = (document.getElementById("cutOutputsCreate")?.value || "")
    .split(",").map(x => parseInt(String(x).trim(), 10)).filter(n => !isNaN(n));

  
  const testSuitePairs = [];
  const rows = document.querySelectorAll("#testCasesContainerCreate .d-flex");
  for (let i = 0; i < rows.length; i++){
    const [taLeft, taRight] = rows[i].getElementsByTagName("textarea");
    const leftRaw = (taLeft?.value || "").trim();
    const rightRaw = (taRight?.value || "").trim();

    if (mode === "stochastic") {
      const outText = ensureBrackets(leftRaw);
      let outBits;
      try { outBits = JSON.parse(outText); }
      catch (e){ alert(`Case #${i+1}: output bits invalid JSON: ${e.message}`); return; }

      if (!Array.isArray(outBits)){
        alert(`Case #${i+1}: output bits must be an array like [0,1].`);
        return;
      }

      if (rightRaw === "") { alert(`Case #${i+1}: probability required.`); return; }

      let prob = Number(rightRaw);
      if (Number.isNaN(prob)){
        try {
          const parsed = JSON.parse(rightRaw);
          prob = Array.isArray(parsed) ? Number(parsed[0]) : Number(parsed);
        } catch {
          alert(`Case #${i+1}: probability must be a number.`);
          return;
        }
      }

      if (!(prob >= 0 && prob <= 100)){
        alert(`Case #${i+1}: probability out of range. Use 0..100.`);
        return;
      }

      testSuitePairs.push([outBits, prob]);

    } else {
      const rawIn = ensureBrackets(leftRaw);
      const rawOut = ensureBrackets(rightRaw);
      try{
        const inp = JSON.parse(rawIn);
        const outp = JSON.parse(rawOut);
        testSuitePairs.push([inp, outp]);
      }catch(e){
        alert(`Test case #${i+1} invalid JSON: ${e.message}`);
        return;
      }
    }
  }

  const inputsLen = inputIndexes.length;

  let initValues = Array.from(
    document.querySelectorAll("#cutInitValsPerQubit .init-val-select")
  ).map(s => String(s.value || "").toLowerCase().trim());

  // normaliza longitud exacta
  if (initValues.length < inputsLen) initValues = initValues.concat(new Array(inputsLen - initValues.length).fill(""));
  if (initValues.length > inputsLen) initValues = initValues.slice(0, inputsLen);

  // valida
  const allowed = new Set(ALLOWED_INIT);
  for (let i = 0; i < initValues.length; i++) {
    if (!allowed.has(initValues[i])) {
      alert(`Invalid initial value "${initValues[i]}" at position ${i+1}.`);
      return;
    }
  }

  //  crea FormData y appends
  const formData = new FormData();
  formData.append("name", proj.name);
  formData.append("user_email", proj.user);
  formData.append("collaborator", proj.collaborator || "");
  formData.append("description", proj.description || "");
  formData.append("mode", mode);
  formData.append("error_range", String(er)); 
  formData.append("circuit_file", circuitFile);

  formData.append("cut_config_json", JSON.stringify({
    input_indexes: inputIndexes,
    output_indexes: outputIndexes,
    test_suite: testSuitePairs,
    shots,
    input_init_values: initValues
  }));
  console.log("CREATE initValues to send:", initValues);

  try{
    const resp = await fetch(`${PROJECTS_API}/save_full`, {
      method: "POST",
      body: formData,
      credentials: "include"
    });

    const raw = await resp.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch {}

    if (!resp.ok) {
      const msg =
        (typeof data?.detail === "string") ? data.detail :
        data?.detail ? JSON.stringify(data.detail, null, 2) :
        (typeof data?.message === "string") ? data.message :
        raw || resp.statusText;

      console.error("Save full project HTTP", resp.status, msg);
      alert("Error saving project:\n\n" + msg);
      return;
    }

    const created = data?.project;
    alert(data?.message || "Project created");

    if (created){
      setProjects([...(projects || []), created]);
      setSelectedProject(created);
      setCurrentMode(created.mode || proj.mode);
      window.__pendingCreateProject = null;
      renderProjectLibrary();
    }
  }catch(err){
    console.error(err);
    alert("Failed to save project (network).");
  }
}



export async function runTest(){
  if (!selectedProject) { alert("Select a project."); return; }

  const mode = getEffectiveMode();
  if (mode === "stochastic") {
    return runTestsStochasticPOST(selectedProject);
  }
  return runTestsDeterministicPOST(selectedProject);
}

export function viewCutCode(encodedContent){
  const decoded = base64DecodeUnicode(encodedContent || "");
  openSidePanelText(decoded || "(empty)");
}

export function viewTestingCode(encodedContent){
  const decoded = base64DecodeUnicode(encodedContent || "");

  let pretty = decoded || "(empty)";
  try {
    let obj = JSON.parse(decoded);

    if (typeof obj === "string") obj = JSON.parse(obj);

    pretty = JSON.stringify(obj, null, 2);
  } catch {}

  openSidePanelText(pretty, "Testing Config");
}



window.selectProject = selectProject;
window.loadCutConfig = loadCutConfig;
window.goToCreateProject = goToCreateProject;
window.createProject = createProject;
window.deleteProject = deleteProject;
window.renderProjectLibrary = renderProjectLibrary;
window.populateProjectSelect = populateProjectSelect;
window.runTest = runTest;
window.afterProjectLoadedOrConfigLoaded = afterProjectLoadedOrConfigLoaded;
window.renderInitValueInputs = renderInitValueInputs;
window.saveTestSuiteFromCreate = saveTestSuiteFromCreate;
window.viewCutCodeByProject = viewCutCodeByProject;
window.viewTestingCodeByProject = viewTestingCodeByProject;
window.viewCutCode = viewCutCode;
window.viewNotesByProject = viewNotesByProject;
window.viewTestingCode = viewTestingCode;
window.renderIOTableFromStrings = renderIOTableFromStrings;
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("runTestsBtn")?.addEventListener("click", runTest);
});
window.getSelectedProject = () => selectedProject;
window.API_BASE = API_BASE;
window.getLoggedInUser = () => loggedInUser;
