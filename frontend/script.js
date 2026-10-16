
const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send");
const clearBtn = document.getElementById("clear");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");

let history = [];
let isBusy = false;

// Create a chat message safely.
function addMessage(text, cls) {
  const div = document.createElement("div");
  div.className = `msg ${cls}`;
  div.textContent = text;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  return div;
}

// Render Markdown safely.
function renderMarkdown(el, text) {
  if (window.marked && window.DOMPurify) {
    el.innerHTML = window.DOMPurify.sanitize(
      window.marked.parse(text)
    );
  } else {
    el.textContent = text;
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Display retrieved document sources.
function addSources(msgEl, sources) {
  const details = document.createElement("details");
  details.className = "sources";

  const summary = document.createElement("summary");
  summary.textContent = `Sources (${sources.length})`;
  details.appendChild(summary);

  sources.forEach((source, index) => {
    const p = document.createElement("p");

    p.textContent =
      `[${index + 1}] ${source.label} (score ${source.score})\n${source.text}`;

    details.appendChild(p);
  });

  msgEl.appendChild(details);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Manage request state.
function setBusy(busy) {
  isBusy = busy;
  sendBtn.disabled = busy;
  inputEl.disabled = busy;
  uploadBtn.disabled = busy;
  clearBtn.disabled = busy;

  if (!busy) {
    inputEl.focus();
  }
}

// Send a message to the chatbot.
async function sendMessage() {
  if (isBusy) return;

  const text = inputEl.value.trim();
  if (!text) return;

  addMessage(text, "msg--user");

  inputEl.value = "";
  inputEl.style.height = "auto";

  setBusy(true);

  const loading = addMessage("Thinking...", "msg--loading");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: text,
        history,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || `Request failed (${res.status})`
      );
    }

    const { reply, sources } = await res.json();

    loading.remove();

    const msgEl = addMessage("", "msg--model");
    renderMarkdown(msgEl, reply);

    if (sources && sources.length > 0) {
      addSources(msgEl, sources);
    }

    history.push(
      { role: "user", content: text },
      { role: "model", content: reply }
    );
  } catch (error) {
    loading.remove();
    addMessage(`Error: ${error.message}`, "msg--error");
  } finally {
    setBusy(false);
  }
}

// Send button.
sendBtn.addEventListener("click", sendMessage);

// Enter sends; Shift + Enter adds a new line.
inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

// Automatically resize the textarea.
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = `${inputEl.scrollHeight}px`;
});

// Clear chat history and the uploaded document.
clearBtn.addEventListener("click", async () => {
  if (isBusy) return;

  setBusy(true);
  history = [];
  messagesEl.innerHTML = "";

  try {
    const res = await fetch("/api/document", {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }
  } catch (error) {
    addMessage(
      `Could not reset the document on the server: ${error.message}`,
      "msg--error"
    );
  } finally {
    setBusy(false);
  }
});

// Open the native file picker.
uploadBtn.addEventListener("click", () => {
  if (!isBusy) fileInput.click();
});

// Upload a PDF or another supported document.
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file || isBusy) return;

  setBusy(true);

  const status = addMessage(
    `Uploading ${file.name}...`,
    "msg--loading"
  );

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));

      throw new Error(
        err.detail || `Upload failed (${res.status})`
      );
    }

    const data = await res.json();

    status.remove();

    addMessage(
      `Uploaded ${data.filename}: ${data.chunk_count} chunks embedded. Ask me anything about it.`,
      "msg--model"
    );
  } catch (error) {
    status.remove();

    addMessage(
      `Error: ${error.message}`,
      "msg--error"
    );
  } finally {
    fileInput.value = "";
    setBusy(false);
  }
});
