const STORAGE_KEY = "chatgpt-memo-notes";
const initialNotes = [
  {
    id: crypto.randomUUID(),
    title: "英作文の型",
    body: "主張→理由→具体例の順で書くとまとまりやすい。\nChatGPTの回答から使える例文だけを抜き出してメモする。",
    images: []
  },
  {
    id: crypto.randomUUID(),
    title: "面接対策",
    body: "想定質問ごとに答えを短く作っておく。\nあとで検索しやすいよう、題目を分けて保存する。",
    images: []
  }
];

const state = {
  notes: loadNotes(),
  query: "",
  pressTimer: null,
  selectedImage: null,
  editingNoteId: null,
  draftImages: []
};

const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");
const tocList = document.getElementById("tocList");
const noteForm = document.getElementById("noteForm");
const formHeading = document.getElementById("formHeading");
const cancelEditButton = document.getElementById("cancelEditButton");
const submitButton = document.getElementById("submitButton");
const titleInput = document.getElementById("titleInput");
const bodyInput = document.getElementById("bodyInput");
const imageInput = document.getElementById("imageInput");
const editingImages = document.getElementById("editingImages");
const searchInput = document.getElementById("searchInput");
const searchStatus = document.getElementById("searchStatus");
const notesContainer = document.getElementById("notesContainer");
const noteTemplate = document.getElementById("noteTemplate");
const editingImageTemplate = document.getElementById("editingImageTemplate");
const imageMenu = document.getElementById("imageMenu");
const exportButton = document.getElementById("exportButton");
const importInput = document.getElementById("importInput");

registerServiceWorker();
applyInitialSidebarState();
render();

menuToggle.addEventListener("click", () => {
  sidebar.classList.toggle("is-hidden");
});

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const imageFiles = Array.from(imageInput.files || []);
  const newImages = await Promise.all(imageFiles.map(fileToDataUrl));
  const preparedNewImages = newImages.map(src => ({ src, size: "medium" }));

  if (state.editingNoteId) {
    const note = state.notes.find(item => item.id === state.editingNoteId);
    if (!note) {
      resetForm();
      return;
    }

    note.title = title;
    note.body = body;
    note.images = [...state.draftImages, ...preparedNewImages];
  } else {
    state.notes.unshift({
      id: crypto.randomUUID(),
      title,
      body,
      images: preparedNewImages
    });
  }

  persistNotes();
  resetForm();
  render();
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
  render();
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  render();
});

exportButton.addEventListener("click", () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    notes: state.notes
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `chatgpt-memo-backup-${formatDate(new Date())}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async (event) => {
  const [file] = Array.from(event.target.files || []);
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedNotes = normalizeImportedNotes(parsed.notes || parsed);
    if (!importedNotes.length) {
      throw new Error("メモが見つかりません");
    }

    state.notes = importedNotes;
    persistNotes();
    resetForm();
    render();
  } catch (error) {
    window.alert(`読み込みに失敗しました: ${error.message}`);
  } finally {
    importInput.value = "";
  }
});

imageMenu.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-size]");
  if (!button || !state.selectedImage) {
    return;
  }

  const { noteId, imageIndex } = state.selectedImage.dataset;
  const note = state.notes.find(item => item.id === noteId);
  if (!note) {
    hideImageMenu();
    return;
  }

  note.images[Number(imageIndex)].size = button.dataset.size;
  persistNotes();
  render();
  hideImageMenu();
});

document.addEventListener("click", (event) => {
  if (!imageMenu.contains(event.target)) {
    hideImageMenu();
  }
});

function applyInitialSidebarState() {
  if (window.innerWidth > 920) {
    sidebar.classList.remove("is-hidden");
  }
}

function loadNotes() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialNotes));
    return initialNotes;
  }

  try {
    const parsed = JSON.parse(saved);
    return normalizeImportedNotes(parsed);
  } catch {
    return initialNotes;
  }
}

function persistNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
}

function getFilteredNotes() {
  if (!state.query) {
    return state.notes;
  }

  return state.notes.filter(note => {
    const haystack = `${note.title} ${note.body}`.toLowerCase();
    return haystack.includes(state.query);
  });
}

function render() {
  const filteredNotes = getFilteredNotes();
  renderToc(filteredNotes);
  renderNotes(filteredNotes);
  renderEditingImages();
  searchStatus.textContent = state.query
    ? `「${state.query}」の検索結果: ${filteredNotes.length}件`
    : "すべて表示中";
}

function renderToc(notes) {
  tocList.innerHTML = "";

  if (!notes.length) {
    tocList.innerHTML = "<p>表示できる題目がありません。</p>";
    return;
  }

  notes.forEach(note => {
    const link = document.createElement("a");
    link.className = "toc-link";
    link.href = `#note-${note.id}`;
    link.textContent = note.title;
    link.addEventListener("click", () => {
      if (window.innerWidth <= 920) {
        sidebar.classList.add("is-hidden");
      }
    });
    tocList.appendChild(link);
  });
}

function renderNotes(notes) {
  notesContainer.innerHTML = "";

  if (!notes.length) {
    notesContainer.innerHTML = '<div class="empty-state">該当するメモがありません。</div>';
    return;
  }

  notes.forEach(note => {
    const fragment = noteTemplate.content.cloneNode(true);
    const article = fragment.querySelector(".note-card");
    const titleElement = fragment.querySelector(".note-title");
    const bodyElement = fragment.querySelector(".note-body");
    const imageWrap = fragment.querySelector(".note-images");
    const editButton = fragment.querySelector(".note-edit-button");
    const deleteButton = fragment.querySelector(".note-delete-button");

    article.id = `note-${note.id}`;
    titleElement.textContent = note.title;
    bodyElement.textContent = note.body || "本文なし";

    editButton.addEventListener("click", () => {
      startEditing(note.id);
    });

    deleteButton.addEventListener("click", () => {
      deleteNote(note.id);
    });

    note.images.forEach((image, index) => {
      const img = document.createElement("img");
      img.src = image.src;
      img.alt = `${note.title} の画像 ${index + 1}`;
      img.className = `note-image size-${image.size || "medium"}`;
      img.dataset.noteId = note.id;
      img.dataset.imageIndex = String(index);
      bindImagePressEvents(img);
      imageWrap.appendChild(img);
    });

    notesContainer.appendChild(fragment);
  });
}

function renderEditingImages() {
  editingImages.innerHTML = "";
  editingImages.classList.toggle("hidden", state.draftImages.length === 0);

  state.draftImages.forEach((image, index) => {
    const fragment = editingImageTemplate.content.cloneNode(true);
    const preview = fragment.querySelector(".editing-image-preview");
    const removeButton = fragment.querySelector(".remove-image-button");

    preview.src = image.src;
    removeButton.addEventListener("click", () => {
      state.draftImages = state.draftImages.filter((_, currentIndex) => currentIndex !== index);
      renderEditingImages();
    });

    editingImages.appendChild(fragment);
  });
}

function startEditing(noteId) {
  const note = state.notes.find(item => item.id === noteId);
  if (!note) {
    return;
  }

  state.editingNoteId = note.id;
  state.draftImages = note.images.map(image => ({ ...image }));
  formHeading.textContent = "メモを編集";
  submitButton.textContent = "更新する";
  cancelEditButton.classList.remove("hidden");
  titleInput.value = note.title;
  bodyInput.value = note.body;
  imageInput.value = "";
  renderEditingImages();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  state.editingNoteId = null;
  state.draftImages = [];
  formHeading.textContent = "新しいメモを追加";
  submitButton.textContent = "メモを保存";
  cancelEditButton.classList.add("hidden");
  noteForm.reset();
  renderEditingImages();
}

function deleteNote(noteId) {
  const note = state.notes.find(item => item.id === noteId);
  if (!note) {
    return;
  }

  const confirmed = window.confirm(`「${note.title}」を削除しますか？`);
  if (!confirmed) {
    return;
  }

  state.notes = state.notes.filter(item => item.id !== noteId);
  if (state.editingNoteId === noteId) {
    resetForm();
  }
  persistNotes();
  render();
}

function bindImagePressEvents(img) {
  const startPress = (event) => {
    event.preventDefault();
    clearTimeout(state.pressTimer);
    state.pressTimer = setTimeout(() => {
      state.selectedImage = img;
      showImageMenu(event);
    }, 450);
  };

  const cancelPress = () => {
    clearTimeout(state.pressTimer);
  };

  img.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    state.selectedImage = img;
    showImageMenu(event);
  });

  img.addEventListener("pointerdown", startPress);
  img.addEventListener("pointerup", cancelPress);
  img.addEventListener("pointerleave", cancelPress);
  img.addEventListener("pointercancel", cancelPress);
}

function showImageMenu(event) {
  imageMenu.classList.remove("hidden");
  const pointX = "clientX" in event ? event.clientX : 20;
  const pointY = "clientY" in event ? event.clientY : 20;
  imageMenu.style.left = `${Math.min(pointX, window.innerWidth - 180)}px`;
  imageMenu.style.top = `${Math.min(pointY, window.innerHeight - 60)}px`;
}

function hideImageMenu() {
  imageMenu.classList.add("hidden");
  state.selectedImage = null;
}

function normalizeImportedNotes(candidate) {
  if (!Array.isArray(candidate)) {
    return initialNotes;
  }

  return candidate
    .filter(note => note && typeof note.title === "string")
    .map(note => ({
      id: typeof note.id === "string" ? note.id : crypto.randomUUID(),
      title: note.title,
      body: typeof note.body === "string" ? note.body : "",
      images: Array.isArray(note.images)
        ? note.images
            .filter(image => image && typeof image.src === "string")
            .map(image => ({
              src: image.src,
              size: ["small", "medium", "large"].includes(image.size) ? image.size : "medium"
            }))
        : []
    }));
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
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
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      return null;
    });
  });
}
