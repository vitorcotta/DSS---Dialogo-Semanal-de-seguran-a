const adminGallery = document.getElementById("adminGallery");
const refreshButton = document.getElementById("refreshButton");
const logoutButton = document.getElementById("logoutButton");
const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const uploadStatus = document.getElementById("uploadStatus");

const lightbox = document.getElementById("lightbox");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxViewport = document.getElementById("lightboxViewport");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxTitle = document.getElementById("lightboxTitle");

let renamingName = null;

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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function openLightbox(src, title) {
  lightboxImage.src = src;
  lightboxImage.alt = `Cartaz ampliado: ${title}`;
  lightboxTitle.textContent = title;
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxViewport.scrollTo({ left: 0, top: 0 });
  lightboxImage.src = "";
  lightboxTitle.textContent = "";
  document.body.style.overflow = "";
}

function renderRow(poster, { isFirstInGroup, isLastInGroup, positionLabel }) {
  const title = sanitizeTitle(poster.name);
  const isRenaming = renamingName === poster.name;

  const nameArea = isRenaming
    ? `
      <form class="admin-rename-form" data-rename-form="${escapeHtml(poster.name)}">
        <input type="text" value="${escapeHtml(poster.name)}" data-rename-input required />
        <button type="submit">Salvar</button>
        <button type="button" class="admin-rename-cancel" data-rename-cancel>Cancelar</button>
      </form>
    `
    : `
      <div class="admin-row__name">
        <p class="admin-row__title" data-preview="${poster.src}" data-title="${escapeHtml(title)}" title="Clique para ampliar">
          ${escapeHtml(poster.name)}
        </p>
        <button type="button" class="admin-rename-btn" data-rename-start="${escapeHtml(poster.name)}" title="Renomear">
          Renomear
        </button>
      </div>
    `;

  return `
    <article class="admin-row ${poster.enabled ? "" : "admin-row--disabled"}">
      <div class="admin-row__reorder">
        <button
          type="button"
          class="admin-reorder-btn"
          data-reorder="up"
          data-reorder-name="${escapeHtml(poster.name)}"
          title="Mover para cima"
          ${isFirstInGroup ? "disabled" : ""}
        >&#9650;</button>
        <button
          type="button"
          class="admin-reorder-btn"
          data-reorder="down"
          data-reorder-name="${escapeHtml(poster.name)}"
          title="Mover para baixo"
          ${isLastInGroup ? "disabled" : ""}
        >&#9660;</button>
      </div>
      ${positionLabel !== null ? `<span class="admin-row__position" title="Posicao na galeria (1 = ultimo)">${positionLabel}</span>` : ""}
      <img
        class="admin-row__thumb"
        src="${poster.src}"
        alt="Cartaz DSS: ${escapeHtml(title)}"
        loading="lazy"
        data-preview="${poster.src}"
        data-title="${escapeHtml(title)}"
      />
      <div class="admin-row__info">${nameArea}</div>
      <div class="admin-row__actions">
        <label class="admin-toggle">
          <input type="checkbox" data-name="${escapeHtml(poster.name)}" ${poster.enabled ? "checked" : ""} />
          ${poster.enabled ? "Habilitado" : "Desabilitado"}
        </label>
        <button type="button" class="admin-delete" data-delete="${escapeHtml(poster.name)}">Excluir</button>
      </div>
    </article>
  `;
}

function renderPosters(posters) {
  if (!posters.length) {
    renderMessage("Nenhum cartaz cadastrado ainda. Envie o primeiro acima.");
    return;
  }

  const disabled = posters.filter((poster) => !poster.enabled);
  const enabled = posters.filter((poster) => poster.enabled);

  const disabledRows = disabled
    .map((poster, index) =>
      renderRow(poster, {
        isFirstInGroup: index === 0,
        isLastInGroup: index === disabled.length - 1,
        positionLabel: null
      })
    )
    .join("");
  // Numeracao pensada para bater com a antiga convencao de nome de arquivo:
  // o primeiro da galeria (topo) recebe o maior numero, o ultimo recebe 1.
  const enabledRows = enabled
    .map((poster, index) =>
      renderRow(poster, {
        isFirstInGroup: index === 0,
        isLastInGroup: index === enabled.length - 1,
        positionLabel: enabled.length - index
      })
    )
    .join("");

  const sections = [];
  if (disabled.length) {
    sections.push(`<h3 class="admin-group-title">Desabilitados (${disabled.length})</h3>${disabledRows}`);
  }
  if (enabled.length) {
    sections.push(`<h3 class="admin-group-title">Habilitados (${enabled.length})</h3>${enabledRows}`);
  }

  adminGallery.innerHTML = sections.join("");
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

async function handleRenameSubmit(event) {
  const form = event.target.closest("form[data-rename-form]");
  if (!form) {
    return;
  }
  event.preventDefault();

  const name = form.dataset.renameForm;
  const input = form.querySelector("[data-rename-input]");
  const newName = input.value.trim();

  if (!newName || newName === name) {
    renamingName = null;
    loadPosters();
    return;
  }

  try {
    const response = await fetch("/api/admin/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, newName })
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Falha ao renomear cartaz.");
    }

    renamingName = null;
    setUploadStatus("Cartaz renomeado com sucesso.", "success");
    renderPosters(data.posters || []);
  } catch (error) {
    setUploadStatus(error.message, "error");
  }
}

async function handleReorder(button) {
  const name = button.dataset.reorderName;
  const direction = button.dataset.reorder;

  try {
    const response = await fetch("/api/admin/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, direction })
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Falha ao reordenar cartaz.");
    }

    renderPosters(data.posters || []);
  } catch (error) {
    setUploadStatus(error.message, "error");
  }
}

function handleGalleryClick(event) {
  const reorderButton = event.target.closest("button[data-reorder]");
  if (reorderButton) {
    handleReorder(reorderButton);
    return;
  }

  const renameStart = event.target.closest("button[data-rename-start]");
  if (renameStart) {
    renamingName = renameStart.dataset.renameStart;
    loadPosters();
    return;
  }

  const renameCancel = event.target.closest("button[data-rename-cancel]");
  if (renameCancel) {
    renamingName = null;
    loadPosters();
    return;
  }

  const preview = event.target.closest("[data-preview]");
  if (preview) {
    openLightbox(preview.dataset.preview, preview.dataset.title);
    return;
  }

  handleDelete(event);
}

uploadForm.addEventListener("submit", toggleUpload);
refreshButton.addEventListener("click", loadPosters);
adminGallery.addEventListener("change", handleToggle);
adminGallery.addEventListener("click", handleGalleryClick);
adminGallery.addEventListener("submit", handleRenameSubmit);
logoutButton.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login.html";
});

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lightbox.hidden) {
    closeLightbox();
  }
});

loadPosters();
