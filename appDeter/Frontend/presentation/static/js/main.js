// /static/js/main.js
// Entry point: importa módulos y expone funciones a window

import * as UI    from "./ui.js";
import * as Auth  from "./auth.js";
import * as Utils from "./utils.js";
import * as Projects from "./projects.js";  
import * as Execute from "./execute.js";
import * as Converter from "./converter.js";
import "./notes.js";

// ---- UI ----
window.startApp        = UI.startApp;
window.openTab         = UI.openTab;
window.openAuthTab     = UI.openAuthTab;
window.toggleSidebar   = UI.toggleSidebar;
window.showLoggedInMenu  = UI.showLoggedInMenu;
window.showLoggedOutMenu = UI.showLoggedOutMenu;

// ---- Auth ----
window.login           = Auth.login;
window.submit2FA       = Auth.submit2FA;
window.recoverPassword = Auth.recoverPassword;
window.logout          = Auth.logout;
// mapeo porque en tu HTML llamas register(), pero en auth.js es registerUser():
window.register        = Auth.registerUser;

// ---- Projects (exponer TODO lo que uses en onclick o desde UI.openTab) ----
window.renderProjectLibrary     = Projects.renderProjectLibrary;
window.displayProjectsForPage   = Projects.displayProjectsForPage;
window.renderPaginationControls = Projects.renderPaginationControls;
window.populateProjectSelect    = Projects.populateProjectSelect;
window.selectProject            = Projects.selectProject;
window.createProject            = Projects.createProject;
window.toggleTestFileInput      = Projects.toggleTestFileInput;
window.addTestCaseField         = Projects.addTestCaseField;
window.removeTestCaseField      = Projects.removeTestCaseField;
window.createNewCut             = Projects.createNewCut;
window.viewCutCode              = Projects.viewCutCode;
window.viewTestingCode          = Projects.viewTestingCode;
window.deleteProject            = Projects.deleteProject;
window.loadCutConfig            = Projects.loadCutConfig;
window.saveCutConfigToDB        = Projects.saveCutConfigToDB;


// ---- Utils ----
window.viewTestingCode        = Utils.viewTestingCode;
window.viewCutCode            = Utils.viewCutCode;
window.addTestCaseField       = Utils.addTestCaseField;
window.removeTestCaseField    = Utils.removeTestCaseField;
window.toggleTestFileInput    = Utils.toggleTestFileInput;
window.resetCreateProjectForm = Utils.resetCreateProjectForm;
window.resetFormInTab         = Utils.resetFormInTab;
window.base64EncodeUnicode    = Utils.base64EncodeUnicode;
window.ensureBrackets         = Utils.ensureBrackets;
window.formatLogs             = Utils.formatLogs;

// ---- Execute ----
window.enableEditing       = Execute.enableEditing;
window.cancelCircuitEditing= Execute.cancelCircuitEditing;
window.saveCircuitChanges  = Execute.saveCircuitChanges;
window.showEditCutForm     = Execute.showEditCutForm;
window.cancelEditCutForm   = Execute.cancelEditCutForm;
window.runTest             = Execute.runTest;

// ---- Converter ----
window.convertConfig = Converter.convertConfig;
window.downloadCode  = Converter.downloadCode;



document.addEventListener("DOMContentLoaded", () => {
  // Abrir pestaña login por defecto
  if (typeof UI.openAuthTab === "function") {
    UI.openAuthTab("login");
  }
});
