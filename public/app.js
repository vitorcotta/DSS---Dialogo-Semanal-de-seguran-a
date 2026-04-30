const gallery = document.getElementById("gallery");
const refreshButton = document.getElementById("refreshButton");

function sanitizeTitle(fileName) {
  return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ");
}

function renderMessage(text) {
  gallery.innerHTML = `<div class="message">${text}</div>`;
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
        <img src="${poster.src}" alt="Cartaz DSS: ${sanitizeTitle(poster.name)}" loading="lazy" />
        <p class="card__title">${sanitizeTitle(poster.name)}</p>
      </article>
    `
    )
    .join("");

  gallery.innerHTML = cards;
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

setInterval(loadPosters, 15000);
loadPosters();
