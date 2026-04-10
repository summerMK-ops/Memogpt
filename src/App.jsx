import { useEffect, useMemo, useRef, useState } from "react";

const slashCommands = [
  { id: "heading", label: "Heading", snippet: "## New Section\n" },
  { id: "todo", label: "Checklist", snippet: "- [ ] New task\n" },
  { id: "callout", label: "Callout", snippet: "> Important note\n" },
  { id: "table", label: "Table", snippet: "| Name | Status |\n| --- | --- |\n| Item | Active |\n" }
];

const noteTemplates = [
  { id: "blank", label: "Blank", body: "" },
  {
    id: "meeting",
    label: "Meeting",
    body: "## Meeting\n- Date: \n- Attendees: \n\n## Agenda\n- \n\n## Notes\n- \n\n## Action items\n- [ ] "
  },
  {
    id: "daily",
    label: "Daily",
    body: "## Today\n\n## Focus\n- [ ] \n\n## Notes\n\n## Wrap up\n"
  }
];

function createFallbackWorkspace() {
  const inboxId = crypto.randomUUID();
  const workId = crypto.randomUUID();
  const ideasId = crypto.randomUUID();
  const now = new Date().toISOString();
  const welcomeId = crypto.randomUUID();
  const visionId = crypto.randomUUID();

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
          "- [ ] Add a quick note",
          "- [ ] Attach an image",
          "- [ ] Link another note with [[Product Vision]]"
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

function createNote(folderId, templateBody = "") {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Untitled",
    folderId,
    tags: [],
    pinned: false,
    body: templateBody,
    images: [],
    createdAt: now,
    updatedAt: now
  };
}

function normalizeWorkspace(candidate) {
  const fallback = createFallbackWorkspace();
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

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index);
}

function formatWhen(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function renderTable(lines, keyPrefix) {
  const rows = lines.map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  const header = rows[0] || [];
  const body = rows.slice(2);

  return (
    <div key={`table-${keyPrefix}`} className="preview-table-wrap">
      <table className="preview-table">
        <thead>
          <tr>
            {header.map((cell, index) => <th key={index}>{cell}</th>)}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInline(text, notesByTitle, onJumpToNote) {
  const parts = [];
  let cursor = 0;
  const pattern = /(\[\[(.+?)\]\]|#[\p{L}\p{N}_-]+|@[\p{L}\p{N}_-]+)/gu;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    if (token.startsWith("#")) {
      parts.push(<span key={`${token}-${match.index}`} className="inline-token inline-tag">{token}</span>);
    } else {
      const rawTitle = token.startsWith("[[") ? match[2] : token.slice(1).replaceAll("-", " ");
      const linked = notesByTitle.get(rawTitle.trim().toLowerCase());

      if (linked) {
        parts.push(
          <button
            key={`${token}-${match.index}`}
            className="inline-token inline-link"
            type="button"
            onClick={() => onJumpToNote(linked.id)}
          >
            {token}
          </button>
        );
      } else {
        parts.push(<span key={`${token}-${match.index}`} className="inline-token inline-muted">{token}</span>);
      }
    }

    cursor = match.index + token.length;
    match = pattern.exec(text);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
}

function buildPreview(note, notesByTitle, onJumpToNote) {
  const lines = note.body.split("\n");
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.trim()) {
      blocks.push(<div key={`space-${index}`} className="preview-space" />);
      continue;
    }

    if (line.startsWith("|")) {
      const tableLines = [line];
      let next = index + 1;
      while (next < lines.length && lines[next].startsWith("|")) {
        tableLines.push(lines[next]);
        next += 1;
      }
      blocks.push(renderTable(tableLines, index));
      index = next - 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(<h4 key={index}>{renderInline(line.slice(4), notesByTitle, onJumpToNote)}</h4>);
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(<h3 key={index}>{renderInline(line.slice(3), notesByTitle, onJumpToNote)}</h3>);
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(<h2 key={index}>{renderInline(line.slice(2), notesByTitle, onJumpToNote)}</h2>);
      continue;
    }

    if (line.startsWith("- [ ] ") || line.startsWith("- [x] ") || line.startsWith("- [X] ")) {
      const checked = line[3].toLowerCase() === "x";
      blocks.push(
        <label key={index} className="preview-check">
          <input type="checkbox" checked={checked} readOnly />
          <span>{renderInline(line.slice(6), notesByTitle, onJumpToNote)}</span>
        </label>
      );
      continue;
    }

    if (line.startsWith("- ")) {
      blocks.push(<p key={index} className="preview-bullet">• {renderInline(line.slice(2), notesByTitle, onJumpToNote)}</p>);
      continue;
    }

    if (line.startsWith("> ")) {
      blocks.push(<blockquote key={index}>{renderInline(line.slice(2), notesByTitle, onJumpToNote)}</blockquote>);
      continue;
    }

    blocks.push(<p key={index}>{renderInline(line, notesByTitle, onJumpToNote)}</p>);
  }

  const images = note.images.map((image, index) => (
    <img key={`${image.name}-${index}`} className="preview-image" src={image.src} alt={image.name} />
  ));

  return (
    <>
      <div className="preview-body">{blocks}</div>
      {images.length > 0 && <div className="preview-gallery">{images}</div>}
    </>
  );
}

function getActiveSlashState(body, selectionStart) {
  const before = body.slice(0, selectionStart);
  const line = before.slice(before.lastIndexOf("\n") + 1);
  if (!line.startsWith("/")) {
    return null;
  }

  return {
    query: line.slice(1).toLowerCase(),
    lineStart: before.lastIndexOf("\n") + 1
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ src: reader.result, name: file.name });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function draftMatchesNote(draft, note) {
  if (!draft || !note) {
    return false;
  }

  return (
    (draft.title.trim() || "Untitled") === note.title
    && draft.folderId === note.folderId
    && JSON.stringify(parseTags(draft.tagInput)) === JSON.stringify(note.tags)
    && draft.pinned === note.pinned
    && draft.body === note.body
    && JSON.stringify(draft.images) === JSON.stringify(note.images)
  );
}

export default function App() {
  const [workspace, setWorkspace] = useState(null);
  const [activeFolderId, setActiveFolderId] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saveState, setSaveState] = useState("Loading...");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [templateId, setTemplateId] = useState("blank");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const saveTimerRef = useRef(null);

  const notesByTitle = useMemo(() => {
    const map = new Map();
    workspace?.notes.forEach((note) => {
      map.set(note.title.toLowerCase(), note);
      map.set(note.title.toLowerCase().replaceAll(" ", "-"), note);
    });
    return map;
  }, [workspace]);

  const filteredNotes = useMemo(() => {
    if (!workspace) {
      return [];
    }

    return workspace.notes
      .filter((note) => {
        const matchesFolder = activeFolderId === "all" ? true : note.folderId === activeFolderId;
        const query = search.trim().toLowerCase();
        const haystack = `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase();
        return matchesFolder && (!query || haystack.includes(query));
      })
      .sort((left, right) => {
        if (left.pinned !== right.pinned) {
          return left.pinned ? -1 : 1;
        }
        return new Date(right.updatedAt) - new Date(left.updatedAt);
      });
  }, [workspace, activeFolderId, search]);

  const selectedNote = workspace?.notes.find((note) => note.id === selectedNoteId)
    || filteredNotes[0]
    || workspace?.notes[0]
    || null;

  const slashState = draft ? getActiveSlashState(draft.body, draft.selectionStart ?? draft.body.length) : null;
  const visibleCommands = slashState
    ? slashCommands.filter((command) => command.label.toLowerCase().includes(slashState.query))
    : [];

  useEffect(() => {
    fetch("/api/workspace")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load workspace");
        }
        return response.json();
      })
      .then((payload) => {
        const normalized = normalizeWorkspace(payload);
        setWorkspace(normalized);
        setSelectedNoteId(normalized.notes[0]?.id || null);
        setSaveState("Saved");
      })
      .catch(() => {
        const fallback = createFallbackWorkspace();
        setWorkspace(fallback);
        setSelectedNoteId(fallback.notes[0]?.id || null);
        setSaveState("Offline draft");
        setError("API load failed. Showing fallback data.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedNote) {
      setDraft(null);
      return;
    }

    setDraft({
      ...selectedNote,
      tagInput: selectedNote.tags.join(", "),
      selectionStart: selectedNote.body.length
    });
  }, [selectedNoteId, selectedNote?.updatedAt]);

  useEffect(() => {
    if (!workspace || !draft || !selectedNote) {
      return undefined;
    }

    if (draftMatchesNote(draft, selectedNote)) {
      setSaveState("Saved");
      return undefined;
    }

    clearTimeout(saveTimerRef.current);
    setSaveState("Saving...");

    saveTimerRef.current = setTimeout(() => {
      const nextNote = {
        ...selectedNote,
        title: draft.title.trim() || "Untitled",
        folderId: draft.folderId,
        tags: parseTags(draft.tagInput),
        pinned: draft.pinned,
        body: draft.body,
        images: draft.images,
        updatedAt: new Date().toISOString()
      };

      const nextWorkspace = {
        ...workspace,
        notes: workspace.notes.map((note) => (note.id === nextNote.id ? nextNote : note))
      };

      setWorkspace(nextWorkspace);

      fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextWorkspace)
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Save failed");
          }
          return response.json();
        })
        .then((payload) => {
          const normalized = normalizeWorkspace(payload);
          setWorkspace(normalized);
          setSaveState("Saved");
        })
        .catch(() => {
          setSaveState("Save failed");
          setError("Could not save to SQLite right now.");
        });
    }, 450);

    return () => clearTimeout(saveTimerRef.current);
  }, [draft]);

  function updateDraft(field, value) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function setWorkspaceAndPersist(nextWorkspace, nextSelectedId) {
    setWorkspace(nextWorkspace);
    setSelectedNoteId(nextSelectedId);
    setSaveState("Saving...");

    fetch("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextWorkspace)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Save failed");
        }
        return response.json();
      })
      .then((payload) => {
        setWorkspace(normalizeWorkspace(payload));
        setSaveState("Saved");
      })
      .catch(() => {
        setSaveState("Save failed");
        setError("Could not save to SQLite right now.");
      });
  }

  function handleCreateFolder() {
    if (!workspace) {
      return;
    }

    const name = window.prompt("Folder name");
    if (!name?.trim()) {
      return;
    }

    const folder = { id: crypto.randomUUID(), name: name.trim() };
    const nextWorkspace = {
      ...workspace,
      folders: [...workspace.folders, folder]
    };
    setActiveFolderId(folder.id);
    setWorkspaceAndPersist(nextWorkspace, selectedNoteId);
  }

  function handleCreateNote() {
    if (!workspace) {
      return;
    }

    const folderId = activeFolderId === "all" ? workspace.folders[0]?.id : activeFolderId;
    const template = noteTemplates.find((item) => item.id === templateId);
    const note = createNote(folderId, template?.body || "");
    const nextWorkspace = {
      ...workspace,
      notes: [note, ...workspace.notes]
    };
    setMobileSidebarOpen(false);
    setWorkspaceAndPersist(nextWorkspace, note.id);
  }

  function handleDuplicateNote() {
    if (!workspace || !selectedNote) {
      return;
    }

    const now = new Date().toISOString();
    const duplicate = {
      ...selectedNote,
      id: crypto.randomUUID(),
      title: `${selectedNote.title} copy`,
      images: selectedNote.images.map((image) => ({ ...image })),
      createdAt: now,
      updatedAt: now
    };

    setWorkspaceAndPersist({ ...workspace, notes: [duplicate, ...workspace.notes] }, duplicate.id);
  }

  function handleDeleteNote() {
    if (!workspace || !selectedNote) {
      return;
    }

    if (!window.confirm(`Delete "${selectedNote.title}"?`)) {
      return;
    }

    const nextNotes = workspace.notes.filter((note) => note.id !== selectedNote.id);
    setWorkspaceAndPersist({ ...workspace, notes: nextNotes }, nextNotes[0]?.id || null);
  }

  function applySlashCommand(command) {
    if (!draft || !slashState) {
      return;
    }

    const start = slashState.lineStart;
    const currentCursor = draft.selectionStart ?? draft.body.length;
    const nextBody = `${draft.body.slice(0, start)}${command.snippet}${draft.body.slice(currentCursor)}`;
    setDraft({
      ...draft,
      body: nextBody,
      selectionStart: start + command.snippet.length
    });
  }

  async function handleImageChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length || !draft) {
      return;
    }

    const images = await Promise.all(files.map(fileToDataUrl));
    setDraft({
      ...draft,
      images: [...draft.images, ...images]
    });
    event.target.value = "";
  }

  function removeDraftImage(indexToRemove) {
    if (!draft) {
      return;
    }

    setDraft({
      ...draft,
      images: draft.images.filter((_, index) => index !== indexToRemove)
    });
  }

  function jumpToNote(noteId) {
    setSelectedNoteId(noteId);
  }

  function handleExport() {
    if (!workspace) {
      return;
    }

    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `memogpt-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    file.text()
      .then((text) => {
        const nextWorkspace = normalizeWorkspace(JSON.parse(text));
        setWorkspaceAndPersist(nextWorkspace, nextWorkspace.notes[0]?.id || null);
      })
      .catch(() => {
        setError("JSON import failed.");
      })
      .finally(() => {
        event.target.value = "";
      });
  }

  if (loading || !workspace) {
    return <div className="loading-screen">Loading MemoGPT...</div>;
  }

  const folderCounts = workspace.folders.reduce((accumulator, folder) => {
    accumulator[folder.id] = workspace.notes.filter((note) => note.folderId === folder.id).length;
    return accumulator;
  }, {});

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileSidebarOpen ? "is-open" : ""}`}>
        <div className="brand-card">
          <p className="brand-kicker">Memo workspace</p>
          <h1>MemoGPT</h1>
          <p className="brand-copy">Fast capture, clean structure, and SQLite-backed notes for your VPS.</p>
        </div>

        <div className="sidebar-section">
          <div className="section-head">
            <span>Folders</span>
            <button className="ghost-button" type="button" onClick={handleCreateFolder}>New</button>
          </div>
          <button className={`nav-item ${activeFolderId === "all" ? "is-active" : ""}`} type="button" onClick={() => setActiveFolderId("all")}>
            <span>All Notes</span>
            <strong>{workspace.notes.length}</strong>
          </button>
          {workspace.folders.map((folder) => (
            <button
              key={folder.id}
              className={`nav-item ${activeFolderId === folder.id ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveFolderId(folder.id)}
            >
              <span>{folder.name}</span>
              <strong>{folderCounts[folder.id] || 0}</strong>
            </button>
          ))}
        </div>

        <div className="sidebar-section stats-grid">
          <div className="stat-card">
            <strong>{workspace.notes.filter((note) => note.pinned).length}</strong>
            <span>Pinned</span>
          </div>
          <div className="stat-card">
            <strong>{new Set(workspace.notes.flatMap((note) => note.tags)).size}</strong>
            <span>Tags</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button className="menu-button" type="button" onClick={() => setMobileSidebarOpen((current) => !current)}>
              <span />
              <span />
              <span />
            </button>
            <div>
              <p className="eyebrow">Apple Notes x Notion</p>
              <h2>Fast notes, clean structure</h2>
            </div>
          </div>

          <div className="topbar-actions">
            <label className="search-box">
              <input
                type="search"
                placeholder="Search notes, tags, and text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="import-button">
              <span>Import</span>
              <input type="file" accept="application/json" onChange={handleImport} />
            </label>
            <button className="secondary-button" type="button" onClick={handleExport}>Export</button>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <section className="workspace-grid">
          <div className="panel note-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Notes</p>
                <h3>{filteredNotes.length} notes</h3>
              </div>
              <button className="primary-button" type="button" onClick={handleCreateNote}>New note</button>
            </div>

            <div className="template-row">
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                {noteTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.label}</option>
                ))}
              </select>
            </div>

            <div className="note-list">
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  className={`note-card ${selectedNote?.id === note.id ? "is-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setSelectedNoteId(note.id);
                    setMobileSidebarOpen(false);
                  }}
                >
                  <div className="note-card-top">
                    <h4>{note.title}</h4>
                    {note.pinned && <span className="pill">Pinned</span>}
                  </div>
                  <p>{note.body.slice(0, 120) || "No content yet"}</p>
                  <div className="note-card-meta">
                    <span>{workspace.folders.find((folder) => folder.id === note.folderId)?.name}</span>
                    <span>{formatWhen(note.updatedAt)}</span>
                  </div>
                  <div className="tag-row">
                    {note.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}
                    {note.images.length > 0 && <span className="tag-chip">{note.images.length} images</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel editor-panel">
            {draft ? (
              <>
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Editor</p>
                    <h3>{draft.title || "Untitled"}</h3>
                  </div>
                  <div className="action-row">
                    <button className="secondary-button" type="button" onClick={handleDuplicateNote}>Duplicate</button>
                    <button className="danger-button" type="button" onClick={handleDeleteNote}>Delete</button>
                  </div>
                </div>

                <div className="editor-form">
                  <input className="title-input" value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="Untitled" />

                  <div className="editor-meta-grid">
                    <label>
                      <span>Folder</span>
                      <select value={draft.folderId} onChange={(event) => updateDraft("folderId", event.target.value)}>
                        {workspace.folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>{folder.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Tags</span>
                      <input value={draft.tagInput} onChange={(event) => updateDraft("tagInput", event.target.value)} placeholder="idea, task, design" />
                    </label>
                  </div>

                  <div className="toolbar-row">
                    <label className="pin-toggle">
                      <input type="checkbox" checked={draft.pinned} onChange={(event) => updateDraft("pinned", event.target.checked)} />
                      <span>Pin note</span>
                    </label>
                    <label className="image-upload">
                      <span>Add images</span>
                      <input type="file" accept="image/*" multiple onChange={handleImageChange} />
                    </label>
                  </div>

                  <div className="helper-copy">Type <code>/</code> for blocks, <code>#tag</code> and <code>[[Note Title]]</code> for links.</div>

                  <div className="editor-area-wrap">
                    <textarea
                      className="editor-area"
                      value={draft.body}
                      onChange={(event) => updateDraft("body", event.target.value)}
                      onClick={(event) => updateDraft("selectionStart", event.target.selectionStart)}
                      onKeyUp={(event) => updateDraft("selectionStart", event.currentTarget.selectionStart)}
                      onSelect={(event) => updateDraft("selectionStart", event.currentTarget.selectionStart)}
                      placeholder="Write freely here..."
                    />

                    {slashState && visibleCommands.length > 0 && (
                      <div className="slash-menu">
                        {visibleCommands.map((command) => (
                          <button key={command.id} className="slash-item" type="button" onClick={() => applySlashCommand(command)}>
                            <strong>{command.label}</strong>
                            <span>{command.snippet.trim()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {draft.images.length > 0 && (
                    <div className="image-strip">
                      {draft.images.map((image, index) => (
                        <div key={`${image.name}-${index}`} className="image-card">
                          <img src={image.src} alt={image.name} />
                          <button className="ghost-button" type="button" onClick={() => removeDraftImage(index)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="save-line">
                    <span>{saveState}</span>
                    <span>Updated {formatWhen(selectedNote?.updatedAt || new Date().toISOString())}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">Create your first note to start the new workspace.</div>
            )}
          </div>

          <div className="panel preview-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Preview</p>
                <h3>Readable note view</h3>
              </div>
            </div>

            {draft ? (
              <>
                <div className="preview-header">
                  <h2>{draft.title || "Untitled"}</h2>
                  <div className="tag-row">
                    {parseTags(draft.tagInput).map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}
                    {draft.pinned && <span className="pill">Pinned</span>}
                  </div>
                </div>
                {buildPreview({ ...draft, tags: parseTags(draft.tagInput) }, notesByTitle, jumpToNote)}
              </>
            ) : (
              <div className="empty-state">Preview appears here.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
