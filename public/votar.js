const votarQuestion = document.getElementById("votarQuestion");
const votarMessage = document.getElementById("votarMessage");
const votarOptions = document.getElementById("votarOptions");
const votarSubmit = document.getElementById("votarSubmit");

const lightbox = document.getElementById("lightbox");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxViewport = document.getElementById("lightboxViewport");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxTitle = document.getElementById("lightboxTitle");
const lightboxZoomLevels = [1, 1.5, 2, 3];
let lightboxZoomIndex = 0;

const pollId = window.location.pathname.split("/").filter(Boolean).pop();

let selectedName = null;

function sanitizeTitle(fileName) {
  return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ");
}

function getFittedImageSize() {
  const naturalWidth = lightboxImage.naturalWidth || 1;
  const naturalHeight = lightboxImage.naturalHeight || 1;
  const maxWidth = Math.min(window.innerWidth * 0.96, 1200);
  const reservedHeight = lightboxClose.offsetHeight + lightboxTitle.offsetHeight + 48;
  const maxHeight = Math.min(window.innerHeight * 0.82, window.innerHeight - reservedHeight);
  const fitScale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);

  return {
    width: naturalWidth * fitScale,
    height: naturalHeight * fitScale
  };
}

function applyLightboxZoom() {
  const zoom = lightboxZoomLevels[lightboxZoomIndex];
  const { width, height } = getFittedImageSize();

  lightboxViewport.style.width = `${width}px`;
  lightboxViewport.style.height = `${height}px`;
  lightboxImage.style.width = `${width * zoom}px`;
  lightboxImage.style.height = `${height * zoom}px`;
  lightboxImage.classList.toggle("lightbox__image--zoomed", zoom > 1);
  lightboxViewport.classList.toggle("lightbox__viewport--zoomed", zoom > 1);

  if (zoom === 1) {
    lightboxViewport.scrollTo({ left: 0, top: 0 });
  }
}

function resetLightboxZoom() {
  lightboxZoomIndex = 0;
  applyLightboxZoom();
}

function openLightbox(src, title) {
  lightboxImage.src = src;
  lightboxImage.alt = `Cartaz ampliado: ${title}`;
  lightboxImage.onload = () => resetLightboxZoom();
  lightboxTitle.textContent = title;
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.hidden = true;
  resetLightboxZoom();
  lightboxViewport.scrollTo({ left: 0, top: 0 });
  lightboxImage.src = "";
  lightboxTitle.textContent = "";
  document.body.style.overflow = "";
}

function renderResults(poll) {
  const totalVotes = Object.values(poll.votes || {}).reduce((sum, count) => sum + count, 0);

  votarOptions.innerHTML = poll.candidates
    .map((candidate) => {
      const title = candidate.missing ? "Cartaz removido" : sanitizeTitle(candidate.name);
      const count = (poll.votes && poll.votes[candidate.name]) || 0;
      const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
      const isWinner = poll.winner === candidate.name;
      const thumb = candidate.missing
        ? `<div class="votar-option__thumb votar-option__thumb--missing"></div>`
        : `
          <button type="button" class="votar-option__preview" data-preview="${candidate.src}" data-title="${title}" title="Ampliar cartaz">
            <img src="${candidate.src}" alt="Cartaz DSS: ${title}" />
          </button>
        `;

      return `
        <div class="votar-option">
          ${thumb}
          <p class="votar-option__title">${title}</p>
          <div class="votar-option__result">
            <div class="votar-option__bar-track">
              <div class="votar-option__bar ${isWinner ? "votar-option__bar--winner" : ""}" style="width:${pct}%"></div>
            </div>
            <p class="votar-option__votes">${count} voto${count === 1 ? "" : "s"} (${pct}%)</p>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderVotingOptions(poll) {
  votarOptions.innerHTML = poll.candidates
    .map((candidate) => {
      const title = candidate.missing ? "Cartaz removido" : sanitizeTitle(candidate.name);
      const thumb = candidate.missing
        ? `<div class="votar-option__thumb votar-option__thumb--missing"></div>`
        : `
          <button type="button" class="votar-option__preview" data-preview="${candidate.src}" data-title="${title}" title="Ver em tela cheia">
            <img src="${candidate.src}" alt="Cartaz DSS: ${title}" />
          </button>
        `;

      return `
        <div class="votar-option" data-option="${candidate.name}">
          ${thumb}
          <p class="votar-option__title">${title}</p>
          ${
            candidate.missing
              ? ""
              : `<button type="button" class="votar-option__select" data-select="${candidate.name}">Selecionar</button>`
          }
        </div>
      `;
    })
    .join("");

  votarSubmit.hidden = false;
  votarSubmit.disabled = true;
}

function handleOptionsClick(event) {
  const preview = event.target.closest("[data-preview]");
  if (preview) {
    openLightbox(preview.dataset.preview, preview.dataset.title);
    return;
  }

  const selectButton = event.target.closest("[data-select]");
  if (selectButton) {
    selectedName = selectButton.dataset.select;
    votarOptions.querySelectorAll(".votar-option").forEach((option) => {
      option.classList.toggle("votar-option--selected", option.dataset.option === selectedName);
    });
    votarSubmit.disabled = false;
  }
}

async function submitVote() {
  if (!selectedName) {
    return;
  }

  votarSubmit.disabled = true;
  votarSubmit.textContent = "Votando...";

  try {
    const response = await fetch(`/api/polls/${encodeURIComponent(pollId)}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selectedName })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Falha ao registrar o voto.");
    }

    votarQuestion.textContent = data.question;
    votarMessage.textContent = "Obrigado por votar! O resultado sera divulgado apos o encerramento.";
    votarSubmit.hidden = true;
    votarOptions.innerHTML = "";
  } catch (error) {
    votarMessage.textContent = error.message;
    votarSubmit.disabled = false;
    votarSubmit.textContent = "Votar";
  }
}

async function loadPoll() {
  try {
    const response = await fetch(`/api/polls/${encodeURIComponent(pollId)}`, { cache: "no-store" });

    if (response.status === 404) {
      votarQuestion.textContent = "Votacao nao encontrada";
      votarMessage.textContent = "O link pode estar incorreto ou a votacao foi removida.";
      return;
    }
    if (!response.ok) {
      throw new Error("Falha ao carregar a votacao.");
    }

    const poll = await response.json();
    votarQuestion.textContent = poll.question;

    if (poll.status === "closed") {
      votarMessage.textContent = "Esta votacao foi encerrada. Confira o resultado:";
      renderResults(poll);
      return;
    }

    if (poll.hasVoted) {
      votarMessage.textContent = "Voce ja votou nesta votacao. Obrigado! O resultado sera divulgado apos o encerramento.";
      return;
    }

    votarMessage.textContent = "Toque na imagem para ampliar. Escolha uma opcao e clique em Votar.";
    renderVotingOptions(poll);
  } catch (error) {
    votarQuestion.textContent = "Erro";
    votarMessage.textContent = error.message;
  }
}

votarOptions.addEventListener("click", handleOptionsClick);
votarSubmit.addEventListener("click", submitVote);

lightboxClose.addEventListener("click", closeLightbox);
lightboxImage.addEventListener("click", (event) => {
  event.stopPropagation();
  lightboxZoomIndex = (lightboxZoomIndex + 1) % lightboxZoomLevels.length;
  applyLightboxZoom();
});
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});
window.addEventListener("resize", () => {
  if (!lightbox.hidden) {
    applyLightboxZoom();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lightbox.hidden) {
    closeLightbox();
  }
});

loadPoll();
