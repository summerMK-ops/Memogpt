const STORAGE_KEY = "memogpt-workspace-v2";
const LEGACY_STORAGE_KEY = "chatgpt-memo-notes";

const templateBodies = {
  meeting: "# Meeting Notes\n- Date: \n- Attendees: \n\n## Agenda\n- \n\n## Decisions\n- \n\n## Follow-up\n- [ ] ",
  journal: "# Daily Journal\n\n## Today\n\n## What stood out\n\n## Next step\n",
  task: "# Task List\n- [ ] First task\n- [ ] Second task\n- [ ] Third task"
};

const defaultWorkspace = {
  folders: [
    { id: "folder-inbox", name: "Inbox" },
    { id: "folder-projects", name: "Projects" },
    { id: "folder-knowledge", name: "Knowledge" }
  ],
  notes: [
    createNote({
      title: "Welcome to MemoGPT",
      folderId: "folder-inbox",
      pinned: true,
      favorite: true,
      tags: ["welcome", "workspace"],
      body: "# Capture quickly\nUse this space for rough ideas, tasks, and meeting notes.\n\n## Try next\n- [ ] Pin important notes\n- [ ] Group notes into folders\n- [ ] Add tags for easier search"
    }),
    createNote({
      title: "Product direction",
      folderId: "folder-projects",
      tags: ["product", "design"],
      body: "# Hybrid note app\nWe want the calm feeling of Apple Notes with the structure of Notion.\n\n> Focus on speed, readability, and light organization.\n\n## Core pillars\n- Fast capture\n- Smart folders\n- Live preview"
    })
  ]
};

const state = {
  workspace: loadWorkspace(),
  selectedView: { type: "smart", id: "all" },
  query: "",
  selectedNoteId: null,
  draftImages: [],
  saveTimer: null,
  isSidebarOpen: window.innerWidth > 1100
};

const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");
const workspaceTitle = document.getElementById("workspaceTitle");
const smartViews = document.getElementById("smartViews");
const folderList = document.getElementById("folderList");
const workspaceStats = document.getElementById("workspaceStats");
const noteList = document.getElementById("noteList");
const noteCount = document.getElementById("noteCount");
const newFolderButton = document.getElementById("newFolderButton");
const newNoteButton = document.getElementById("newNoteButton");
const searchInput = document.getElementById("searchInput");
const exportButton = document.getElementById("exportButton");
const importInput = document.getElementById("importInput");
const quickActions = document.getElementById("quickActions");
const noteForm = document.getElementById("noteForm");
const titleInput = document.getElementById("titleInput");
const folderSelect = document.getElementById("folderSelect");
const tagsInput = document.getElementById("tagsInput");
const pinnedInput = document.getElementById("pinnedInput");
const favoriteInput = document.getElementById("favoriteInput");
const bodyInput = document.getElementById("bodyInput");
const imageInput = document.getElementById("imageInput");
const editingImages = document.getElementById("editingImages");
const previewCard = document.getElementById("previewCard");
const saveStatus = document.getElementById("saveStatus");
const editorEyebrow = document.getElementById("editorEyebrow");
const editorTitleLabel = document.getElementById("editorTitleLabel");
const duplicateNoteButton = document.getElementById("duplicateNoteButton");
const deleteNoteButton = document.getElementById("deleteNoteButton");
const smartViewTemplate = document.getElementById("smartViewTemplate");
const folderTemplate = document.getElementById("folderTemplate");
const noteItemTemplate = document.getElementById("noteItemTemplate");
const editingImageTemplate = document.getElementById("editingImageTemplate");

registerServiceWorker();
ensureSelection();
render();

menuToggle.addEventListener("click", () => {
  state.isSidebarOpen = !state.isSidebarOpen;
  syncSidebarState();
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 1100) {
    state.isSidebarOpen = true;
    syncSidebarState();
  }
});

newFolderButton.addEventListener("click", () => {
  flushPendingSave();
  const name = window.prompt("New folder name");
  if (!name) {
    return;
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return;
  }

  state.workspace.folders.push({
    id: `folder-${crypto.randomUUID()}`,
    name: trimmed
  });
  persistWorkspace();
  render();
});

newNoteButton.addEventListener("click", () => {
  flushPendingSave();
  createAndSelectNote();
});

searchInput.addEventListener("input", (event) => {
  flushPendingSave();
  state.query = event.target.value.trim().toLowerCase();
  render();
});

quickActions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-template]");
  if (!button) {
    return;
  }

  flushPendingSave();
  createAndSelectNote(templateBodies[button.dataset.template] || "");
});

noteForm.addEventListener("input", () => {
  queueAutosave();
  renderPreview();
});

imageInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  const newImages = await Promise.all(files.map(fileToDataUrl));
  state.draftImages = [...state.draftImages, ...newImages.map(src => ({ src }))];
  imageInput.value = "";
  queueAutosave();
  renderEditingImages();
  renderPreview();
});

document.querySelector(".block-toolbar").addEventListener("click", (event) => {
  const button = event.target.closest("[data-insert]");
  if (!button) {
    return;
  }

  insertSnippet(button.dataset.insert);
});

duplicateNoteButton.addEventListener("click", () => {
  flushPendingSave();
  const note = getSelectedNote();
  if (!note) {
    return;
  }

  const clone = {
    ...note,
    id: crypto.randomUUID(),
    title: `${note.title} copy`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    images: note.images.map(image => ({ ...image }))
  };
  state.workspace.notes.unshift(clone);
  state.selectedNoteId = clone.id;
  persistWorkspace();
  render();
});

deleteNoteButton.addEventListener("click", () => {
  flushPendingSave();
  const note = getSelectedNote();
  if (!note) {
    return;
  }

  const confirmed = window.confirm(`Delete "${note.title}"?`);
  if (!confirmed) {
    return;
  }

  state.workspace.notes = state.workspace.notes.filter(item => item.id !== note.id);
  state.selectedNoteId = null;
  persistWorkspace();
  ensureSelection();
  render();
});

exportButton.addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    workspace: state.workspace
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `memogpt-workspace-${formatDate(new Date())}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async (event) => {
  const [file] = Array.from(event.target.files || []);
  if (!file) {
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    const candidate = parsed.workspace || parsed;
    const workspace = normalizeWorkspace(candidate);
    if (!workspace.notes.length) {
      throw new Error("No notes found in import file.");
    }

    state.workspace = workspace;
    state.selectedNoteId = workspace.notes[0].id;
    persistWorkspace();
    render();
  } catch (error) {
    window.alert(`Import failed: ${error.message}`);
  } finally {
    importInput.value = "";
  }
});

function render() {
  syncSidebarState();
  renderWorkspaceTitle();
  renderSmartViews();
  renderFolders();
  renderWorkspaceStats();
  renderFolderSelect();
  renderNoteList();
  renderEditor();
  renderEditingImages();
  renderPreview();
}

function syncSidebarState() {
  sidebar.classList.toggle("is-open", state.isSidebarOpen);
}

function renderWorkspaceTitle() {
  workspaceTitle.textContent = getViewTitle();
}

function renderSmartViews() {
  const views = [
    { id: "all", label: "All Notes", count: state.workspace.notes.length },
    { id: "pinned", label: "Pinned", count: state.workspace.notes.filter(note => note.pinned).length },
    { id: "favorites", label: "Favorites", count: state.workspace.notes.filter(note => note.favorite).length },
    { id: "recent", label: "Recently Updated", count: Math.min(state.workspace.notes.length, 5) }
  ];

  smartViews.innerHTML = "";

  views.forEach((view) => {
    const fragment = smartViewTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".nav-item");
    button.classList.toggle("is-active", state.selectedView.type === "smart" && state.selectedView.id === view.id);
    fragment.querySelector(".nav-item-label").textContent = view.label;
    fragment.querySelector(".nav-item-count").textContent = String(view.count);
    button.addEventListener("click", () => {
      flushPendingSave();
      state.selectedView = { type: "smart", id: view.id };
      render();
    });
    smartViews.appendChild(fragment);
  });
}

function renderFolders() {
  folderList.innerHTML = "";

  state.workspace.folders.forEach((folder) => {
    const fragment = folderTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".nav-item");
    button.classList.toggle("is-active", state.selectedView.type === "folder" && state.selectedView.id === folder.id);
    fragment.querySelector(".nav-item-label").textContent = folder.name;
    fragment.querySelector(".nav-item-count").textContent = String(countNotesInFolder(folder.id));
    button.addEventListener("click", () => {
      flushPendingSave();
      state.selectedView = { type: "folder", id: folder.id };
      render();
    });
    folderList.appendChild(fragment);
  });
}

function renderWorkspaceStats() {
  const pinnedCount = state.workspace.notes.filter(note => note.pinned).length;
  const tagCount = new Set(state.workspace.notes.flatMap(note => note.tags)).size;
  workspaceStats.innerHTML = `
    <div class="stat-card">
      <strong>${state.workspace.notes.length}</strong>
      <span>notes</span>
    </div>
    <div class="stat-card">
      <strong>${state.workspace.folders.length}</strong>
      <span>folders</span>
    </div>
    <div class="stat-card">
      <strong>${pinnedCount}</strong>
      <span>pinned</span>
    </div>
    <div class="stat-card">
      <strong>${tagCount}</strong>
      <span>tags</span>
    </div>
  `;
}

function renderFolderSelect() {
  const selectedNote = getSelectedNote();
  folderSelect.innerHTML = "";
  state.workspace.folders.forEach((folder) => {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.name;
    if (selectedNote?.folderId === folder.id) {
      option.selected = true;
    }
    folderSelect.appendChild(option);
  });
}

function renderNoteList() {
  const notes = getFilteredNotes();
  noteList.innerHTML = "";
  noteCount.textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;

  if (!notes.length) {
    noteList.innerHTML = '<div class="empty-state">No notes match this view yet. Create one and start shaping your workspace.</div>';
    return;
  }

  notes.forEach((note) => {
    const fragment = noteItemTemplate.content.cloneNode(true);
    const article = fragment.querySelector(".note-item");
    article.classList.toggle("is-active", note.id === state.selectedNoteId);
    fragment.querySelector(".note-item-title").textContent = note.title || "Untitled";
    fragment.querySelector(".note-item-body").textContent = summarizeNote(note.body);
    fragment.querySelector(".note-item-folder").textContent = getFolderName(note.folderId);
    fragment.querySelector(".note-item-date").textContent = formatHumanDate(note.updatedAt);

    const badges = fragment.querySelector(".note-item-badges");
    if (note.pinned) {
      badges.appendChild(createBadge("Pinned"));
    }
    if (note.favorite) {
      badges.appendChild(createBadge("Favorite"));
    }
    note.tags.slice(0, 2).forEach((tag) => badges.appendChild(createBadge(`#${tag}`)));

    article.addEventListener("click", () => {
      flushPendingSave();
      state.selectedNoteId = note.id;
      render();
      if (window.innerWidth < 1100) {
        state.isSidebarOpen = false;
        syncSidebarState();
      }
    });

    noteList.appendChild(fragment);
  });
}

function renderEditor() {
  const note = getSelectedNote();
  const hasNote = Boolean(note);
  noteForm.classList.toggle("is-disabled", !hasNote);

  [titleInput, folderSelect, tagsInput, pinnedInput, favoriteInput, bodyInput, imageInput].forEach((field) => {
    field.disabled = !hasNote;
  });

  duplicateNoteButton.disabled = !hasNote;
  deleteNoteButton.disabled = !hasNote;

  if (!note) {
    editorEyebrow.textContent = "Empty";
    editorTitleLabel.textContent = "Create or select a note";
    titleInput.value = "";
    tagsInput.value = "";
    bodyInput.value = "";
    pinnedInput.checked = false;
    favoriteInput.checked = false;
    state.draftImages = [];
    saveStatus.textContent = "Nothing selected";
    return;
  }

  editorEyebrow.textContent = `${getFolderName(note.folderId)} • Updated ${formatHumanDate(note.updatedAt)}`;
  editorTitleLabel.textContent = note.title || "Untitled note";
  titleInput.value = note.title;
  tagsInput.value = note.tags.join(", ");
  bodyInput.value = note.body;
  pinnedInput.checked = note.pinned;
  favoriteInput.checked = note.favorite;
  state.draftImages = note.images.map((image) => ({ ...image }));
  saveStatus.textContent = "Everything saved";
}

function renderEditingImages() {
  editingImages.innerHTML = "";

  state.draftImages.forEach((image, index) => {
    const fragment = editingImageTemplate.content.cloneNode(true);
    fragment.querySelector(".editing-image-preview").src = image.src;
    fragment.querySelector(".remove-image-button").addEventListener("click", () => {
      state.draftImages = state.draftImages.filter((_, currentIndex) => currentIndex !== index);
      queueAutosave();
      renderEditingImages();
      renderPreview();
    });
    editingImages.appendChild(fragment);
  });
}

function renderPreview() {
  const note = buildDraftNote();
  if (!note) {
    previewCard.innerHTML = `
      <div class="empty-state">
        Choose a note to see a polished reading view here.
      </div>
    `;
    return;
  }

  const tags = note.tags.map((tag) => `<span class="preview-tag">#${escapeHtml(tag)}</span>`).join("");
  const images = note.images.map((image) => `<img class="preview-image" src="${image.src}" alt="">`).join("");

  previewCard.innerHTML = `
    <div class="preview-meta">
      <div>
        <h2>${escapeHtml(note.title || "Untitled")}</h2>
        <p>${escapeHtml(getFolderName(note.folderId))} • ${escapeHtml(formatHumanDate(note.updatedAt || new Date().toISOString()))}</p>
      </div>
      <div class="preview-flag-group">
        ${note.pinned ? '<span class="preview-flag">Pinned</span>' : ""}
        ${note.favorite ? '<span class="preview-flag">Favorite</span>' : ""}
      </div>
    </div>
    <div class="preview-tags">${tags}</div>
    <div class="preview-body">${renderRichText(note.body)}</div>
    <div class="preview-gallery">${images}</div>
  `;
}

function queueAutosave() {
  const note = getSelectedNote();
  if (!note) {
    return;
  }

  saveStatus.textContent = "Saving...";
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    state.saveTimer = null;
    applyDraftToSelectedNote();
    persistWorkspace();
    saveStatus.textContent = "Everything saved";
    renderNoteList();
  }, 250);
}

function flushPendingSave() {
  if (!state.saveTimer) {
    return;
  }

  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  applyDraftToSelectedNote();
  persistWorkspace();
  saveStatus.textContent = "Everything saved";
}

function applyDraftToSelectedNote() {
  const note = getSelectedNote();
  if (!note) {
    return;
  }

  note.title = titleInput.value.trim() || "Untitled";
  note.folderId = folderSelect.value || state.workspace.folders[0]?.id || "";
  note.tags = parseTags(tagsInput.value);
  note.pinned = pinnedInput.checked;
  note.favorite = favoriteInput.checked;
  note.body = bodyInput.value;
  note.images = state.draftImages.map((image) => ({ ...image }));
  note.updatedAt = new Date().toISOString();
  editorTitleLabel.textContent = note.title;
  editorEyebrow.textContent = `${getFolderName(note.folderId)} • Updated ${formatHumanDate(note.updatedAt)}`;
}

function buildDraftNote() {
  const note = getSelectedNote();
  if (!note) {
    return null;
  }

  return {
    ...note,
    title: titleInput.value.trim() || note.title,
    folderId: folderSelect.value || note.folderId,
    tags: parseTags(tagsInput.value),
    pinned: pinnedInput.checked,
    favorite: favoriteInput.checked,
    body: bodyInput.value,
    images: state.draftImages.map((image) => ({ ...image })),
    updatedAt: note.updatedAt || new Date().toISOString()
  };
}

function createAndSelectNote(prefillBody = "") {
  const folderId = state.selectedView.type === "folder"
    ? state.selectedView.id
    : state.workspace.folders[0]?.id || "folder-inbox";

  const note = createNote({
    title: "Untitled",
    folderId,
    body: prefillBody
  });
  state.workspace.notes.unshift(note);
  state.selectedNoteId = note.id;
  persistWorkspace();
  render();
  titleInput.focus();
  titleInput.select();
}

function ensureSelection() {
  const selectedStillExists = state.workspace.notes.some((note) => note.id === state.selectedNoteId);
  if (!selectedStillExists) {
    state.selectedNoteId = state.workspace.notes[0]?.id || null;
  }
}

function getFilteredNotes() {
  const searched = state.workspace.notes.filter((note) => matchesView(note) && matchesQuery(note));
  return searched.sort(sortNotes);
}

function matchesView(note) {
  if (state.selectedView.type === "folder") {
    return note.folderId === state.selectedView.id;
  }

  if (state.selectedView.id === "pinned") {
    return note.pinned;
  }

  if (state.selectedView.id === "favorites") {
    return note.favorite;
  }

  if (state.selectedView.id === "recent") {
    const recentIds = [...state.workspace.notes]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5)
      .map((item) => item.id);
    return recentIds.includes(note.id);
  }

  return true;
}

function matchesQuery(note) {
  if (!state.query) {
    return true;
  }

  const haystack = [
    note.title,
    note.body,
    note.tags.join(" "),
    getFolderName(note.folderId)
  ].join(" ").toLowerCase();

  return haystack.includes(state.query);
}

function getViewTitle() {
  if (state.selectedView.type === "folder") {
    return getFolderName(state.selectedView.id);
  }

  const titles = {
    all: "All Notes",
    pinned: "Pinned Notes",
    favorites: "Favorite Notes",
    recent: "Recently Updated"
  };
  return titles[state.selectedView.id] || "MemoGPT";
}

function getSelectedNote() {
  return state.workspace.notes.find((note) => note.id === state.selectedNoteId) || null;
}

function getFolderName(folderId) {
  return state.workspace.folders.find((folder) => folder.id === folderId)?.name || "Unsorted";
}

function countNotesInFolder(folderId) {
  return state.workspace.notes.filter((note) => note.folderId === folderId).length;
}

function createBadge(text) {
  const badge = document.createElement("span");
  badge.className = "inline-badge";
  badge.textContent = text;
  return badge;
}

function summarizeNote(body) {
  return body.replace(/\s+/g, " ").trim().slice(0, 110) || "No content yet";
}

function parseTags(rawTags) {
  return rawTags
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index);
}

function insertSnippet(type) {
  const snippets = {
    heading: "\n## New Section\n",
    todo: "\n- [ ] New task\n",
    callout: "\n> Important thought\n"
  };
  const snippet = snippets[type];
  if (!snippet || bodyInput.disabled) {
    return;
  }

  const start = bodyInput.selectionStart;
  const end = bodyInput.selectionEnd;
  const current = bodyInput.value;
  bodyInput.value = `${current.slice(0, start)}${snippet}${current.slice(end)}`;
  bodyInput.selectionStart = bodyInput.selectionEnd = start + snippet.length;
  bodyInput.focus();
  queueAutosave();
  renderPreview();
}

function createNote(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Untitled",
    body: "",
    folderId: "folder-inbox",
    tags: [],
    pinned: false,
    favorite: false,
    images: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function loadWorkspace() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return normalizeWorkspace(JSON.parse(saved));
    } catch {
      return structuredClone(defaultWorkspace);
    }
  }

  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy);
      const workspace = migrateLegacyNotes(Array.isArray(parsed) ? parsed : []);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      return workspace;
    } catch {
      return structuredClone(defaultWorkspace);
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultWorkspace));
  return structuredClone(defaultWorkspace);
}

function persistWorkspace() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workspace));
}

function migrateLegacyNotes(notes) {
  const migrated = normalizeNotes(notes).map((note, index) => ({
    ...note,
    folderId: index === 0 ? "folder-inbox" : "folder-knowledge",
    tags: [],
    pinned: index === 0,
    favorite: false,
    createdAt: new Date(Date.now() - (notes.length - index) * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - (notes.length - index) * 86400000).toISOString()
  }));

  return {
    folders: structuredClone(defaultWorkspace.folders),
    notes: migrated.length ? migrated : structuredClone(defaultWorkspace.notes)
  };
}

function normalizeWorkspace(candidate) {
  const folders = Array.isArray(candidate?.folders) && candidate.folders.length
    ? candidate.folders
        .filter((folder) => folder && typeof folder.name === "string")
        .map((folder) => ({
          id: typeof folder.id === "string" ? folder.id : `folder-${crypto.randomUUID()}`,
          name: folder.name.trim() || "Untitled folder"
        }))
    : structuredClone(defaultWorkspace.folders);

  const folderIds = new Set(folders.map((folder) => folder.id));
  const notes = normalizeNotes(candidate?.notes).map((note) => ({
    ...note,
    folderId: folderIds.has(note.folderId) ? note.folderId : folders[0].id
  }));

  return {
    folders,
    notes: notes.length ? notes : structuredClone(defaultWorkspace.notes)
  };
}

function normalizeNotes(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .filter((note) => note && typeof note.title === "string")
    .map((note) => createNote({
      id: typeof note.id === "string" ? note.id : crypto.randomUUID(),
      title: note.title.trim() || "Untitled",
      body: typeof note.body === "string" ? note.body : "",
      folderId: typeof note.folderId === "string" ? note.folderId : "folder-inbox",
      tags: Array.isArray(note.tags) ? note.tags.filter((tag) => typeof tag === "string").map((tag) => tag.toLowerCase()) : [],
      pinned: Boolean(note.pinned),
      favorite: Boolean(note.favorite),
      images: Array.isArray(note.images)
        ? note.images
            .filter((image) => image && typeof image.src === "string")
            .map((image) => ({ src: image.src }))
        : [],
      createdAt: typeof note.createdAt === "string" ? note.createdAt : new Date().toISOString(),
      updatedAt: typeof note.updatedAt === "string" ? note.updatedAt : new Date().toISOString()
    }));
}

function renderRichText(content) {
  const lines = escapeHtml(content).split("\n");
  return lines.map((line) => {
    if (!line.trim()) {
      return '<div class="preview-spacer"></div>';
    }
    if (line.startsWith("### ")) {
      return `<h4>${line.slice(4)}</h4>`;
    }
    if (line.startsWith("## ")) {
      return `<h3>${line.slice(3)}</h3>`;
    }
    if (line.startsWith("# ")) {
      return `<h2>${line.slice(2)}</h2>`;
    }
    if (line.startsWith("- [ ] ")) {
      return `<label class="preview-check"><input type="checkbox" disabled><span>${line.slice(6)}</span></label>`;
    }
    if (line.startsWith("- [x] ") || line.startsWith("- [X] ")) {
      return `<label class="preview-check"><input type="checkbox" checked disabled><span>${line.slice(6)}</span></label>`;
    }
    if (line.startsWith("- ")) {
      return `<p class="preview-bullet">• ${line.slice(2)}</p>`;
    }
    if (line.startsWith("> ")) {
      return `<blockquote>${line.slice(2)}</blockquote>`;
    }
    return `<p>${line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
  }).join("");
}

function sortNotes(a, b) {
  if (a.pinned !== b.pinned) {
    return a.pinned ? -1 : 1;
  }
  return new Date(b.updatedAt) - new Date(a.updatedAt);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatHumanDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => null);
  });
}
