import { useEffect, useMemo, useRef, useState } from "react";

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

  return {
    folders: [
      { id: inboxId, name: "Inbox" },
      { id: workId, name: "Work" },
      { id: ideasId, name: "Ideas" }
    ],
    notes: [
      {
        id: createId(),
        title: "Chatgpt の内容をメモまとめるアプリ",
        folderId: inboxId,
        tags: ["welcome", "memo"],
        pinned: true,
        body: [
          "<h1>Chatgpt の内容をメモまとめるアプリ</h1>",
          "<p>目次付き</p>",
          "<p>自動詞他動詞</p>",
          "<p>検索機能</p>",
          "<p>画像も貼れる</p>"
        ].join(""),
        images: [],
        createdAt: now,
        updatedAt: now
      },
      {
        id: createId(),
        title: "ワークボート",
        folderId: workId,
        tags: ["work"],
        pinned: false,
        body: "<h1>ワークボート</h1><p>月曜日 松下様</p><p>会員</p>",
        images: [],
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function legacyBodyToHtml(title, body, images = []) {
  const lines = (body || "").split("\n");
  const html = [
    `<h1>${escapeHtml(title || "Untitled")}</h1>`,
    ...lines.map((line) => {
      if (!line.trim()) {
        return "<p><br></p>";
      }
      return `<p>${escapeHtml(line)}</p>`;
    }),
    ...images.map((image) => `<figure class="editor-image"><img src="${image.src}" alt="${escapeHtml(image.name || "image")}"></figure>`)
  ];

  return html.join("");
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
  const notes = Array.isArray(candidate.notes) && candidate.notes.length
    ? candidate.notes
        .filter((note) => note && typeof note.title === "string")
        .map((note) => {
          const images = Array.isArray(note.images)
            ? note.images
                .filter((image) => image && typeof image.src === "string")
                .map((image) => ({
                  src: image.src,
                  name: typeof image.name === "string" ? image.name : "image"
                }))
            : [];

          const body = typeof note.body === "string" && note.body.includes("<")
            ? note.body
            : legacyBodyToHtml(note.title, typeof note.body === "string" ? note.body : "", images);

          return {
            id: typeof note.id === "string" ? note.id : createId(),
            title: note.title.trim() || "Untitled",
            folderId: folderIds.has(note.folderId) ? note.folderId : firstFolderId,
            tags: Array.isArray(note.tags)
              ? note.tags.filter((tag) => typeof tag === "string").map((tag) => tag.toLowerCase())
              : [],
            pinned: Boolean(note.pinned),
            body,
            images: [],
            isDraft: false,
            createdAt: typeof note.createdAt === "string" ? note.createdAt : new Date().toISOString(),
            updatedAt: typeof note.updatedAt === "string" ? note.updatedAt : new Date().toISOString()
          };
        })
    : fallback.notes;

  return { folders, notes };
}

function createNote(folderId) {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: "",
    folderId,
    tags: [],
    pinned: false,
    body: "<h1><br></h1><p><br></p>",
    images: [],
    isDraft: true,
    createdAt: now,
    updatedAt: now
  };
}

function htmlToPlainText(html) {
  const temporary = document.createElement("div");
  temporary.innerHTML = html;
  return temporary.textContent?.replace(/\s+/g, " ").trim() || "";
}

function extractTitleFromHtml(html) {
  const temporary = document.createElement("div");
  temporary.innerHTML = html;
  const firstBlock = temporary.querySelector("h1, h2, h3, p, div");
  const title = firstBlock?.textContent?.trim();
  return title || "Untitled";
}

function isMeaningfulHtml(html) {
  const temporary = document.createElement("div");
  temporary.innerHTML = html;
  const hasText = temporary.textContent?.replace(/\s+/g, "").trim();
  const hasImage = temporary.querySelector("img, figure");
  return Boolean(hasText || hasImage);
}

function extractSnippetFromHtml(html) {
  const temporary = document.createElement("div");
  temporary.innerHTML = html;
  const blocks = Array.from(temporary.children)
    .map((node) => node.textContent?.trim() || "")
    .filter(Boolean);

  return blocks.slice(1).join(" ").slice(0, 96) || "メモ";
}

function formatWhen(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function isToday(value) {
  const target = new Date(value);
  const today = new Date();
  return target.toDateString() === today.toDateString();
}

function isWithinLastDays(value, days) {
  const target = new Date(value).getTime();
  return Date.now() - target <= days * 24 * 60 * 60 * 1000;
}

function useGroupedNotes(notes) {
  return useMemo(() => ({
    pinned: notes.filter((note) => note.pinned),
    today: notes.filter((note) => isToday(note.updatedAt) && !note.pinned),
    week: notes.filter((note) => isWithinLastDays(note.updatedAt, 7) && !isToday(note.updatedAt) && !note.pinned),
    older: notes.filter((note) => !isWithinLastDays(note.updatedAt, 7) && !note.pinned)
  }), [notes]);
}

function AppleSection({
  title,
  notes,
  folderNameById,
  selectedNoteId,
  selectionMode,
  selectedNoteIds,
  swipedNoteId,
  setSwipedNoteId,
  onSelect,
  onDelete,
  onTogglePin
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
            folderName={folderNameById.get(note.folderId) || "メモ"}
            isActive={selectedNoteId === note.id}
            selectionMode={selectionMode}
            isSelected={selectedNoteIds.includes(note.id)}
            isOpen={swipedNoteId === note.id}
            onOpen={() => setSwipedNoteId(note.id)}
            onClose={() => setSwipedNoteId(null)}
            onSelect={() => onSelect(note.id)}
            onDelete={() => onDelete(note.id)}
            onTogglePin={() => onTogglePin(note.id)}
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
  selectionMode,
  isSelected,
  isOpen,
  onOpen,
  onClose,
  onSelect,
  onDelete,
  onTogglePin
}) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const moved = useRef(false);
  const deltaX = useRef(0);

  function handleTouchStart(event) {
    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
    moved.current = false;
    deltaX.current = 0;
  }

  function handleTouchMove(event) {
    if (selectionMode) {
      return;
    }
    deltaX.current = event.touches[0].clientX - touchStartX.current;
    const deltaY = event.touches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX.current) > 10 || Math.abs(deltaY) > 10) {
      moved.current = true;
    }
  }

  function handleTouchEnd() {
    if (selectionMode) {
      if (!moved.current) {
        onSelect();
      }
      return;
    }

    if (deltaX.current < -36) {
      onOpen();
      return;
    }

    if (deltaX.current > 36) {
      onClose();
      return;
    }

    if (!moved.current && !isOpen) {
      onSelect();
    }
  }

  return (
    <div className={`swipe-row ${isOpen ? "is-open" : ""} ${selectionMode ? "is-selection-mode" : ""}`}>
      <div className="swipe-actions">
        <button className="swipe-action swipe-pin" type="button" onClick={onTogglePin}>
          {note.pinned ? "Unpin" : "Pin"}
        </button>
        <button className="swipe-action swipe-delete" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>

      <button
        className={`apple-note-card ${isActive ? "is-active" : ""} ${isSelected ? "is-selected" : ""}`}
        type="button"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (moved.current) {
            moved.current = false;
            return;
          }
          if (isOpen) {
            onClose();
            return;
          }
          onSelect();
        }}
      >
        {selectionMode && (
          <span className={`selection-check ${isSelected ? "is-selected" : ""}`} aria-hidden="true">
            {isSelected ? "✓" : ""}
          </span>
        )}
        <div className="apple-note-main">
          <strong>{note.title}</strong>
          <div className="apple-note-meta">
            <span>{formatWhen(note.updatedAt)}</span>
            <span>{extractSnippetFromHtml(note.body)}</span>
          </div>
          <div className="apple-note-folder">
            <span>🗂</span>
            <span>{folderName}</span>
          </div>
        </div>
      </button>
    </div>
  );
}

export default function App() {
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const hydratedNoteIdRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const saveTimerRef = useRef(null);

  const [workspace, setWorkspace] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFolderId, setActiveFolderId] = useState("all");
  const [mobileMode, setMobileMode] = useState("list");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("Loading...");
  const [error, setError] = useState("");
  const [swipedNoteId, setSwipedNoteId] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [draftHtml, setDraftHtml] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);

  useEffect(() => {
    fetch("/api/workspace")
      .then((response) => {
        if (!response.ok) {
          throw new Error("load failed");
        }
        return response.json();
      })
      .then((payload) => {
        const normalized = normalizeWorkspace(payload);
        setWorkspace(normalized);
        setSelectedNoteId(normalized.notes[0]?.id || null);
      })
      .catch(() => {
        const fallback = createFallbackWorkspace();
        setWorkspace(fallback);
        setSelectedNoteId(fallback.notes[0]?.id || null);
        setError("API load failed. Showing fallback data.");
      })
      .finally(() => {
        setLoading(false);
        setSaveState("Saved");
      });
  }, []);

  const filteredNotes = useMemo(() => {
    if (!workspace) {
      return [];
    }

    return workspace.notes
      .filter((note) => {
        const matchesFolder = activeFolderId === "all" ? true : note.folderId === activeFolderId;
        const query = search.trim().toLowerCase();
        const haystack = `${note.title} ${htmlToPlainText(note.body)} ${note.tags.join(" ")}`.toLowerCase();
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

  const grouped = useGroupedNotes(filteredNotes);
  const folderNameById = useMemo(
    () => new Map((workspace?.folders || []).map((folder) => [folder.id, folder.name])),
    [workspace]
  );

  useEffect(() => {
    if (!selectedNote) {
      return;
    }

    hydratedNoteIdRef.current = selectedNote.id;
    setDraftHtml(selectedNote.body);
    if (editorRef.current && editorRef.current.innerHTML !== selectedNote.body) {
      editorRef.current.innerHTML = selectedNote.body;
    }
    setSheet(null);
  }, [selectedNote?.id]);

  useEffect(() => {
    if (!workspace || !selectedNote) {
      return undefined;
    }

    if (draftHtml === selectedNote.body) {
      setSaveState(selectedNote.isDraft ? "Not saved" : "Saved");
      return undefined;
    }

    if (!isMeaningfulHtml(draftHtml)) {
      setSaveState(selectedNote.isDraft ? "Not saved" : "Saved");
      return undefined;
    }

    clearTimeout(saveTimerRef.current);
    setSaveState("Saving...");

    saveTimerRef.current = setTimeout(() => {
      const nextTitle = extractTitleFromHtml(draftHtml);
      const nextWorkspace = {
        ...workspace,
        notes: workspace.notes.map((note) => (
          note.id === selectedNote.id
            ? {
                ...note,
                title: nextTitle,
                body: draftHtml,
                isDraft: false,
                updatedAt: new Date().toISOString()
              }
            : note
        ))
      };

      persistWorkspace(nextWorkspace, selectedNote.id);
    }, 400);

    return () => clearTimeout(saveTimerRef.current);
  }, [draftHtml]);

  function persistWorkspace(nextWorkspace, nextSelectedId) {
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
          throw new Error("save failed");
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
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    const selection = window.getSelection();
    if (!selection || !savedRangeRef.current) {
      return;
    }
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  }

  function keepEditorSelection(event) {
    event.preventDefault();
    editorRef.current?.focus();
    restoreSelection();
  }

  function toggleSheet(nextSheet) {
    editorRef.current?.focus();
    restoreSelection();
    setEditorFocused(true);
    setSheet((current) => (current === nextSheet ? null : nextSheet));
  }

  function handleEditorFocus() {
    setEditorFocused(true);
    saveSelection();
  }

  function handleEditorBlur() {
    window.setTimeout(() => {
      if (document.activeElement === editorRef.current) {
        return;
      }
      setEditorFocused(false);
      setSheet(null);
    }, 0);
  }

  function syncDraftFromEditor() {
    if (!editorRef.current) {
      return;
    }
    setDraftHtml(editorRef.current.innerHTML);
    saveSelection();
  }

  function getCurrentBlock() {
    restoreSelection();
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    if (!node) {
      return null;
    }
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return element?.closest("h1, h2, h3, p, figure, div");
  }

  function changeBlockTag(tagName) {
    const block = getCurrentBlock();
    if (!block || !editorRef.current || block.tagName.toLowerCase() === "figure") {
      return;
    }

    const replacement = document.createElement(tagName);
    replacement.innerHTML = block.innerHTML || "<br>";
    replacement.className = block.className;
    if (block.dataset.toc === "true") {
      replacement.dataset.toc = "true";
    }
    block.replaceWith(replacement);
    setDraftHtml(editorRef.current.innerHTML);
    setSheet(null);
  }

  function toggleTocOnBlock() {
    const block = getCurrentBlock();
    if (!block || !editorRef.current) {
      return;
    }
    block.dataset.toc = block.dataset.toc === "true" ? "false" : "true";
    setDraftHtml(editorRef.current.innerHTML);
    setSheet(null);
  }

  function applyBlockStyle(attribute, value) {
    const block = getCurrentBlock();
    if (!block || !editorRef.current) {
      return;
    }

    if (value === "clear") {
      delete block.dataset[attribute];
    } else {
      block.dataset[attribute] = value;
    }
    setDraftHtml(editorRef.current.innerHTML);
  }

  function applyBold(weight) {
    const block = getCurrentBlock();
    if (!block || !editorRef.current) {
      return;
    }
    block.dataset.weight = weight;
    setDraftHtml(editorRef.current.innerHTML);
  }

  function handleUndo() {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("undo");
    requestAnimationFrame(() => {
      syncDraftFromEditor();
      saveSelection();
    });
  }

  function handleRedo() {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("redo");
    requestAnimationFrame(() => {
      syncDraftFromEditor();
      saveSelection();
    });
  }

  function insertImageAtCursor(image) {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const figure = document.createElement("figure");
    figure.className = "editor-image";
    figure.innerHTML = `<img src="${image.src}" alt="${escapeHtml(image.name)}">`;
    range.deleteContents();
    range.insertNode(figure);

    const paragraph = document.createElement("p");
    paragraph.innerHTML = "<br>";
    figure.after(paragraph);

    const nextRange = document.createRange();
    nextRange.setStart(paragraph, 0);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    saveSelection();
    syncDraftFromEditor();
    setSheet(null);
  }

  async function handleImageFiles(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    const images = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ src: reader.result, name: file.name });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));

    images.forEach(insertImageAtCursor);
    event.target.value = "";
  }

  function handleCreateNote() {
    if (!workspace) {
      return;
    }

    const folderId = activeFolderId === "all" ? workspace.folders[0]?.id : activeFolderId;
    const note = createNote(folderId);
    const nextWorkspace = { ...workspace, notes: [note, ...workspace.notes] };
    setSelectionMode(false);
    setSelectedNoteIds([]);
    setListMenuOpen(false);
    setMobileMode("detail");
    setWorkspace(nextWorkspace);
    setSelectedNoteId(note.id);
    setDraftHtml(note.body);
    setSaveState("Not saved");
  }

  function discardBlankDraftIfNeeded() {
    if (!workspace || !selectedNote?.isDraft || isMeaningfulHtml(draftHtml)) {
      return false;
    }

    const nextNotes = workspace.notes.filter((note) => note.id !== selectedNote.id);
    const nextSelectedId = nextNotes[0]?.id || null;
    clearTimeout(saveTimerRef.current);
    setWorkspace({ ...workspace, notes: nextNotes });
    setSelectedNoteId(nextSelectedId);
    setDraftHtml(nextNotes.find((note) => note.id === nextSelectedId)?.body || "");
    setSaveState("Saved");
    return true;
  }

  function flushCurrentNoteBeforeLeaving() {
    if (!workspace || !selectedNote) {
      return;
    }

    clearTimeout(saveTimerRef.current);
    if (!isMeaningfulHtml(draftHtml)) {
      discardBlankDraftIfNeeded();
      return;
    }

    if (draftHtml === selectedNote.body && !selectedNote.isDraft) {
      return;
    }

    const nextTitle = extractTitleFromHtml(draftHtml);
    const nextWorkspace = {
      ...workspace,
      notes: workspace.notes.map((note) => (
        note.id === selectedNote.id
          ? {
              ...note,
              title: nextTitle,
              body: draftHtml,
              isDraft: false,
              updatedAt: new Date().toISOString()
            }
          : note
      ))
    };

    persistWorkspace(nextWorkspace, selectedNote.id);
  }

  function handleReturnToList() {
    flushCurrentNoteBeforeLeaving();
    setEditorFocused(false);
    setSheet(null);
    setMobileMode("list");
  }

  function handleDeleteNote(noteId = selectedNoteId) {
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
    persistWorkspace({ ...workspace, notes: nextNotes }, nextNotes[0]?.id || null);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedNoteIds([]);
    setListMenuOpen(false);
    setSwipedNoteId(null);
  }

  function toggleSelectionMode() {
    if (selectionMode) {
      exitSelectionMode();
      return;
    }
    setSelectionMode(true);
    setSelectedNoteIds([]);
    setListMenuOpen(false);
    setSwipedNoteId(null);
  }

  function handleSelectAllVisible() {
    if (!filteredNotes.length) {
      return;
    }
    setSelectionMode(true);
    setSelectedNoteIds(filteredNotes.map((note) => note.id));
    setListMenuOpen(false);
    setSwipedNoteId(null);
  }

  function handleListNotePress(noteId) {
    if (selectionMode) {
      setSelectedNoteIds((current) => (
        current.includes(noteId)
          ? current.filter((id) => id !== noteId)
          : [...current, noteId]
      ));
      return;
    }

    flushCurrentNoteBeforeLeaving();
    setSelectedNoteId(noteId);
    setMobileMode("detail");
  }

  function handleDeleteSelected() {
    if (!workspace || selectedNoteIds.length === 0) {
      return;
    }

    const count = selectedNoteIds.length;
    if (!window.confirm(`${count}件のメモを削除しますか？`)) {
      return;
    }

    const nextNotes = workspace.notes.filter((note) => !selectedNoteIds.includes(note.id));
    const nextSelectedId = selectedNoteIds.includes(selectedNoteId) ? nextNotes[0]?.id || null : selectedNoteId;
    setSwipedNoteId(null);
    setSelectionMode(false);
    setSelectedNoteIds([]);
    persistWorkspace({ ...workspace, notes: nextNotes }, nextSelectedId);
  }

  function handleTogglePin(noteId) {
    if (!workspace) {
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
    persistWorkspace(nextWorkspace, selectedNoteId);
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
    persistWorkspace({ ...workspace, folders: [...workspace.folders, folder] }, selectedNoteId);
  }

  if (loading || !workspace) {
    return <div className="loading-screen">Loading MemoGPT...</div>;
  }

  const shouldShowKeyboardTools = editorFocused;

  return (
    <div className={`app-shell apple-layout ${mobileMode === "detail" ? "is-detail-mode" : "is-list-mode"}`}>
      <aside className="sidebar">
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
              <strong>{workspace.notes.filter((note) => note.folderId === folder.id).length}</strong>
            </button>
          ))}
        </div>
      </aside>

      <main className="workspace">
        <section className="workspace-grid apple-grid">
          <div className="panel apple-list-panel">
            <header className="notes-header">
              <div className="notes-header-row">
                <span className="back-link">‹ フォルダ</span>
                <div className="header-menu">
                  <button className="circle-action" type="button" onClick={() => setListMenuOpen((open) => !open)}>⋯</button>
                  {listMenuOpen && (
                    <div className="header-dropdown">
                      <button type="button" onClick={toggleSelectionMode}>
                        {selectionMode ? "選択を終了" : "複数選択"}
                      </button>
                      <button type="button" onClick={handleSelectAllVisible}>すべて選択</button>
                    </div>
                  )}
                </div>
              </div>
              <h2 className="notes-title">すべての iCloud</h2>
              <div className="apple-search">
                <span className="apple-search-icon">⌕</span>
                <input type="search" placeholder="検索" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              {selectionMode && (
                <div className="selection-banner">
                  <span>{selectedNoteIds.length}件を選択中</span>
                  <button type="button" onClick={exitSelectionMode}>キャンセル</button>
                </div>
              )}
            </header>

            {error && <div className="error-banner">{error}</div>}

            <div className="notes-sections">
              <AppleSection
                title="ピンで固定"
                notes={grouped.pinned}
                folderNameById={folderNameById}
                selectedNoteId={selectedNote?.id}
                selectionMode={selectionMode}
                selectedNoteIds={selectedNoteIds}
                swipedNoteId={swipedNoteId}
                setSwipedNoteId={setSwipedNoteId}
                onSelect={handleListNotePress}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePin}
              />
              <AppleSection
                title="今日"
                notes={grouped.today}
                folderNameById={folderNameById}
                selectedNoteId={selectedNote?.id}
                selectionMode={selectionMode}
                selectedNoteIds={selectedNoteIds}
                swipedNoteId={swipedNoteId}
                setSwipedNoteId={setSwipedNoteId}
                onSelect={handleListNotePress}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePin}
              />
              <AppleSection
                title="過去7日間"
                notes={grouped.week}
                folderNameById={folderNameById}
                selectedNoteId={selectedNote?.id}
                selectionMode={selectionMode}
                selectedNoteIds={selectedNoteIds}
                swipedNoteId={swipedNoteId}
                setSwipedNoteId={setSwipedNoteId}
                onSelect={handleListNotePress}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePin}
              />
              <AppleSection
                title="それ以前"
                notes={grouped.older}
                folderNameById={folderNameById}
                selectedNoteId={selectedNote?.id}
                selectionMode={selectionMode}
                selectedNoteIds={selectedNoteIds}
                swipedNoteId={swipedNoteId}
                setSwipedNoteId={setSwipedNoteId}
                onSelect={handleListNotePress}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePin}
              />
            </div>

            <footer className="notes-footer">
              <span>{workspace.notes.length}件のメモ</span>
            </footer>
          </div>

          <div className="panel apple-editor-panel">
            {selectedNote && (
              <>
                <header className="detail-topbar">
                  <button className="back-link" type="button" onClick={handleReturnToList}>‹ すべての iCloud</button>
                  <div className="detail-actions">
                    <button className="icon-action" type="button">⤴</button>
                    <button className="icon-action" type="button" onClick={() => handleDeleteNote(selectedNote.id)}>⋯</button>
                  </div>
                </header>

                <div
                  ref={editorRef}
                  className={`live-editor ${shouldShowKeyboardTools ? "has-keyboard-tools" : ""}`}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncDraftFromEditor}
                  onFocus={handleEditorFocus}
                  onBlur={handleEditorBlur}
                  onKeyUp={saveSelection}
                  onMouseUp={saveSelection}
                  onTouchEnd={saveSelection}
                />

                {shouldShowKeyboardTools && sheet && (
                  <div className="editor-sheet">
                    {sheet === "insert" && (
                      <div className="sheet-grid">
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => changeBlockTag("h1")}>見出し 1</button>
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => changeBlockTag("h2")}>見出し 2</button>
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => changeBlockTag("h3")}>見出し 3</button>
                        <button type="button" onMouseDown={keepEditorSelection} onClick={toggleTocOnBlock}>見出しを目次に表示</button>
                      </div>
                    )}

                    {sheet === "format" && (
                      <div className="sheet-grid">
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyBlockStyle("size", "small")}>小さく</button>
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyBlockStyle("size", "large")}>大きく</button>
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyBlockStyle("font", "serif")}>明朝</button>
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyBlockStyle("font", "mono")}>等幅</button>
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyBold("medium")}>中太</button>
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => applyBold("bold")}>太字</button>
                      </div>
                    )}

                    {sheet === "image" && (
                      <div className="sheet-grid">
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => imageInputRef.current?.click()}>写真から選ぶ</button>
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => fileInputRef.current?.click()}>ファイルから選ぶ</button>
                        <button type="button" onMouseDown={keepEditorSelection} onClick={() => cameraInputRef.current?.click()}>カメラで撮る</button>
                      </div>
                    )}
                  </div>
                )}

                {shouldShowKeyboardTools && (
                  <div className="detail-bottom-bar">
                    <button className="bottom-icon" type="button" onMouseDown={keepEditorSelection} onClick={handleReturnToList}>☰</button>
                    <button className={`bottom-icon ${sheet === "insert" ? "is-active" : ""}`} type="button" onMouseDown={keepEditorSelection} onClick={() => toggleSheet("insert")}>＋</button>
                    <button className={`bottom-icon ${sheet === "format" ? "is-active" : ""}`} type="button" onMouseDown={keepEditorSelection} onClick={() => toggleSheet("format")}>Aa</button>
                    <button className={`bottom-icon ${sheet === "image" ? "is-active" : ""}`} type="button" onMouseDown={keepEditorSelection} onClick={() => toggleSheet("image")}>🖼</button>
                    <button className="bottom-icon" type="button" onMouseDown={keepEditorSelection} onClick={handleUndo}>↶</button>
                    <button className="bottom-icon" type="button" onMouseDown={keepEditorSelection} onClick={handleRedo}>↷</button>
                    <button className="bottom-icon" type="button" onMouseDown={keepEditorSelection} onClick={handleCreateNote}>✎</button>
                  </div>
                )}

                <input ref={imageInputRef} className="hidden-input" type="file" accept="image/*" multiple onChange={handleImageFiles} />
                <input ref={fileInputRef} className="hidden-input" type="file" accept="image/*" multiple onChange={handleImageFiles} />
                <input ref={cameraInputRef} className="hidden-input" type="file" accept="image/*" capture="environment" onChange={handleImageFiles} />

                <div className="save-line">
                  <span>{saveState}</span>
                  <span>{formatWhen(selectedNote.updatedAt)}</span>
                </div>
              </>
            )}
          </div>
        </section>

        <div className="floating-action-stack">
          {selectionMode && selectedNoteIds.length > 0 && (
            <button className="floating-delete-button" type="button" onClick={handleDeleteSelected}>削除</button>
          )}
          <button className="floating-compose-button" type="button" onClick={handleCreateNote}>✎</button>
        </div>
      </main>
    </div>
  );
}
