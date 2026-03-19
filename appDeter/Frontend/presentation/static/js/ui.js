export function startApp() {
  let intro, authArea, appArea, main, sidebar;
  intro = document.getElementById('intro');
  if (intro) intro.style.display = 'none';
  authArea = document.getElementById('auth-area');
  appArea  = document.getElementById('app-area');
  main     = document.getElementById('main-content');
  sidebar  = document.getElementById('sidebar');
  if (authArea) authArea.style.display = 'block';
  if (appArea)  appArea.style.display  = 'none';
  if (main)     main.style.display     = 'none';
  if (sidebar)  sidebar.style.display  = 'none';
  openAuthTab('login');
}

export function toggleSidebar() {
  let sidebar, content;
  sidebar = document.getElementById('sidebar');
  content = document.getElementById('main-content');
  if (!sidebar || !content) return;
  if (sidebar.style.width === '60px') {
    sidebar.style.width = '220px';
    content.style.marginLeft = '220px';
  } else {
    sidebar.style.width = '60px';
    content.style.marginLeft = '60px';
  }
}

export function openAuthTab(tabName) {
  let idMap, targetId;
  idMap = { login: 'login', register: 'registro', recover: 'recoverPassword' };
  targetId = idMap[tabName] || 'login';
  ['login', 'registro', 'recoverPassword'].forEach(function(id){
    let el;
    el = document.getElementById(id);
    if (el) el.style.display = (id === targetId ? 'block' : 'none');
  });
  document.querySelectorAll('#auth-menu-tabs .nav-link').forEach(function(link){
    link.classList.toggle('active', link.dataset.target === tabName);
  });
}

export function openTab(tabName) {
  let tabs, i, tab, activeTab, modeSelect, errDiv, newModeSelect;
  tabs = document.getElementsByClassName("tab-content");
  for (i = 0; i < tabs.length; i++) {
    tab = tabs[i];
    resetFieldsInTab(tab.id);
    tab.classList.remove("active");
    tab.style.display = "none";
  }
  activeTab = document.getElementById(tabName);
  if (!activeTab) return;
  activeTab.classList.add("active");
  activeTab.style.display = "block";
  if (tabName === 'libro' && typeof window.renderProjectLibrary === "function") {
    window.renderProjectLibrary();
  } else if (tabName === 'project' && typeof window.populateProjectSelect === "function") {
    window.populateProjectSelect();
  }
  if (tabName === 'createProject') {
    modeSelect = document.getElementById("modeSelect");
    errDiv     = document.getElementById("errorRangeDiv");
    if (modeSelect && errDiv) {
      errDiv.style.display = modeSelect.value === "stochastic" ? "block" : "none";
      newModeSelect = modeSelect.cloneNode(true);
      modeSelect.parentNode.replaceChild(newModeSelect, modeSelect);
      newModeSelect.addEventListener("change", function(){
        errDiv.style.display = newModeSelect.value === "stochastic" ? "block" : "none";
      });
    }
  }
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

export function showLoggedInMenu() {
  let btn;
  btn = document.getElementById("logoutButton");
  if (btn) btn.style.display = "block";
}

export function showLoggedOutMenu() {
  let btn;
  openTab("login");
  btn = document.getElementById("logoutButton");
  if (btn) btn.style.display = "none";
}
