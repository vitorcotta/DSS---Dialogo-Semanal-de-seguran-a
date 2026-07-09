const adminGallery = document.getElementById("adminGallery");
const refreshButton = document.getElementById("refreshButton");
const logoutButton = document.getElementById("logoutButton");
const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const uploadStatus = document.getElementById("uploadStatus");

function sanitizeTitle(fileName) {
  return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ");
}

function setUploadStatus(text, type) {
  uploadStatus.textContent = text;
  uploadStatus.className = `admin-status${type ? ` admin-status--${type}` : ""}`;
}

function renderMessage(text) {
  adminGallery.innerHTML = `<div class="message">${text}</div>`;
}

function renderPosters(posters) {
  if (!posters.length) {
    renderMessage("Nenhum cartaz cadastrado ainda. Envie o primeiro acima.");
    return;
  }

  const cards = posters
    .map(
      (poster) => `
      <article class="admin-card ${poster.enabled ? "" : "admin-card--disabled"}">
        <img src="${poster.src}" alt="Cartaz DSS: ${sanitizeTitle(poster.name)}" loading="lazy" />
        <p class="admin-card__title">${sanitizeTitle(poster.name)}</p>
        <div class="admin-card__row">
          <label class="admin-toggle">
            <input type="checkbox" data-name="${poster.name}" ${poster.enabled ? "checked" : ""} />
            ${poster.enabled ? "Habilitado" : "Desabilitado"}
          </label>
          <button type="button" class="admin-delete" data-delete="${poster.name}">Excluir</button>
        </div>
      </article>
    `
    )
    .join("");

  adminGallery.innerHTML = cards;
}

async function loadPosters() {
  renderMessage("Carregando cartazes...");

  try {
    const response = await fetch("/api/admin/cartazes", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    if (!response.ok) {
      throw new Error("Falha ao consultar os cartazes.");
    }

    const data = await response.json();
    renderPosters(data.posters || []);
  } catch (error) {
    renderMessage(`Erro ao carregar os cartazes: ${error.message}`);
  }
}

async function toggleUpload(event) {
  event.preventDefault();

  if (!fileInput.files.length) {
    setUploadStatus("Selecione ao menos um arquivo.", "error");
    return;
  }

  const formData = new FormData();
  Array.from(fileInput.files).forEach((file) => formData.append("images", file));

  setUploadStatus("Enviando...");

  try {
    const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    if (!response.ok) {
      throw new Error(data.message || "Falha ao enviar cartazes.");
    }

    setUploadStatus("Cartazes enviados com sucesso. Habilite-os quando quiser publica-los.", "success");
    fileInput.value = "";
    renderPosters(data.posters || []);
  } catch (error) {
    setUploadStatus(error.message, "error");
  }
}

async function handleToggle(event) {
  const checkbox = event.target.closest("input[data-name]");
  if (!checkbox) {
    return;
  }

  const name = checkbox.dataset.name;
  const enabled = checkbox.checked;

  try {
    const response = await fetch("/api/admin/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, enabled })
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Falha ao atualizar cartaz.");
    }

    const data = await response.json();
    renderPosters(data.posters || []);
  } catch (error) {
    setUploadStatus(error.message, "error");
    checkbox.checked = !enabled;
  }
}

async function handleDelete(event) {
  const button = event.target.closest("button[data-delete]");
  if (!button) {
    return;
  }

  const name = button.dataset.delete;
  if (!window.confirm(`Excluir o cartaz "${sanitizeTitle(name)}"? Esta acao nao pode ser desfeita.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/cartazes/${encodeURIComponent(name)}`, { method: "DELETE" });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Falha ao excluir cartaz.");
    }

    const data = await response.json();
    renderPosters(data.posters || []);
  } catch (error) {
    setUploadStatus(error.message, "error");
  }
}

uploadForm.addEventListener("submit", toggleUpload);
refreshButton.addEventListener("click", loadPosters);
adminGallery.addEventListener("change", handleToggle);
adminGallery.addEventListener("click", handleDelete);
logoutButton.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login.html";
});

loadPosters();
