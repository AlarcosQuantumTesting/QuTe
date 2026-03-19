export function ensureBrackets(str) {
  let result;
  result = String(str ?? "").trim();
  if (!result.startsWith("[")) result = "[" + result;
  if (!result.endsWith("]")) result += "]";
  return result;
}

export function base64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(_, p1){
      return String.fromCharCode("0x" + p1);
    })
  );
}

export function base64DecodeUnicode(b64) {
  let bin, esc;
  bin = atob(b64);
  esc = Array.prototype.map.call(bin, function(c){
    return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
  }).join("");
  return decodeURIComponent(esc);
}
export function ensureSidePanel(){
  const panel = document.getElementById("codeSidePanel");
  const pre   = document.getElementById("sidepanelPre");
  const title = document.getElementById("sidepanelTitle");
  const copyBtn  = document.getElementById("sidepanelCopyBtn");
  const clearBtn = document.getElementById("sidepanelClearBtn");

  if (!panel || !pre) return null;

  // Bind una sola vez
  if (copyBtn && !copyBtn.__bound){
    copyBtn.__bound = true;
    copyBtn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(pre.textContent || ""); } catch {}
    });
  }
  if (clearBtn && !clearBtn.__bound){
    clearBtn.__bound = true;
    clearBtn.addEventListener("click", () => {
      pre.textContent = '(click “Circuit code” or “Testing Config”)';
      if (title) title.textContent = "Preview";

      panel.classList.add("d-none");         // 👈 CIERRA
      const layout = panel.closest(".library-layout");
      layout?.classList.remove("panel-open");
    });

  }

  return { panel, pre, title };
}

export function openSidePanelText(text, header="Preview"){
  const ui = ensureSidePanel();
  if (!ui) return;

  const { panel, pre, title } = ui;
  const layout = panel.closest(".library-layout");

  panel.classList.remove("d-none");      // 👈 CRÍTICO
  layout?.classList.add("panel-open");

  if (title) title.textContent = header;
  pre.textContent = text || "";
}


export function addTestCaseField(containerParam) {
  let container, row, taIn, taOut, btn;
  container = containerParam || document.getElementById("testCasesContainer");
  if (!container) return;
  row = document.createElement("div");
  row.className = "d-flex align-items-center mt-2";
  taIn = document.createElement("textarea");
  taIn.className = "form-control me-2";
  taIn.rows = 2;
  taIn.style.resize = "vertical";
  taIn.placeholder = "Qubits de entrada (e.g. [0,0,0])";
  taOut = document.createElement("textarea");
  taOut.className = "form-control me-2";
  taOut.rows = 2;
  taOut.style.resize = "vertical";
  taOut.placeholder = "Qubits de salida (e.g. [0,0])";
  btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-outline-danger ms-2";
  btn.innerHTML = "🗑";
  btn.onclick = function(){ removeTestCaseField(this); };
  row.append(taIn, taOut, btn);
  container.appendChild(row);
}

export function removeTestCaseField(button) {
  let row;
  row = button?.parentNode;
  if (row) row.remove();
}

export function toggleTestFileInput() {
  let selectedOption, uploadDiv, createDiv;
  selectedOption = document.getElementById("testFileOptions")?.value;
  uploadDiv = document.getElementById("uploadTestFileDiv");
  createDiv = document.getElementById("createTestFileDiv");
  if (!uploadDiv || !createDiv) return;
  if (selectedOption === "upload") {
    uploadDiv.style.display = "block";
    createDiv.style.display = "none";
  } else if (selectedOption === "create") {
    uploadDiv.style.display = "none";
    createDiv.style.display = "block";
  } else {
    uploadDiv.style.display = "none";
    createDiv.style.display = "none";
  }
}

export function resetCreateProjectForm() {
  let ids;
  ids = [
    "nombre_proyecto",
    "cooperador_proyecto-createProject",
    "descripcion",
    "circuitFile-createProject",
    "testFileCut",
  ];
  ids.forEach(function(id){
    let el;
    el = document.getElementById(id);
    if (!el) return;
    if (el.type === "file") el.value = null;
    else el.value = "";
  });
}

export function resetFormInTab(tabId) {
  let tab, forms, i;
  tab = document.getElementById(tabId);
  if (!tab) return;
  forms = tab.getElementsByTagName("form");
  for (i = 0; i < forms.length; i++) forms[i].reset();
}

export function resetFieldsInTab(tabId) {
  let tab, elements;
  tab = document.getElementById(tabId);
  if (!tab) return;
  elements = tab.querySelectorAll("input, textarea, select");
  elements.forEach(function(element){
    let tag;
    tag = element.tagName.toLowerCase();
    if (tag === "input") {
      if (element.type === "checkbox" || element.type === "radio") {
        element.checked = false;
      } else {
        element.value = "";
      }
    } else if (tag === "textarea") {
      element.value = "";
    } else if (tag === "select") {
      element.selectedIndex = 0;
    }
  });
}

export function formatLogs(raw) {
  let rawLogs, lines, html;
  rawLogs = raw;
  if (typeof rawLogs !== "string") {
    if (Array.isArray(rawLogs)) rawLogs = rawLogs.join("\n");
    else rawLogs = JSON.stringify(rawLogs, null, 2);
  }
  lines = rawLogs.split("\n");
  html = "<div style='font-family: monospace;'>";
  lines.forEach(function(line){
    let color;
    line = line.trim();
    if (!line) return;
    if (line.startsWith("Input:")) {
      html += `<p><strong>${line}</strong></p>`;
    } else if (line.startsWith("Passed tests:")) {
      html += `<p><strong>${line}</strong></p>`;
    } else if (line.startsWith("Expected Result:")) {
      html += `<p style="margin-left: 20px;"><em>${line}</em></p>`;
    } else if (line.startsWith("Verdict:")) {
      color = line.includes("True") ? "green" : "red";
      html += `<p style="margin-left: 40px; color: ${color};">${line}</p>`;
    } else {
      html += `<p style="margin-left: 20px;">${line}</p>`;
    }
  });
  html += "</div>";
  return html;
}

export async function debugFetch(res, label = "HTTP") {
  const ct = res.headers.get("content-type") || "";
  const raw = await res.text().catch(() => "");
  let json = null;

  if (ct.includes("application/json")) {
    try { json = raw ? JSON.parse(raw) : null; } catch {}
  } else {
    // por si FastAPI te devuelve JSON pero con content-type raro
    try { json = raw ? JSON.parse(raw) : null; } catch {}
  }

  console.groupCollapsed(`%c${label} ${res.status} ${res.statusText}`, "color:#b00;font-weight:bold;");
  console.log("url:", res.url);
  console.log("content-type:", ct);
  console.log("raw body:", raw);
  if (json) console.log("json:", json);
  console.log("headers:", Object.fromEntries(res.headers.entries()));
  console.groupEnd();

  // Devuelve ambos por si quieres usarlos
  return { raw, json };
}

window.debugFetch = debugFetch
window.addTestCaseField = addTestCaseField;
window.removeTestCaseField = removeTestCaseField;
window.toggleTestFileInput = toggleTestFileInput;
window.resetCreateProjectForm = resetCreateProjectForm;
window.resetFormInTab = resetFormInTab;
window.base64EncodeUnicode = base64EncodeUnicode;
window.ensureBrackets = ensureBrackets;
window.formatLogs = formatLogs;
window.openSidePanelText = openSidePanelText;
