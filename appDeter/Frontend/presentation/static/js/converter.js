

export async function convertConfig() {
  let jsonFile, language;
  let formData;
  let response, data;
  let output;

  jsonFile = document.getElementById("jsonConfigFile")?.files?.[0];
  language = document.getElementById("languageSelect")?.value;
  output   = document.getElementById("conversionResult");

  if (!jsonFile || !language) {
    alert("Please select a json and a destiny language");
    return;
  }

  formData = new FormData();
  formData.append("json_file", jsonFile);
  formData.append("language", language);

  try {
    response = await fetch("http://127.0.0.1:8000/convert", {
      method: "POST",
      body: formData
    });

    // si el backend devuelve algo no-JSON, esto podría lanzar
    data = await response.json();

    if (response.ok) {
      if (output) output.value = (data?.converted_code ?? "");
    } else {
      if (output) output.value = (data?.detail ?? "Error in the conversion.");
    }
  } catch (err) {
    if (output) output.value = "Error in the conversion.";
  }
}

export function downloadCode() {
  let codeContent, lang, ext, fileName;
  let blob, url, a;

  codeContent = document.getElementById("conversionResult")?.value || "";
  if (!codeContent.trim()) {
    alert("No hay código para descargar. Realiza una conversión primero.");
    return;
  }

  lang = (document.getElementById("languageSelect")?.value || "").toLowerCase();
  ext  = (lang === "qsharp" || lang === "q#") ? "qs" : "py";
  fileName = `converted_code.${ext}`;

  blob = new Blob([codeContent], { type: "text/plain;charset=utf-8" });
  url  = URL.createObjectURL(blob);

  a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener("click", function (e) {
  let btn;
  btn = e.target.closest("#convertBtn, #downloadCodeButton");
  if (!btn) return;

  if (btn.id === "convertBtn") convertConfig();
  if (btn.id === "downloadCodeButton") downloadCode();
});
