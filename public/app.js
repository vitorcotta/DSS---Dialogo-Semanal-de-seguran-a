const gallery = document.getElementById("gallery");
const refreshButton = document.getElementById("refreshButton");
const lightbox = document.getElementById("lightbox");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxTitle = document.getElementById("lightboxTitle");
const lightboxZoomLevels = [1, 1.5, 2];
let lightboxZoomIndex = 0;

function sanitizeTitle(fileName) {
  return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ");
}

function renderMessage(text) {
  gallery.innerHTML = `<div class="message">${text}</div>`;
}

function applyLightboxZoom() {
  const zoom = lightboxZoomLevels[lightboxZoomIndex];
  lightboxImage.style.transform = `scale(${zoom})`;
  lightboxImage.classList.toggle("lightbox__image--zoomed", zoom > 1);
}

function resetLightboxZoom() {
  lightboxZoomIndex = 0;
  applyLightboxZoom();
}

function renderPosters(posters) {
  if (!posters.length) {
    renderMessage("Nenhum cartaz encontrado. Adicione imagens na pasta 'imagens/'.");
    return;
  }

  const cards = posters
    .map(
      (poster) => `
      <article class="card">
        <button class="card__preview" type="button" data-src="${poster.src}" data-title="${sanitizeTitle(poster.name)}" aria-label="Ampliar cartaz ${sanitizeTitle(poster.name)}">
          <img src="${poster.src}" alt="Cartaz DSS: ${sanitizeTitle(poster.name)}" loading="lazy" />
        </button>
        <p class="card__title">${sanitizeTitle(poster.name)}</p>
      </article>
    `
    )
    .join("");

  gallery.innerHTML = cards;
}

function openLightbox(src, title) {
  lightboxImage.src = src;
  lightboxImage.alt = `Cartaz ampliado: ${title}`;
  resetLightboxZoom();
  lightboxTitle.textContent = title;
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.hidden = true;
  resetLightboxZoom();
  lightboxImage.src = "";
  lightboxTitle.textContent = "";
  document.body.style.overflow = "";
}

async function loadPosters() {
  renderMessage("Carregando cartazes...");

  try {
    const response = await fetch("/api/cartazes", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Falha ao consultar os cartazes.");
    }

    const data = await response.json();
    renderPosters(data.posters || []);
  } catch (error) {
    renderMessage(`Erro ao carregar os cartazes: ${error.message}`);
  }
}

refreshButton.addEventListener("click", loadPosters);
gallery.addEventListener("click", (event) => {
  const button = event.target.closest(".card__preview");
  if (!button) {
    return;
  }

  openLightbox(button.dataset.src, button.dataset.title);
});
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
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lightbox.hidden) {
    closeLightbox();
  }
});

loadPosters();
