// static/js/notes.js  (SIN imports)

function $(id){ return document.getElementById(id); }

function getProjectIdSafe() {
  const p =
    (typeof window.getSelectedProject === "function")
      ? window.getSelectedProject()
      : window.selectedProject;

  if (!p) return null;
  return p.id || p.project_id || p.project_name || p.name || null;
}

function getEmailSafe() {
  return (typeof window.getLoggedInUser === "function")
    ? window.getLoggedInUser()
    : window.loggedInUser;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
function escapeJs(s) { return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }

function formatTimestamp(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
}

// --- API ---
function getNotesApiBase() {
  const base = window.API_BASE || "http://127.0.0.1:8000";
  return `${base}/notes`;
}

// --- render ---
function renderNoteItem(n) {
  const id = n.id;
  const title = escapeHtml(n.title || "(sin título)");
  const text = escapeHtml(n.text || "");
  const type = escapeHtml(n.type || "general");
  const ts = n.timestamp ? formatTimestamp(n.timestamp) : "";

  return `
    <div class="note-item" data-note-id="${escapeHtml(id)}">
      <div class="note-item-header">
        <div class="note-title">${title}</div>
        <div class="note-actions">
          <button class="btn btn-sm btn-edit" type="button" onclick="window.editNote('${escapeJs(id)}')">Editar</button>
          <button class="btn btn-sm btn-cancel" type="button" onclick="window.deleteNote('${escapeJs(id)}')">Borrar</button>
        </div>
      </div>
      <div class="note-meta">${type}${ts ? " · " + ts : ""}</div>
      <div class="note-text">${text}</div>
    </div>
  `;
}

function renderNotesList(notes) {
  const cont = $("notesList");
  if (!cont) return;

  if (!Array.isArray(notes) || notes.length === 0) {
    cont.innerHTML = `<div class="text-muted">No hay notas para este proyecto.</div>`;
    return;
  }

  cont.innerHTML = notes.map(renderNoteItem).join("\n");
}

// Mantén el “New / Save / Clean / Close”
function clearNoteForm() {
  if ($("noteId")) $("noteId").value = "";
  if ($("noteTitle")) $("noteTitle").value = "";
  if ($("noteText")) $("noteText").value = "";
  if ($("noteType")) $("noteType").value = "general";
}

function newNote() {
  clearNoteForm();
  if ($("noteFormTitle")) $("noteFormTitle").textContent = "Nueva nota";
}

function editNote(noteId) {
  const item = document.querySelector(`.note-item[data-note-id="${CSS.escape(noteId)}"]`);
  if (!item) return;

  const title = item.querySelector(".note-title")?.textContent || "";
  const text  = item.querySelector(".note-text")?.textContent || "";
  const meta  = item.querySelector(".note-meta")?.textContent || "";
  const type  = meta.split("·")[0].trim() || "general";

  if ($("noteId")) $("noteId").value = noteId;
  if ($("noteTitle")) $("noteTitle").value = title;
  if ($("noteText")) $("noteText").value = text;
  if ($("noteType")) $("noteType").value = type;

  if ($("noteFormTitle")) $("noteFormTitle").textContent = "Editar nota";
}

// --- drawer controls ---
async function openNotesDrawer() {
  const drawer = $("notesDrawer");
  const overlay = $("notesOverlay");
  if (!drawer || !overlay) return;

  // Solo en Execute: si quieres forzarlo, descomenta y ajusta selector
  // const executeTabIsActive = document.querySelector("#executeTab")?.classList.contains("active");
  // if (!executeTabIsActive) return;

  drawer.classList.add("open");
  overlay.classList.add("open");

  const projectId = getProjectIdSafe();
  const email = getEmailSafe();

  if (!projectId) {
    const hint = $("notesProjectHint");
    if (hint) hint.textContent = "Selecciona un proyecto antes de abrir notas.";
    renderNotesList([]);
    return;
  }
  if (!email) {
    const hint = $("notesProjectHint");
    if (hint) hint.textContent = "No hay usuario logueado.";
    renderNotesList([]);
    return;
  }

  await loadNotes(projectId, email);
}

function closeNotesDrawer() {
  $("notesDrawer")?.classList.remove("open");
  $("notesOverlay")?.classList.remove("open");
}

async function loadNotes(projectId = null, email = null) {
  if (!projectId) projectId = getProjectIdSafe();
  if (!email) email = getEmailSafe();

  if (!projectId || !email) {
    console.warn("[loadNotes] Missing params", { projectId, email });
    renderNotesList([]);
    return [];
  }

  const base = window.API_BASE || "http://127.0.0.1:8000";
  const url = `${base}/notes/?projectId=${encodeURIComponent(projectId)}&email=${encodeURIComponent(email)}`;

  const res = await fetch(url, { credentials: "include" });

  if (!res.ok) {
    let payload;
    try { payload = await res.json(); } catch { payload = await res.text(); }
    const msg = typeof payload === "string" ? payload : JSON.stringify(payload);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }

  const notes = await res.json();
  renderNotesList(notes);

  // Opcional: mantener notas en memoria del proyecto (para “library”)
  try {
    if (window.selectedProject && (window.selectedProject.name === projectId || window.selectedProject.id === projectId)) {
      window.selectedProject.notes = notes;
    }
    if (Array.isArray(window.projects)) {
      const idx = window.projects.findIndex(p => (p.name === projectId || p.id === projectId));
      if (idx >= 0) window.projects[idx].notes = notes;
    }
  } catch {}

  // Refresca librería si existe (para que “se guarden en la libreria” visualmente)
  try { window.renderProjectLibrary?.(); } catch {}

  return notes;
}

// --- CRUD ---
async function submitNoteForm() {
  const projectId = getProjectIdSafe();
  const email = getEmailSafe();

  if (!projectId) { alert("Selecciona un proyecto antes de crear notas."); return; }
  if (!email) { alert("No hay usuario logueado."); return; }

  const noteId = ($("noteId")?.value || "").trim();
  const title = ($("noteTitle")?.value || "").trim();
  const text  = ($("noteText")?.value || "").trim();
  const type  = ($("noteType")?.value || "general").trim();

  if (!title && !text) { alert("Escribe al menos un título o texto."); return; }

  try {
    const payload = { project_id: projectId, user_email: email, title, text, type };

    const res = await fetch(
      noteId ? `${getNotesApiBase()}/${encodeURIComponent(noteId)}` : getNotesApiBase(),
      {
        method: noteId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include"
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);

    clearNoteForm();

    // importante: recargar + repintar + refrescar librería
    await loadNotes(projectId, email);

    alert(noteId ? "Nota actualizada." : "Nota creada.");
  } catch (e) {
    console.error(e);
    alert(`Error guardando nota: ${e.message || String(e)}`);
  }
}

async function deleteNote(noteId) {
  const projectId = getProjectIdSafe();
  const email = getEmailSafe();

  if (!projectId || !email) { alert("Falta proyecto o usuario."); return; }
  if (!confirm("¿Borrar esta nota?")) return;

  try {
    const url = `${getNotesApiBase()}/${encodeURIComponent(noteId)}?project_id=${encodeURIComponent(projectId)}&user_email=${encodeURIComponent(email)}`;
    const res = await fetch(url, { method: "DELETE", credentials: "include" });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);

    await loadNotes(projectId, email);
    alert("Nota borrada.");
  } catch (e) {
    console.error(e);
    alert(`Error borrando nota: ${e.message || String(e)}`);
  }
}

// --- EXPOSE GLOBALS ---
window.openNotesDrawer = openNotesDrawer;
window.closeNotesDrawer = closeNotesDrawer;

window.loadNotes = loadNotes;
window.newNote = newNote;
window.editNote = editNote;
window.deleteNote = deleteNote;
window.submitNoteForm = submitNoteForm;

// Si tu botón “Clean” llama a otra cosa, expón también:
window.clearNoteForm = clearNoteForm;

console.log("[notes.js] loaded OK");