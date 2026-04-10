const express = require("express");
const path = require("path");
const { dbPath, getWorkspace, saveWorkspace } = require("./db");

const app = express();
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "0.0.0.0";
const distDir = path.join(__dirname, "dist");

app.use(express.json({ limit: "20mb" }));
app.use(express.static(distDir));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, dbPath });
});

app.get("/api/workspace", (_request, response) => {
  response.json(getWorkspace());
});

app.put("/api/workspace", (request, response) => {
  const workspace = saveWorkspace(request.body);
  response.json(workspace);
});

app.get("*", (_request, response) => {
  response.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, host, () => {
  console.log(`MemoGPT server running at http://localhost:${port}`);
  console.log(`SQLite database: ${dbPath}`);
});
