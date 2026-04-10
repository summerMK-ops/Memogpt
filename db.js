const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "memogpt.db");

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    pinned INTEGER NOT NULL DEFAULT 0,
    body TEXT NOT NULL DEFAULT '',
    images_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function createStarterWorkspace() {
  const inboxId = crypto.randomUUID();
  const workId = crypto.randomUUID();
  const ideasId = crypto.randomUUID();
  const welcomeId = crypto.randomUUID();
  const visionId = crypto.randomUUID();
  const now = new Date().toISOString();

  return {
    folders: [
      { id: inboxId, name: "Inbox" },
      { id: workId, name: "Work" },
      { id: ideasId, name: "Ideas" }
    ],
    notes: [
      {
        id: welcomeId,
        title: "Welcome to MemoGPT",
        folderId: inboxId,
        tags: ["welcome", "mvp"],
        pinned: true,
        body: [
          "## Start here",
          "- [ ] Capture a quick note",
          "- [ ] Add tags like #idea or #meeting",
          "- [ ] Link another note with [[Product Vision]]",
          "",
          "> Type / in the editor for block shortcuts"
        ].join("\n"),
        images: [],
        createdAt: now,
        updatedAt: now
      },
      {
        id: visionId,
        title: "Product Vision",
        folderId: ideasId,
        tags: ["product", "design"],
        pinned: false,
        body: [
          "## Direction",
          "Apple Notes speed with Notion structure.",
          "",
          "| Layer | Focus |",
          "| --- | --- |",
          "| Capture | Fast and calm |",
          "| Organize | Tags, folders, links |"
        ].join("\n"),
        images: [],
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}

function normalizeWorkspace(candidate) {
  const fallback = createStarterWorkspace();
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }

  const folders = Array.isArray(candidate.folders) && candidate.folders.length
    ? candidate.folders
        .filter((folder) => folder && typeof folder.name === "string")
        .map((folder) => ({
          id: typeof folder.id === "string" ? folder.id : crypto.randomUUID(),
          name: folder.name.trim() || "Untitled"
        }))
    : fallback.folders;

  const firstFolderId = folders[0].id;
  const folderIds = new Set(folders.map((folder) => folder.id));

  const notes = Array.isArray(candidate.notes)
    ? candidate.notes
        .filter((note) => note && typeof note.title === "string")
        .map((note) => ({
          id: typeof note.id === "string" ? note.id : crypto.randomUUID(),
          title: note.title.trim() || "Untitled",
          folderId: folderIds.has(note.folderId) ? note.folderId : firstFolderId,
          tags: Array.isArray(note.tags)
            ? note.tags.filter((tag) => typeof tag === "string").map((tag) => tag.toLowerCase())
            : [],
          pinned: Boolean(note.pinned),
          body: typeof note.body === "string" ? note.body : "",
          images: Array.isArray(note.images)
            ? note.images
                .filter((image) => image && typeof image.src === "string")
                .map((image) => ({ src: image.src, name: typeof image.name === "string" ? image.name : "image" }))
            : [],
          createdAt: typeof note.createdAt === "string" ? note.createdAt : new Date().toISOString(),
          updatedAt: typeof note.updatedAt === "string" ? note.updatedAt : new Date().toISOString()
        }))
    : fallback.notes;

  return {
    folders,
    notes: notes.length ? notes : fallback.notes
  };
}

const insertFolder = db.prepare(`
  INSERT INTO folders (id, name, position)
  VALUES (@id, @name, @position)
`);

const insertNote = db.prepare(`
  INSERT INTO notes (id, title, folder_id, tags_json, pinned, body, images_json, created_at, updated_at)
  VALUES (@id, @title, @folderId, @tagsJson, @pinned, @body, @imagesJson, @createdAt, @updatedAt)
`);

const replaceWorkspaceTxn = db.transaction((workspace) => {
  db.prepare("DELETE FROM folders").run();
  db.prepare("DELETE FROM notes").run();

  workspace.folders.forEach((folder, index) => {
    insertFolder.run({
      id: folder.id,
      name: folder.name,
      position: index
    });
  });

  workspace.notes.forEach((note) => {
    insertNote.run({
      id: note.id,
      title: note.title,
      folderId: note.folderId,
      tagsJson: JSON.stringify(note.tags),
      pinned: note.pinned ? 1 : 0,
      body: note.body,
      imagesJson: JSON.stringify(note.images),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    });
  });
});

function getWorkspace() {
  const folders = db.prepare("SELECT id, name FROM folders ORDER BY position ASC, name ASC").all();
  const notes = db.prepare(`
    SELECT id, title, folder_id AS folderId, tags_json AS tagsJson, pinned, body, images_json AS imagesJson, created_at AS createdAt, updated_at AS updatedAt
    FROM notes
    ORDER BY pinned DESC, datetime(updated_at) DESC
  `).all().map((note) => ({
    id: note.id,
    title: note.title,
    folderId: note.folderId,
    tags: safeParseJson(note.tagsJson, []),
    pinned: Boolean(note.pinned),
    body: note.body,
    images: safeParseJson(note.imagesJson, []),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  }));

  if (!folders.length || !notes.length) {
    const starter = createStarterWorkspace();
    replaceWorkspaceTxn(starter);
    return starter;
  }

  return { folders, notes };
}

function saveWorkspace(candidate) {
  const workspace = normalizeWorkspace(candidate);
  replaceWorkspaceTxn(workspace);
  return workspace;
}

function safeParseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = {
  dbPath,
  getWorkspace,
  saveWorkspace
};
