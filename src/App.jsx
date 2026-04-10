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

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createFallbackWorkspace() {
  const inboxId = createId();
  const workId = createId();
  const ideasId = createId();
  const now = new Date().toISOString();
  const welcomeId = createId();
  const visionId = createId();

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
    id: createId(),
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

function buildDraftFromNote(note) {
  const editorText = note.body.trim()
    ? `${note.title}\n${note.body}`
    : note.title;

  return {
    ...note,
    tagInput: note.tags.join(", "),
    editorText,
    selectionStart: editorText.length
  };
}

function splitEditorText(editorText) {
  const normalized = editorText.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const firstMeaningfulLine = lines.find((line) => line.trim()) || "Untitled";
  const firstIndex = lines.findIndex((line) => line.trim());

  if (firstIndex === -1) {
    return { title: "Untitled", body: "" };
  }

  const bodyLines = lines.slice(firstIndex + 1);
  return {
    title: firstMeaningfulLine.trim(),
    body: bodyLines.join("\n").replace(/^\n+/, "")
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
          id: typeof folder.id === "string" ? folder.id : createId(),
          name: folder.name.trim() || "Untitled"
        }))
    : fallback.folders;

  const firstFolderId = folders[0].id;
  const folderIds = new Set(folders.map((folder) => folder.id));

  const notes = Array.isArray(candidate.notes)
    ? candidate.notes
        .filter((note) => note && typeof note.title === "string")
        .map((note) => ({
          id: typeof note.id === "string" ? note.id : createId(),
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
    const imageMatch = line.trim().match(/^!\[image:([^\]]+)\]$/);

    if (!line.trim()) {
      blocks.push(<div key={`space-${index}`} className="preview-space" />);
      continue;
    }

    if (imageMatch) {
      const image = note.images.find((item) => item.id === imageMatch[1]);
      if (image) {
        blocks.push(
          <div key={`image-${index}`} className="inline-image-wrap">
            <img className="preview-image inline-preview-image" src={image.src} alt={image.name} />
          </div>
        );
      }
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

  return (
    <>
      <div className="preview-body">{blocks}</div>
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
    reader.onload = () => resolve({ id: createId(), src: reader.result, name: file.name });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isToday(value) {
  const today = new Date();
  const date = new Date(value);
  return today.toDateString() === date.toDateString();
}

function isWithinLastDays(value, days) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  return diff <= days * 24 * 60 * 60 * 1000;
}

function noteSnippet(note) {
  const text = note.body
    .replace(/!\[image:[^\]]+\]/g, " ")
    .replace(/[#>\-\[\]\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text || "メモ";
}

function AppleSection({
  title,
  notes,
  workspace,
  selectedNote,
  swipedNoteId,
  setSwipedNoteId,
  onTogglePin,
  onDelete,
  onSelect
}) {
  if (!notes.length) {
    return null;
  }

  return (
    <section className="apple-section">
      <div className="apple-section-head">
        <h3>{title}</h3>
        {title === "ピンで固定" && <span>›</span>}
      </div>
      <div className="apple-note-group">
        {notes.map((note) => (
          <SwipeableNoteRow
            key={note.id}
            note={note}
            folderName={workspace.folders.find((folder) => folder.id === note.folderId)?.name || "メモ"}
            isActive={selectedNote?.id === note.id}
            isOpen={swipedNoteId === note.id}
            onOpen={() => setSwipedNoteId(note.id)}
            onClose={() => setSwipedNoteId(null)}
            onSelect={() => onSelect(note.id)}
            onTogglePin={() => onTogglePin(note.id)}
            onDelete={() => onDelete(note.id)}
          />
        ))}
      </div>
    </section>
  );
}

function SwipeableNoteRow({
  note,
  folderName,
  isActive,
  isOpen,
  onOpen,
  onClose,
  onSelect,
  onTogglePin,
  onDelete
}) {
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchDeltaRef = useRef(0);
  const touchMovedRef = useRef(false);

  function handleTouchStart(event) {
    touchStartXRef.current = event.touches[0].clientX;
    touchStartYRef.current = event.touches[0].clientY;
    touchDeltaRef.current = 0;
    touchMovedRef.current = false;
  }

  function handleTouchMove(event) {
    touchDeltaRef.current = event.touches[0].clientX - touchStartXRef.current;
    const deltaY = event.touches[0].clientY - touchStartYRef.current;
    if (Math.abs(deltaY) > 10 || Math.abs(touchDeltaRef.current) > 10) {
      touchMovedRef.current = true;
    }
  }

  function handleTouchEnd() {
    if (touchDeltaRef.current < -36) {
      onOpen();
      return;
    }

    if (touchDeltaRef.current > 36) {
      onClose();
      return;
    }

    if (!touchMovedRef.current && !isOpen) {
      onSelect();
    }
  }

  return (
    <div className={`swipe-row ${isOpen ? "is-open" : ""}`}>
      <div className="swipe-actions">
        <button className="swipe-action swipe-pin" type="button" onClick={onTogglePin}>
          {note.pinned ? "Unpin" : "Pin"}
        </button>
        <button className="swipe-action swipe-delete" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
      <button
        className={`apple-note-card ${isActive ? "is-active" : ""}`}
        type="button"
        onClick={() => {
          if (touchMovedRef.current) {
            touchMovedRef.current = false;
            return;
          }
          if (isOpen) {
            onClose();
            return;
          }
          onSelect();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="apple-note-main">
          <strong>{note.title}</strong>
          <div className="apple-note-meta">
            <span>{formatWhen(note.updatedAt)}</span>
            <span>{noteSnippet(note)}</span>
          </div>
          <div className="apple-note-folder">
            <span>🗂</span>
            <span>{folderName}</span>
          </div>
        </div>
        {note.images[0] && (
          <img className="apple-note-thumb" src={note.images[0].src} alt={note.images[0].name} />
        )}
      </button>
    </div>
  );
}

function draftMatchesNote(draft, note) {
  if (!draft || !note) {
    return false;
  }

  const parsed = splitEditorText(draft.editorText);

  return (
    parsed.title === note.title
    && draft.folderId === note.folderId
    && JSON.stringify(parseTags(draft.tagInput)) === JSON.stringify(note.tags)
    && draft.pinned === note.pinned
    && parsed.body === note.body
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
  const [mobileMode, setMobileMode] = useState("list");
  const [swipedNoteId, setSwipedNoteId] = useState(null);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
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

  const pinnedNotes = filteredNotes.filter((note) => note.pinned);
  const todayNotes = filteredNotes.filter((note) => isToday(note.updatedAt) && !note.pinned);
  const weekNotes = filteredNotes.filter((note) => isWithinLastDays(note.updatedAt, 7) && !isToday(note.updatedAt) && !note.pinned);
  const olderNotes = filteredNotes.filter((note) => !isWithinLastDays(note.updatedAt, 7) && !note.pinned);

  const slashState = draft ? getActiveSlashState(draft.editorText, draft.selectionStart ?? draft.editorText.length) : null;
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
        setMobileMode("list");
        setSaveState("Saved");
      })
      .catch(() => {
        const fallback = createFallbackWorkspace();
        setWorkspace(fallback);
        setSelectedNoteId(fallback.notes[0]?.id || null);
        setMobileMode("list");
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

    setDraft(buildDraftFromNote(selectedNote));
  }, [selectedNoteId, selectedNote?.updatedAt]);

  useEffect(() => {
    if (!workspace || !draft || !selectedNote) {
      return undefined;
    }

    if (draft.id !== selectedNote.id) {
      return undefined;
    }

    if (draftMatchesNote(draft, selectedNote)) {
      setSaveState("Saved");
      return undefined;
    }

    clearTimeout(saveTimerRef.current);
    setSaveState("Saving...");

    saveTimerRef.current = setTimeout(() => {
      const parsed = splitEditorText(draft.editorText);
      const nextNote = {
        ...selectedNote,
        title: parsed.title,
        folderId: draft.folderId,
        tags: parseTags(draft.tagInput),
        pinned: draft.pinned,
        body: parsed.body,
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

    const folder = { id: createId(), name: name.trim() };
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
    setDraft(buildDraftFromNote(note));
    setSearch("");
    setMobileSidebarOpen(false);
    setMobileMode("detail");
    setWorkspaceAndPersist(nextWorkspace, note.id);
  }

  function handleDuplicateNote() {
    if (!workspace || !selectedNote) {
      return;
    }

    const now = new Date().toISOString();
    const duplicate = {
      ...selectedNote,
      id: createId(),
      title: `${selectedNote.title} copy`,
      images: selectedNote.images.map((image) => ({ ...image })),
      createdAt: now,
      updatedAt: now
    };

    setDraft(buildDraftFromNote(duplicate));
    setMobileMode("detail");
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

  function handleTogglePin(noteId) {
    if (!workspace) {
      return;
    }

    const target = workspace.notes.find((note) => note.id === noteId);
    if (!target) {
      return;
    }

    const nextWorkspace = {
      ...workspace,
      notes: workspace.notes.map((note) => (
        note.id === noteId
          ? { ...note, pinned: !note.pinned, updatedAt: new Date().toISOString() }
          : note
      ))
    };

    setSwipedNoteId(null);
    setWorkspaceAndPersist(nextWorkspace, selectedNoteId);
  }

  function handleDeleteFromList(noteId) {
    if (!workspace) {
      return;
    }

    const target = workspace.notes.find((note) => note.id === noteId);
    if (!target) {
      return;
    }

    if (!window.confirm(`Delete "${target.title}"?`)) {
      return;
    }

    const nextNotes = workspace.notes.filter((note) => note.id !== noteId);
    setSwipedNoteId(null);
    setWorkspaceAndPersist({ ...workspace, notes: nextNotes }, nextNotes[0]?.id || null);
  }

  function applySlashCommand(command) {
    if (!draft || !slashState) {
      return;
    }

    const start = slashState.lineStart;
    const currentCursor = draft.selectionStart ?? draft.editorText.length;
    const nextBody = `${draft.editorText.slice(0, start)}${command.snippet}${draft.editorText.slice(currentCursor)}`;
    setDraft({
      ...draft,
      editorText: nextBody,
      selectionStart: start + command.snippet.length
    });
  }

  function insertAtCursor(snippet) {
    if (!draft) {
      return;
    }

    const start = draft.selectionStart ?? draft.editorText.length;
    const nextText = `${draft.editorText.slice(0, start)}${snippet}${draft.editorText.slice(start)}`;
    setDraft({
      ...draft,
      editorText: nextText,
      selectionStart: start + snippet.length
    });
    setInsertMenuOpen(false);
  }

  async function handleImageChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length || !draft) {
      return;
    }

    const images = await Promise.all(files.map(fileToDataUrl));
    const selectionStart = draft.selectionStart ?? draft.editorText.length;
    const markerText = images.map((image) => `\n![image:${image.id}]\n`).join("");
    const nextEditorText = `${draft.editorText.slice(0, selectionStart)}${markerText}${draft.editorText.slice(selectionStart)}`;

    setDraft({
      ...draft,
      editorText: nextEditorText,
      images: [...draft.images, ...images],
      selectionStart: selectionStart + markerText.length
    });
    event.target.value = "";
  }

  function jumpToNote(noteId) {
    setSelectedNoteId(noteId);
    setMobileMode("detail");
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
    <div className={`app-shell apple-layout ${mobileMode === "detail" ? "is-detail-mode" : "is-list-mode"}`}>
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
        <section className="workspace-grid apple-grid">
          <div className="panel note-panel apple-list-panel">
            <header className="notes-header">
              <div className="notes-header-row">
                <button className="back-link" type="button" onClick={() => setMobileSidebarOpen((current) => !current)}>
                  ‹ フォルダ
                </button>
                <button className="circle-action" type="button" onClick={handleExport}>⋯</button>
              </div>
              <h2 className="notes-title">すべての iCloud</h2>
              <div className="apple-search">
                <span className="apple-search-icon">⌕</span>
                <input
                  type="search"
                  placeholder="検索"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </header>

            {error && <div className="error-banner">{error}</div>}

            <div className="template-row apple-template-row">
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                {noteTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.label}</option>
                ))}
              </select>
            </div>

            <div className="notes-sections">
              {pinnedNotes.length > 0 && (
                <AppleSection
                  title="ピンで固定"
                  notes={pinnedNotes}
                  workspace={workspace}
                  selectedNote={selectedNote}
                  swipedNoteId={swipedNoteId}
                  setSwipedNoteId={setSwipedNoteId}
                  onTogglePin={handleTogglePin}
                  onDelete={handleDeleteFromList}
                  onSelect={(noteId) => {
                    setSelectedNoteId(noteId);
                    setMobileMode("detail");
                    setMobileSidebarOpen(false);
                  }}
                />
              )}
              <AppleSection
                title="今日"
                notes={todayNotes}
                workspace={workspace}
                selectedNote={selectedNote}
                swipedNoteId={swipedNoteId}
                setSwipedNoteId={setSwipedNoteId}
                onTogglePin={handleTogglePin}
                onDelete={handleDeleteFromList}
                onSelect={(noteId) => {
                  setSelectedNoteId(noteId);
                  setMobileMode("detail");
                  setMobileSidebarOpen(false);
                }}
              />
              <AppleSection
                title="過去7日間"
                notes={weekNotes}
                workspace={workspace}
                selectedNote={selectedNote}
                swipedNoteId={swipedNoteId}
                setSwipedNoteId={setSwipedNoteId}
                onTogglePin={handleTogglePin}
                onDelete={handleDeleteFromList}
                onSelect={(noteId) => {
                  setSelectedNoteId(noteId);
                  setMobileMode("detail");
                  setMobileSidebarOpen(false);
                }}
              />
              {olderNotes.length > 0 && (
                <AppleSection
                  title="それ以前"
                  notes={olderNotes}
                  workspace={workspace}
                  selectedNote={selectedNote}
                  swipedNoteId={swipedNoteId}
                  setSwipedNoteId={setSwipedNoteId}
                  onTogglePin={handleTogglePin}
                  onDelete={handleDeleteFromList}
                  onSelect={(noteId) => {
                    setSelectedNoteId(noteId);
                    setMobileMode("detail");
                    setMobileSidebarOpen(false);
                  }}
                />
              )}
            </div>

            <footer className="notes-footer">
              <span>{workspace.notes.length}件のメモ</span>
            </footer>
          </div>

          <div className="panel editor-panel apple-editor-panel">
            {draft ? (
              <>
                <header className="detail-topbar">
                  <button className="back-link" type="button" onClick={() => setMobileMode("list")}>
                    ‹ すべての iCloud
                  </button>
                  <div className="detail-actions">
                    <button className="icon-action" type="button" onClick={handleExport}>⤴</button>
                    <button className="icon-action" type="button" onClick={handleDuplicateNote}>⋯</button>
                  </div>
                </header>

                  <div className="editor-form apple-editor-form">
                  <div className="editor-area-wrap">
                    <textarea
                      className="editor-area apple-editor-area"
                      value={draft.editorText}
                      onChange={(event) => updateDraft("editorText", event.target.value)}
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

                  <div className="save-line">
                    <span>{saveState}</span>
                    <span>{draft.images.length} 枚の画像</span>
                    <span>Updated {formatWhen(selectedNote?.updatedAt || new Date().toISOString())}</span>
                  </div>

                  <div className="mobile-inline-preview">
                    {buildPreview({
                      ...draft,
                      title: splitEditorText(draft.editorText).title,
                      body: splitEditorText(draft.editorText).body,
                      tags: parseTags(draft.tagInput)
                    }, notesByTitle, jumpToNote)}
                  </div>

                  <div className="detail-bottom-bar">
                    <button className="bottom-icon" type="button" onClick={() => setMobileMode("list")}>☰</button>
                    <div className="insert-button-wrap">
                      <button className="bottom-icon" type="button" onClick={() => setInsertMenuOpen((current) => !current)}>≡</button>
                      {insertMenuOpen && (
                        <div className="insert-popover">
                          <button type="button" onClick={() => insertAtCursor("\n## 目次\n")}>目次追加</button>
                          <button type="button" onClick={() => insertAtCursor("\n---\n")}>区切り線</button>
                        </div>
                      )}
                    </div>
                    <label className="bottom-icon image-upload bottom-upload">
                      <span>📎</span>
                      <input type="file" accept="image/*" multiple onChange={handleImageChange} />
                    </label>
                    <button className="bottom-icon" type="button" onClick={handleCreateNote}>✎</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">Create your first note to start the new workspace.</div>
            )}
          </div>

          <div className="panel preview-panel apple-preview-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Preview</p>
                <h3>Readable note view</h3>
              </div>
            </div>

            {draft ? (
              <>
                <div className="preview-header">
                  <h2>{splitEditorText(draft.editorText).title || "Untitled"}</h2>
                  <div className="tag-row">
                    {parseTags(draft.tagInput).map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}
                    {draft.pinned && <span className="pill">Pinned</span>}
                  </div>
                </div>
                {buildPreview({
                  ...draft,
                  title: splitEditorText(draft.editorText).title,
                  body: splitEditorText(draft.editorText).body,
                  tags: parseTags(draft.tagInput)
                }, notesByTitle, jumpToNote)}
              </>
            ) : (
              <div className="empty-state">Preview appears here.</div>
            )}
          </div>
        </section>

        <button className="floating-compose-button" type="button" onClick={handleCreateNote}>
          ✎
        </button>
      </main>
    </div>
  );
}
