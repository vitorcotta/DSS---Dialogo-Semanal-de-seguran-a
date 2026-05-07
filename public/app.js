const gallery = document.getElementById("gallery");
const refreshButton = document.getElementById("refreshButton");
const lightbox = document.getElementById("lightbox");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxViewport = document.getElementById("lightboxViewport");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxTitle = document.getElementById("lightboxTitle");
const lightboxZoomLevels = [1, 1.5, 2, 3];
let lightboxZoomIndex = 0;

function sanitizeTitle(fileName) {
  return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ");
}

function renderMessage(text) {
  gallery.innerHTML = `<div class="message">${text}</div>`;
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

loadPosters();
