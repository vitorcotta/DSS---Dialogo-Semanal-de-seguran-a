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

const pollList = document.getElementById("pollList");
const refreshPollsButton = document.getElementById("refreshPollsButton");
const pollCreateBar = document.getElementById("pollCreateBar");
const pollSelectedCount = document.getElementById("pollSelectedCount");
const pollCreateButton = document.getElementById("pollCreateButton");
const pollCreateStatus = document.getElementById("pollCreateStatus");

let renamingName = null;
const selectedCandidates = new Set();

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
        ${
          poster.enabled
            ? ""
            : `
          <label class="admin-toggle" title="Selecionar para votacao">
            <input
              type="checkbox"
              data-poll-candidate="${escapeHtml(poster.name)}"
              ${selectedCandidates.has(poster.name) ? "checked" : ""}
            />
            Votacao
          </label>
        `
        }
        <label class="admin-toggle">
          <input type="checkbox" data-name="${escapeHtml(poster.name)}" ${poster.enabled ? "checked" : ""} />
          ${poster.enabled ? "Habilitado" : "Desabilitado"}
        </label>
        <button type="button" class="admin-delete" data-delete="${escapeHtml(poster.name)}">Excluir</button>
      </div>
    </article>
  `;
}

function updatePollSelectionUI() {
  const count = selectedCandidates.size;
  pollCreateBar.hidden = count === 0;
  pollSelectedCount.textContent = `${count} selecionado${count === 1 ? "" : "s"} (min. 2, max. 4)`;
  pollCreateButton.disabled = count < 2 || count > 4;
}

function renderPosters(posters) {
  // Remove da selecao qualquer cartaz que nao esteja mais disponivel/desabilitado.
  const disabledNames = new Set(posters.filter((poster) => !poster.enabled).map((poster) => poster.name));
  Array.from(selectedCandidates).forEach((name) => {
    if (!disabledNames.has(name)) {
      selectedCandidates.delete(name);
    }
  });
  updatePollSelectionUI();

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

function handlePollCandidateChange(event) {
  const checkbox = event.target.closest("input[data-poll-candidate]");
  if (!checkbox) {
    return false;
  }

  const name = checkbox.dataset.pollCandidate;
  if (checkbox.checked) {
    selectedCandidates.add(name);
  } else {
    selectedCandidates.delete(name);
  }
  updatePollSelectionUI();
  return true;
}

async function handleToggle(event) {
  if (handlePollCandidateChange(event)) {
    return;
  }

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

function renderPollCard(poll) {
  const statusLabel = poll.status === "open" ? "Em andamento" : "Encerrada";
  const link = `${window.location.origin}/votar/${poll.id}`;

  const candidatesHtml = poll.candidates
    .map((candidate) => {
      const title = candidate.missing ? "Cartaz removido/renomeado" : sanitizeTitle(candidate.name);
      const thumb = candidate.missing
        ? `<div class="poll-card__thumb poll-card__thumb--missing" title="${escapeHtml(title)}"></div>`
        : `<img class="poll-card__thumb" src="${candidate.src}" alt="Cartaz DSS: ${escapeHtml(title)}" loading="lazy" />`;

      let barHtml = "";
      if (poll.status === "closed") {
        const totalVotes = Object.values(poll.votes).reduce((sum, count) => sum + count, 0);
        const count = poll.votes[candidate.name] || 0;
        const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
        const isWinner = poll.winner === candidate.name;
        barHtml = `
          <div class="poll-card__bar-track">
            <div class="poll-card__bar ${isWinner ? "poll-card__bar--winner" : ""}" style="width:${pct}%"></div>
          </div>
          <span class="poll-card__votes">${count} voto${count === 1 ? "" : "s"} (${pct}%)</span>
        `;
      }

      return `
        <div class="poll-card__candidate">
          ${thumb}
          <p class="poll-card__candidate-title">${escapeHtml(title)}</p>
          ${barHtml}
        </div>
      `;
    })
    .join("");

  let actionHtml = "";
  if (poll.status === "open") {
    actionHtml = `<button type="button" class="poll-card__close" data-close-poll="${poll.id}">Encerrar votacao</button>`;
  } else if (poll.tied) {
    actionHtml = `<p class="poll-card__tie">Empate — habilite manualmente na lista acima.</p>`;
  } else if (poll.winner) {
    const winnerCandidate = poll.candidates.find((candidate) => candidate.name === poll.winner);
    if (winnerCandidate && winnerCandidate.missing) {
      actionHtml = `<p class="poll-card__tie">O cartaz vencedor foi removido/renomeado — nao e possivel habilitar automaticamente.</p>`;
    } else if (winnerCandidate && winnerCandidate.enabled) {
      actionHtml = `<button type="button" class="poll-card__enable" disabled>Ja habilitado</button>`;
    } else {
      actionHtml = `
        <button type="button" class="poll-card__enable" data-enable-winner="${escapeHtml(poll.winner)}">
          Habilitar ${escapeHtml(sanitizeTitle(poll.winner))}
        </button>
      `;
    }
  } else {
    actionHtml = `<p class="poll-card__tie">Ninguem votou ainda.</p>`;
  }

  return `
    <article class="poll-card">
      <div class="poll-card__header">
        <div>
          <p class="poll-card__question">${escapeHtml(poll.question)}</p>
          <span class="poll-card__status poll-card__status--${poll.status}">${statusLabel}</span>
        </div>
        <button type="button" class="poll-card__delete" data-delete-poll="${poll.id}">Excluir</button>
      </div>
      <div class="poll-card__link-row">
        <input type="text" class="poll-card__link" value="${escapeHtml(link)}" readonly />
        <button type="button" class="poll-card__copy" data-copy-link="${escapeHtml(link)}">Copiar link</button>
      </div>
      <div class="poll-card__candidates">${candidatesHtml}</div>
      <div class="poll-card__actions">${actionHtml}</div>
    </article>
  `;
}

function renderPolls(polls) {
  if (!polls.length) {
    pollList.innerHTML = '<div class="message">Nenhuma votacao criada ainda.</div>';
    return;
  }
  pollList.innerHTML = polls.map(renderPollCard).join("");
}

async function loadPolls() {
  try {
    const response = await fetch("/api/admin/polls", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    if (!response.ok) {
      throw new Error("Falha ao consultar as votacoes.");
    }

    const data = await response.json();
    renderPolls(data.polls || []);
  } catch (error) {
    pollList.innerHTML = `<div class="message">Erro ao carregar votacoes: ${escapeHtml(error.message)}</div>`;
  }
}

async function handleCreatePoll() {
  if (selectedCandidates.size < 2 || selectedCandidates.size > 4) {
    return;
  }

  pollCreateButton.disabled = true;
  pollCreateStatus.textContent = "Criando votacao...";
  pollCreateStatus.className = "admin-status";

  try {
    const response = await fetch("/api/admin/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates: Array.from(selectedCandidates) })
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Falha ao criar votacao.");
    }

    selectedCandidates.clear();
    pollCreateStatus.textContent = "Votacao criada com sucesso.";
    pollCreateStatus.className = "admin-status admin-status--success";
    loadPosters();
    loadPolls();
  } catch (error) {
    pollCreateStatus.textContent = error.message;
    pollCreateStatus.className = "admin-status admin-status--error";
  } finally {
    updatePollSelectionUI();
  }
}

async function handleClosePoll(id) {
  try {
    const response = await fetch(`/api/admin/polls/${encodeURIComponent(id)}/close`, { method: "POST" });
    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Falha ao encerrar votacao.");
    }
    loadPolls();
  } catch (error) {
    pollCreateStatus.textContent = error.message;
    pollCreateStatus.className = "admin-status admin-status--error";
  }
}

async function handleDeletePoll(id) {
  if (!window.confirm("Excluir esta votacao? Os votos serao perdidos.")) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/polls/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Falha ao excluir votacao.");
    }
    loadPolls();
  } catch (error) {
    pollCreateStatus.textContent = error.message;
    pollCreateStatus.className = "admin-status admin-status--error";
  }
}

async function handleEnableWinner(name) {
  try {
    const response = await fetch("/api/admin/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, enabled: true })
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Falha ao habilitar cartaz.");
    }

    loadPosters();
    loadPolls();
  } catch (error) {
    pollCreateStatus.textContent = error.message;
    pollCreateStatus.className = "admin-status admin-status--error";
  }
}

function handlePollListClick(event) {
  const closeButton = event.target.closest("button[data-close-poll]");
  if (closeButton) {
    handleClosePoll(closeButton.dataset.closePoll);
    return;
  }

  const deleteButton = event.target.closest("button[data-delete-poll]");
  if (deleteButton) {
    handleDeletePoll(deleteButton.dataset.deletePoll);
    return;
  }

  const enableButton = event.target.closest("button[data-enable-winner]");
  if (enableButton) {
    handleEnableWinner(enableButton.dataset.enableWinner);
    return;
  }

  const copyButton = event.target.closest("button[data-copy-link]");
  if (copyButton) {
    navigator.clipboard
      .writeText(copyButton.dataset.copyLink)
      .then(() => {
        const original = copyButton.textContent;
        copyButton.textContent = "Copiado!";
        setTimeout(() => {
          copyButton.textContent = original;
        }, 1500);
      })
      .catch(() => {});
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

refreshPollsButton.addEventListener("click", loadPolls);
pollCreateButton.addEventListener("click", handleCreatePoll);
pollList.addEventListener("click", handlePollListClick);

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
loadPolls();
