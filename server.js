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
const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

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

async function listPosters() {
  const state = loadState();
  const files = await fs.promises.readdir(imagesDirectory, { withFileTypes: true });

  return files
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => allowedExtensions.has(path.extname(fileName).toLowerCase()))
    .sort((a, b) => {
      const numberA = extractLeadingNumber(a);
      const numberB = extractLeadingNumber(b);

      if (numberA !== numberB) {
        return numberB - numberA;
      }

      return b.localeCompare(a, "pt-BR");
    })
    .map((fileName) => ({
      name: fileName,
      src: `/imagens/${encodeURIComponent(fileName)}`,
      // Imagens ja existentes antes deste painel continuam habilitadas por padrao;
      // novos uploads feitos pelo admin entram desabilitados ate serem publicados.
      enabled: Object.prototype.hasOwnProperty.call(state, fileName) ? state[fileName].enabled !== false : true
    }));
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
    const posters = (await listPosters()).filter((poster) => poster.enabled);
    res.json({ total: posters.length, posters });
  } catch (error) {
    res.status(500).json({
      message: "Nao foi possivel carregar os cartazes.",
      details: error.message
    });
  }
});

// --- Painel administrativo ---

app.get("/admin", requirePageAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});
app.use("/admin", requirePageAuth, express.static(path.join(__dirname, "admin")));

app.get("/api/admin/cartazes", requireApiAuth, async (_req, res) => {
  try {
    const posters = await listPosters();
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

    const posters = await listPosters();
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

  const state = loadState();
  state[name] = { enabled: Boolean(enabled) };
  saveState(state);

  const posters = await listPosters();
  res.json({ total: posters.length, posters });
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
    const posters = await listPosters();
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

  const posters = await listPosters();
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

  const posters = await listPosters();
  res.json({ total: posters.length, posters });
});

app.listen(port, () => {
  console.log(`Servidor DSS iniciado na porta ${port}`);
});
