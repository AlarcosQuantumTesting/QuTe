// === state.js ===
// Estado global y pequeños setters/getters para usar desde otros módulos.

// Variables de app
export let projects = [];
export let loggedIn = false;
export let selectedProject = null;
export let loggedInUser = null;
export let currentPage = 1;
export const itemsPerPage = 6;
export let stochasticChartInstance = null;
export let currentMode = "deterministic";

// Compatibilidad: en tu código hay referencias a createdCutFile y a createdCutJson.
// Dejamos ambos, pero usa createdCutFile en adelante.
export let createdCutFile = null;
export let createdCutJson = null; // legacy (no lo uses nuevo)

// Base de API (si quieres cambiar puerto/host, hazlo aquí en un solo sitio)
export const API_BASE = "http://127.0.0.1:8000";

// Setters
export function setProjects(val)            { projects = val; }
export function setLoggedIn(val)            { loggedIn = val; }
export function setSelectedProject(val)     { selectedProject = val; }
export function setLoggedInUser(val)        { loggedInUser = val; }
export function setCurrentPage(val)         { currentPage = val; }
export function setChartInstance(val)       { stochasticChartInstance = val; }
export function setCurrentMode(val)         { currentMode = val; }
export function setCreatedCutFile(val)      { createdCutFile = val; }
export function setCreatedCutJson(val)      { createdCutJson = val; } // legacy

// Getters (útiles si alguna vez quieres leer en forma de función)
export function getState() {
  return {
    projects,
    loggedIn,
    selectProject,
    loggedInUser,
    currentPage,
    itemsPerPage,
    stochasticChartInstance,
    currentMode,
    createdCutFile,
    createdCutJson
  };
}
