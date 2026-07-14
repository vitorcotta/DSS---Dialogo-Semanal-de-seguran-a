const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const multer = require("multer");

const app = express();
const port = process.env.PORT || 8050;

const imagesDirectory = path.join(__dirname, "imagens");
const dataDirectory = path.join(__dirname, "data");
const stateFile = path.join(dataDirectory, "state.json");
const pollsFile = path.join(dataDirectory, "polls.json");
const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const VOTER_COOKIE_NAME = "dss_voter";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "dss@admin";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    "[AVISO] ADMIN_PASSWORD nao definido. Usando senha padrao insegura. " +
      "Defina ADMIN_USERNAME e ADMIN_PASSWORD nas variaveis de ambiente antes de publicar."
  );
}

function extractLeadingNumber(fileName) {
  const match = fileName.match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : Number.NEGATIVE_INFINITY;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
  } catch (error) {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function loadPolls() {
  try {
    return JSON.parse(fs.readFileSync(pollsFile, "utf-8"));
  } catch (error) {
    return {};
  }
}

function savePolls(polls) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(pollsFile, JSON.stringify(polls, null, 2));
}

// Cookie simples e proprio para identificar o navegador de quem vota, sem
// depender do express-session (que e voltado para a sessao do admin) nem de
// uma dependencia extra so para ler um cookie.
function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) {
    return cookies;
  }
  header.split(";").forEach((pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
  });
  return cookies;
}

function getVoterSecret(req, res) {
  const cookies = parseCookies(req);
  if (cookies[VOTER_COOKIE_NAME]) {
    return cookies[VOTER_COOKIE_NAME];
  }

  const secret = crypto.randomBytes(16).toString("hex");
  const maxAgeSeconds = 60 * 60 * 24 * 365;
  res.setHeader(
    "Set-Cookie",
    `${VOTER_COOKIE_NAME}=${secret}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax`
  );
  return secret;
}

function hashVote(voterSecret, pollId) {
  return crypto.createHash("sha256").update(`${voterSecret}:${pollId}`).digest("hex");
}

async function resolvePollCandidates(candidateNames) {
  const posters = await listPosters({ forAdmin: true });
  const byName = new Map(posters.map((poster) => [poster.name, poster]));

  return candidateNames.map((name) => {
    const poster = byName.get(name);
    if (!poster) {
      return { name, src: null, missing: true, enabled: false };
    }
    return { name, src: poster.src, missing: false, enabled: poster.enabled };
  });
}

function computePollWinner(poll) {
  const entries = Object.entries(poll.votes);
  const maxVotes = Math.max(...entries.map(([, count]) => count));

  if (maxVotes === 0) {
    return { winner: null };
  }

  const top = entries.filter(([, count]) => count === maxVotes).map(([name]) => name);
  if (top.length > 1) {
    return { winner: null, tied: top };
  }

  return { winner: top[0] };
}

async function buildPollView(poll, req, { voterSecretOverride, includeTotalWhileOpen = false } = {}) {
  const candidates = await resolvePollCandidates(poll.candidates);
  const voterSecret = voterSecretOverride || parseCookies(req)[VOTER_COOKIE_NAME];
  const hasVoted = Boolean(voterSecret) && poll.voterHashes.includes(hashVote(voterSecret, poll.id));

  const view = {
    id: poll.id,
    question: poll.question,
    status: poll.status,
    candidates,
    hasVoted,
    createdAt: poll.createdAt,
    closedAt: poll.closedAt
  };

  // Enquanto a votacao esta aberta, a quebra de votos por opcao fica escondida
  // (mesmo do admin) para nao influenciar quem ainda vai votar. O admin pode,
  // opcionalmente, acompanhar apenas o total agregado de votos ja recebidos.
  if (poll.status === "closed") {
    const { winner, tied } = computePollWinner(poll);
    view.votes = poll.votes;
    view.winner = winner;
    if (tied) {
      view.tied = tied;
    }
  } else if (includeTotalWhileOpen) {
    view.totalVotes = Object.values(poll.votes).reduce((sum, count) => sum + count, 0);
  }

  return view;
}

function legacyCompare(a, b) {
  const numberA = extractLeadingNumber(a);
  const numberB = extractLeadingNumber(b);

  if (numberA !== numberB) {
    return numberB - numberA;
  }

  return b.localeCompare(a, "pt-BR");
}

// Atribui um numero de ordem explicito (independente do nome do arquivo) para
// qualquer cartaz que ainda nao tenha um. Cartazes ja existentes antes desta
// funcionalidade recebem a ordem equivalente a antiga ordenacao por numero no
// nome, entao a galeria nao muda de posicao na primeira execucao.
function ensureOrders(state, fileNames) {
  const existingOrders = fileNames
    .map((name) => (state[name] && typeof state[name].order === "number" ? state[name].order : null))
    .filter((value) => value !== null);
  let nextOrder = existingOrders.length ? Math.max(...existingOrders) + 1 : 0;

  const missing = fileNames.filter((name) => !state[name] || typeof state[name].order !== "number");
  if (!missing.length) {
    return false;
  }

  missing.sort(legacyCompare);
  missing.forEach((name) => {
    if (!state[name]) {
      state[name] = { enabled: true };
    }
    if (typeof state[name].enabled !== "boolean") {
      state[name].enabled = true;
    }
    state[name].order = nextOrder;
    nextOrder += 1;
  });

  return true;
}

function toClientPoster({ order, ...poster }) {
  return poster;
}

async function listPosters({ forAdmin = false } = {}) {
  const files = await fs.promises.readdir(imagesDirectory, { withFileTypes: true });
  const fileNames = files
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => allowedExtensions.has(path.extname(fileName).toLowerCase()));

  const state = loadState();
  if (ensureOrders(state, fileNames)) {
    saveState(state);
  }

  const posters = fileNames.map((fileName) => ({
    name: fileName,
    src: `/imagens/${encodeURIComponent(fileName)}`,
    enabled: state[fileName].enabled !== false,
    order: state[fileName].order
  }));

  if (forAdmin) {
    // No painel, cartazes desabilitados sempre aparecem primeiro (para facilitar
    // a preparacao/publicacao), ordenados pela ordem manual dentro de cada grupo.
    return posters.sort((a, b) => {
      if (a.enabled !== b.enabled) {
        return a.enabled ? 1 : -1;
      }
      return a.order - b.order;
    });
  }

  return posters.filter((poster) => poster.enabled).sort((a, b) => a.order - b.order);
}

function timingSafeEqual(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  if (bufferA.length !== bufferB.length) {
    // Ainda compara para nao vazar tamanho via timing, mas sempre falha.
    crypto.timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function requirePageAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.redirect("/login.html");
}

function requireApiAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ message: "Nao autenticado." });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, imagesDirectory),
    filename: (_req, file, cb) => {
      // Busboy/Multer decodificam o nome do multipart como latin1 mesmo quando o
      // navegador envia UTF-8, entao e preciso reconverter antes de usar o nome.
      // O resultado pode vir em NFD (acentos como marca combinavel separada, comum
      // no macOS), entao normalizamos para NFC antes de filtrar caracteres.
      const originalName = Buffer.from(file.originalname, "latin1").toString("utf8").normalize("NFC");
      const ext = path.extname(originalName).toLowerCase();
      const base =
        path
          .basename(originalName, path.extname(originalName))
          .replace(/[^a-zA-Z0-9\-_ À-ÿ]/g, "")
          .trim() || "cartaz";

      let finalName = `${base}${ext}`;
      let counter = 1;
      while (fs.existsSync(path.join(imagesDirectory, finalName))) {
        finalName = `${base} (${counter})${ext}`;
        counter += 1;
      }
      cb(null, finalName);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      return cb(new Error("Formato de arquivo nao suportado."));
    }
    cb(null, true);
  }
});

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use("/imagens", express.static(imagesDirectory));
app.use(express.static(path.join(__dirname, "public")));

// --- Autenticacao ---

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};

  if (
    typeof username === "string" &&
    typeof password === "string" &&
    timingSafeEqual(username, ADMIN_USERNAME) &&
    timingSafeEqual(password, ADMIN_PASSWORD)
  ) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }

  return res.status(401).json({ message: "Usuario ou senha invalidos." });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/session", (req, res) => {
  res.json({ authenticated: Boolean(req.session && req.session.authenticated) });
});

// --- Galeria publica ---

app.get("/api/cartazes", async (_req, res) => {
  try {
    const posters = (await listPosters()).map(toClientPoster);
    res.json({ total: posters.length, posters });
  } catch (error) {
    res.status(500).json({
      message: "Nao foi possivel carregar os cartazes.",
      details: error.message
    });
  }
});

// --- Votacoes (publico) ---

app.get("/votar/:id", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "votar.html"));
});

app.get("/api/polls/:id", async (req, res) => {
  const polls = loadPolls();
  const poll = polls[req.params.id];

  if (!poll) {
    return res.status(404).json({ message: "Votacao nao encontrada." });
  }

  const view = await buildPollView(poll, req);
  res.json(view);
});

app.post("/api/polls/:id/vote", async (req, res) => {
  const polls = loadPolls();
  const poll = polls[req.params.id];

  if (!poll) {
    return res.status(404).json({ message: "Votacao nao encontrada." });
  }
  if (poll.status !== "open") {
    return res.status(409).json({ message: "Esta votacao ja foi encerrada." });
  }

  const { name } = req.body || {};
  if (typeof name !== "string" || !poll.candidates.includes(name)) {
    return res.status(400).json({ message: "Opcao invalida." });
  }

  const voterSecret = getVoterSecret(req, res);
  const voteHash = hashVote(voterSecret, poll.id);

  if (poll.voterHashes.includes(voteHash)) {
    return res.status(409).json({ message: "Voce ja votou nesta votacao." });
  }

  poll.votes[name] = (poll.votes[name] || 0) + 1;
  poll.voterHashes.push(voteHash);
  savePolls(polls);

  const view = await buildPollView(poll, req, { voterSecretOverride: voterSecret });
  res.json(view);
});

// --- Painel administrativo ---

app.get("/admin", requirePageAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});
app.use("/admin", requirePageAuth, express.static(path.join(__dirname, "admin")));

app.get("/api/admin/cartazes", requireApiAuth, async (_req, res) => {
  try {
    const posters = (await listPosters({ forAdmin: true })).map(toClientPoster);
    res.json({ total: posters.length, posters });
  } catch (error) {
    res.status(500).json({
      message: "Nao foi possivel carregar os cartazes.",
      details: error.message
    });
  }
});

app.post("/api/admin/upload", requireApiAuth, (req, res) => {
  upload.array("images", 20)(req, res, async (error) => {
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: "Nenhum arquivo enviado." });
    }

    const state = loadState();
    files.forEach((file) => {
      state[file.filename] = { enabled: false };
    });
    saveState(state);

    const posters = (await listPosters({ forAdmin: true })).map(toClientPoster);
    res.json({ total: posters.length, posters });
  });
});

app.post("/api/admin/toggle", requireApiAuth, async (req, res) => {
  const { name, enabled } = req.body || {};

  if (typeof name !== "string" || path.basename(name) !== name) {
    return res.status(400).json({ message: "Nome de arquivo invalido." });
  }

  const filePath = path.join(imagesDirectory, name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Cartaz nao encontrado." });
  }

  // Garante que todo cartaz ja tenha uma ordem persistida antes de mexer no estado.
  await listPosters();

  const state = loadState();
  const wasEnabled = state[name] ? state[name].enabled !== false : false;
  const nextEnabled = Boolean(enabled);

  if (nextEnabled && !wasEnabled) {
    // Ao habilitar um cartaz, ele deve entrar como o primeiro da galeria publica.
    const enabledOrders = Object.entries(state)
      .filter(([fileName, entry]) => fileName !== name && entry.enabled !== false && typeof entry.order === "number")
      .map(([, entry]) => entry.order);
    const minOrder = enabledOrders.length ? Math.min(...enabledOrders) : 0;
    state[name] = { ...state[name], enabled: true, order: minOrder - 1 };
  } else {
    state[name] = { ...state[name], enabled: nextEnabled };
  }

  saveState(state);

  const posters = (await listPosters({ forAdmin: true })).map(toClientPoster);
  res.json({ total: posters.length, posters });
});

app.post("/api/admin/reorder", requireApiAuth, async (req, res) => {
  const { name, direction } = req.body || {};

  if (typeof name !== "string" || path.basename(name) !== name) {
    return res.status(400).json({ message: "Nome de arquivo invalido." });
  }
  if (direction !== "up" && direction !== "down") {
    return res.status(400).json({ message: "Direcao invalida." });
  }

  const filePath = path.join(imagesDirectory, name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Cartaz nao encontrado." });
  }

  const posters = await listPosters({ forAdmin: true });
  const target = posters.find((poster) => poster.name === name);
  if (!target) {
    return res.status(404).json({ message: "Cartaz nao encontrado." });
  }

  // Reordena apenas dentro do mesmo grupo (habilitados ou desabilitados), ja
  // que a lista admin sempre mostra desabilitados primeiro.
  const group = posters.filter((poster) => poster.enabled === target.enabled);
  const index = group.findIndex((poster) => poster.name === name);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  const neighbor = group[neighborIndex];

  if (neighbor) {
    const state = loadState();
    const targetOrder = state[name].order;
    state[name].order = state[neighbor.name].order;
    state[neighbor.name].order = targetOrder;
    saveState(state);
  }

  const updated = (await listPosters({ forAdmin: true })).map(toClientPoster);
  res.json({ total: updated.length, posters: updated });
});

app.post("/api/admin/rename", requireApiAuth, async (req, res) => {
  const { name, newName } = req.body || {};

  if (typeof name !== "string" || path.basename(name) !== name) {
    return res.status(400).json({ message: "Nome de arquivo invalido." });
  }
  if (typeof newName !== "string" || !newName.trim()) {
    return res.status(400).json({ message: "Informe o novo nome do arquivo." });
  }

  const filePath = path.join(imagesDirectory, name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Cartaz nao encontrado." });
  }

  const originalExt = path.extname(name).toLowerCase();
  const requestedExt = path.extname(newName).toLowerCase();
  const hasValidRequestedExt = allowedExtensions.has(requestedExt);
  const finalExt = hasValidRequestedExt ? requestedExt : originalExt;
  const baseName = (hasValidRequestedExt ? path.basename(newName, requestedExt) : newName)
    .normalize("NFC")
    .replace(/[^a-zA-Z0-9\-_ À-ÿ]/g, "")
    .trim();

  if (!baseName) {
    return res.status(400).json({ message: "Nome invalido apos remover caracteres nao suportados." });
  }

  const finalName = `${baseName}${finalExt}`;

  if (finalName === name) {
    const posters = (await listPosters({ forAdmin: true })).map(toClientPoster);
    return res.json({ total: posters.length, posters });
  }

  const newPath = path.join(imagesDirectory, finalName);
  if (fs.existsSync(newPath)) {
    return res.status(409).json({ message: "Ja existe um cartaz com esse nome." });
  }

  await fs.promises.rename(filePath, newPath);

  const state = loadState();
  if (Object.prototype.hasOwnProperty.call(state, name)) {
    state[finalName] = state[name];
    delete state[name];
    saveState(state);
  }

  const posters = (await listPosters({ forAdmin: true })).map(toClientPoster);
  res.json({ total: posters.length, posters });
});

app.delete("/api/admin/cartazes/:name", requireApiAuth, async (req, res) => {
  const { name } = req.params;

  if (typeof name !== "string" || path.basename(name) !== name) {
    return res.status(400).json({ message: "Nome de arquivo invalido." });
  }

  const filePath = path.join(imagesDirectory, name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Cartaz nao encontrado." });
  }

  await fs.promises.unlink(filePath);

  const state = loadState();
  delete state[name];
  saveState(state);

  const posters = (await listPosters({ forAdmin: true })).map(toClientPoster);
  res.json({ total: posters.length, posters });
});

// --- Votacoes (admin) ---

app.get("/api/admin/polls", requireApiAuth, async (req, res) => {
  const polls = Object.values(loadPolls()).sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "open" ? -1 : 1;
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const views = await Promise.all(
    polls.map((poll) => buildPollView(poll, req, { includeTotalWhileOpen: true }))
  );
  res.json({ total: views.length, polls: views });
});

app.post("/api/admin/polls", requireApiAuth, async (req, res) => {
  const { question, candidates } = req.body || {};

  if (!Array.isArray(candidates)) {
    return res.status(400).json({ message: "Selecione entre 2 e 4 cartazes." });
  }

  const uniqueCandidates = [...new Set(candidates)];
  if (uniqueCandidates.length < 2 || uniqueCandidates.length > 4) {
    return res.status(400).json({ message: "Selecione entre 2 e 4 cartazes." });
  }
  if (uniqueCandidates.some((name) => typeof name !== "string" || path.basename(name) !== name)) {
    return res.status(400).json({ message: "Nome de arquivo invalido." });
  }

  const posters = await listPosters({ forAdmin: true });
  const postersByName = new Map(posters.map((poster) => [poster.name, poster]));

  for (const name of uniqueCandidates) {
    const poster = postersByName.get(name);
    if (!poster) {
      return res.status(404).json({ message: `Cartaz nao encontrado: ${name}` });
    }
    if (poster.enabled) {
      return res.status(400).json({ message: `Apenas cartazes desabilitados podem entrar na votacao: ${name}` });
    }
  }

  const polls = loadPolls();
  const id = crypto.randomBytes(20).toString("hex");
  const votes = {};
  uniqueCandidates.forEach((name) => {
    votes[name] = 0;
  });

  polls[id] = {
    id,
    question: typeof question === "string" && question.trim() ? question.trim() : "Qual sera o proximo assunto?",
    candidates: uniqueCandidates,
    votes,
    voterHashes: [],
    status: "open",
    createdAt: new Date().toISOString(),
    closedAt: null
  };
  savePolls(polls);

  const view = await buildPollView(polls[id], req, { includeTotalWhileOpen: true });
  res.status(201).json(view);
});

app.post("/api/admin/polls/:id/close", requireApiAuth, async (req, res) => {
  const polls = loadPolls();
  const poll = polls[req.params.id];

  if (!poll) {
    return res.status(404).json({ message: "Votacao nao encontrada." });
  }

  if (poll.status !== "closed") {
    poll.status = "closed";
    poll.closedAt = new Date().toISOString();
    savePolls(polls);
  }

  const view = await buildPollView(poll, req, { includeTotalWhileOpen: true });
  res.json(view);
});

app.delete("/api/admin/polls/:id", requireApiAuth, (req, res) => {
  const polls = loadPolls();

  if (!polls[req.params.id]) {
    return res.status(404).json({ message: "Votacao nao encontrada." });
  }

  delete polls[req.params.id];
  savePolls(polls);
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Servidor DSS iniciado na porta ${port}`);
});
