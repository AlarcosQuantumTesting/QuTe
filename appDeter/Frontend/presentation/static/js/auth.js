

import {
  API_BASE,
  setLoggedInUser
} from "./state.js";

import {
  openTab,
  showLoggedInMenu,
  showLoggedOutMenu
} from "./ui.js";

export async function login() {
  let email, password;
  let formData;
  let response, data;
  let twofa, img;
  let authArea, sidebar, main, appArea;
  email     = (document.getElementById("email_login")  ?.value) || "";
  password  = (document.getElementById("password_login")?.value) || "";

  formData = new FormData();
  formData.append("email", email);
  formData.append("password", password);

  try {
    response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      body: formData
    });
    data = await response.json();

    if (!response.ok) {
      alert(data.detail || data.message || "Login error");
      return;
    }


    if (data.logged_in) {
      alert(data.message || "Logged in");
      setLoggedInUser(email);

      authArea = document.getElementById("auth-area");
      sidebar  = document.getElementById("sidebar");
      main     = document.getElementById("main-content");
      appArea  = document.getElementById("app-area");

      if (authArea) authArea.style.display = "none";
      if (sidebar)  sidebar.style.display  = "block";
      if (main)     main.style.display     = "block";
      if (appArea)  appArea.style.display  = "flex";

      openTab("createProject");
      showLoggedInMenu();
    }
  } catch (error) {
    console.error(error);
    alert("Error en login.");
  }
}


export function registerUser() {

  let  email, password;
  let formData;

  email    = (document.getElementById("email_register_register")?.value) || "";
  password = (document.getElementById("password_register_register")?.value) || "";

  formData = new FormData();
  formData.append("email", email);
  formData.append("password", password);

  fetch(`${API_BASE}/auth/register`, { method: "POST", body: formData })
    .then(async function (response) {
      let data;
      data = await response.json();
      if (!response.ok) {
        alert(data.detail || data.message || "Register error");
        return;
        }
      alert(data.message || "User created");
    })
    .catch(function (error) {
      console.error(error);
      alert("Error de registro.");
    });
}


export function recoverPassword() {
  let email, sec;

  email = (document.getElementById("email_recover")?.value) || "";
  if (!email) {
    alert("Please enter your email.");
    return;
  }

  fetch(`${API_BASE}/forgot_password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    alert(data.message || "Check your email.");
    if (data.next_step === "/verify_2fa/") {
      sec = document.getElementById("2fa-section-recovery");
      if (sec) sec.style.display = "block";
    }
  })
  .catch(function (error) {
    console.error("Error:", error);
  });
}


export function logout() {
  let authArea, sidebar, main, appArea;
  showLoggedOutMenu();

  authArea = document.getElementById("auth-area");
  sidebar  = document.getElementById("sidebar");
  main     = document.getElementById("main-content");
  appArea  = document.getElementById("app-area");

  if (authArea) authArea.style.display = "block";
  if (sidebar)  sidebar.style.display  = "none";
  if (main)     main.style.display     = "none";
  if (appArea)  appArea.style.display  = "none";
}
