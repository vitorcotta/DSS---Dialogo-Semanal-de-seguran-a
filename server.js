const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 8050;

const imagesDirectory = path.join(__dirname, "imagens");
const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function extractLeadingNumber(fileName) {
  const match = fileName.match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : Number.NEGATIVE_INFINITY;
}

app.use("/imagens", express.static(imagesDirectory));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/cartazes", async (_req, res) => {
  try {
    const files = await fs.promises.readdir(imagesDirectory, { withFileTypes: true });
    const posters = files
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
        src: `/imagens/${encodeURIComponent(fileName)}`
      }));

    res.json({
      total: posters.length,
      posters
    });
  } catch (error) {
    res.status(500).json({
      message: "Nao foi possivel carregar os cartazes.",
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Servidor DSS iniciado na porta ${port}`);
});
