const votarQuestion = document.getElementById("votarQuestion");
const votarMessage = document.getElementById("votarMessage");
const votarOptions = document.getElementById("votarOptions");
const votarSubmit = document.getElementById("votarSubmit");

const pollId = window.location.pathname.split("/").filter(Boolean).pop();

let selectedName = null;

function sanitizeTitle(fileName) {
  return fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ");
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
        ? ""
        : `<img src="${candidate.src}" alt="Cartaz DSS: ${title}" />`;

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
        ? ""
        : `<img src="${candidate.src}" alt="Cartaz DSS: ${title}" />`;

      return `
        <button
          type="button"
          class="votar-option"
          data-option="${candidate.name}"
          ${candidate.missing ? "disabled" : ""}
        >
          ${thumb}
          <p class="votar-option__title">${title}</p>
        </button>
      `;
    })
    .join("");

  votarOptions.querySelectorAll("[data-option]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedName = button.dataset.option;
      votarOptions.querySelectorAll(".votar-option").forEach((option) => {
        option.classList.toggle("votar-option--selected", option === button);
      });
      votarSubmit.disabled = false;
    });
  });

  votarSubmit.hidden = false;
  votarSubmit.disabled = true;
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

    votarMessage.textContent = "Escolha uma das opcoes abaixo e clique em Votar.";
    renderVotingOptions(poll);
  } catch (error) {
    votarQuestion.textContent = "Erro";
    votarMessage.textContent = error.message;
  }
}

votarSubmit.addEventListener("click", submitVote);

loadPoll();
