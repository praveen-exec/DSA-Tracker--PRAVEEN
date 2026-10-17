import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
  signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc,
  deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { starterQuestions } from "./seed.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : "#");
const LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };
const DIFFS = ["easy", "medium", "hard"];

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

/* ---------- State ---------- */
const state = {
  user: null,
  role: "user",
  questions: [],
  progress: new Map(),
  collapsed: new Set(),
  filters: { search: "", topic: "", difficulty: "", status: "" },
  view: "sheet",
  editingId: null,
  loadError: ""
};
let unsubProfile = null;
let unsubProgress = null;
let topicKey = "";

/* ---------- Theme ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("dsa-theme", theme); } catch (e) { /* storage unavailable */ }
  $("#themeBtn").setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
}
$("#themeBtn").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
applyTheme(document.documentElement.dataset.theme || "light");

/* ---------- Views ---------- */
function setView(view) {
  if (view === "admin" && state.role !== "admin") view = "sheet";
  state.view = view;
  $("#sheetView").hidden = view !== "sheet";
  $("#adminView").hidden = view !== "admin";
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === view));
}
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => setView(t.dataset.view)));

/* ---------- Firestore listeners ---------- */
onSnapshot(
  query(collection(db, "questions"), orderBy("order")),
  (snap) => {
    state.loadError = "";
    state.questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  },
  (err) => {
    console.error(err);
    state.loadError = "Could not load questions. Check your Firebase config and Firestore rules.";
    renderAll();
  }
);

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (unsubProfile) unsubProfile();
  if (unsubProgress) unsubProgress();
  unsubProfile = unsubProgress = null;
  state.progress = new Map();
  state.role = "user";

  if (user) {
    const ref = doc(db, "users", user.uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { email: user.email || "", role: "user", createdAt: serverTimestamp() });
      }
    } catch (e) {
      console.error(e);
    }
    unsubProfile = onSnapshot(ref, (s) => {
      state.role = s.data()?.role === "admin" ? "admin" : "user";
      renderChrome();
      renderAdmin();
    });
    unsubProgress = onSnapshot(collection(db, "users", user.uid, "progress"), (snap) => {
      state.progress = new Map(snap.docs.map((d) => [d.id, d.data()]));
      renderAll();
    });
  }
  renderChrome();
  renderAll();
});

/* ---------- Rendering: chrome ---------- */
function renderChrome() {
  const { user, role } = state;
  $("#authBtn").textContent = user ? "Sign out" : "Sign in";
  const mail = $("#userEmail");
  mail.hidden = !user;
  mail.textContent = user ? user.email || "Signed in" : "";
  $("#adminTab").hidden = role !== "admin";
  if (role !== "admin" && state.view === "admin") setView("sheet");
  $("#introMsg").textContent = user
    ? "Tick a problem when you solve it. Progress syncs across your devices."
    : "Sign in to save your progress across devices.";
}

/* ---------- Rendering: sheet ---------- */
function matches(q) {
  const f = state.filters;
  if (f.topic && q.topic !== f.topic) return false;
  if (f.difficulty && q.difficulty !== f.difficulty) return false;
  const done = state.progress.has(q.id);
  if (f.status === "done" && !done) return false;
  if (f.status === "todo" && done) return false;
  if (f.search) {
    const needle = f.search.toLowerCase();
    if (!`${q.title} ${q.topic}`.toLowerCase().includes(needle)) return false;
  }
  return true;
}

function renderStats() {
  const total = state.questions.length;
  const solved = state.questions.filter((q) => state.progress.has(q.id));
  const part = (label, got, all, cls = "") =>
    `<div class="${cls}"><dt>${label}</dt><dd>${got} / ${all}</dd></div>`;
  const byDiff = DIFFS.map((d) =>
    part(
      LABEL[d],
      solved.filter((q) => q.difficulty === d).length,
      state.questions.filter((q) => q.difficulty === d).length,
      "d-" + d
    )
  ).join("");
  $("#stats").innerHTML = part("Solved", solved.length, total) + byDiff;
}

function syncTopicOptions(topics) {
  const key = topics.join("|");
  if (key === topicKey) return;
  topicKey = key;
  const sel = $("#fTopic");
  sel.innerHTML =
    `<option value="">All topics</option>` + topics.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  if (!topics.includes(state.filters.topic)) state.filters.topic = "";
  sel.value = state.filters.topic;
  $("#topicList").innerHTML = topics.map((t) => `<option value="${esc(t)}"></option>`).join("");
}

function renderSheet() {
  const host = $("#sheet");
  if (state.loadError) {
    host.innerHTML = `<div class="empty">${esc(state.loadError)}</div>`;
    return;
  }
  if (!state.questions.length) {
    host.innerHTML = `<div class="empty">No questions yet.${
      state.role === "admin" ? " Open Manage questions to add some or load the starter set." : " Check back soon."
    }</div>`;
    return;
  }

  const topics = [...new Set(state.questions.map((q) => q.topic))];
  const html = topics
    .map((topic) => {
      const all = state.questions.filter((q) => q.topic === topic);
      const shown = all.filter(matches);
      if (!shown.length) return "";
      const solved = all.filter((q) => state.progress.has(q.id)).length;
      const strip = all
        .map((q) => {
          const on = state.progress.has(q.id);
          return `<i class="cell${on ? " on d-" + esc(q.difficulty) : ""}" title="${esc(q.title)}"></i>`;
        })
        .join("");
      const collapsed = state.collapsed.has(topic);
      const rows = shown
        .map((q) => {
          const done = state.progress.has(q.id);
          return `<li class="row${done ? " is-done" : ""}">
            <label class="check">
              <input type="checkbox" data-id="${esc(q.id)}" ${done ? "checked" : ""} aria-label="Mark ${esc(q.title)} as solved">
              <span class="box"></span>
            </label>
            <a class="title" href="${esc(safeUrl(q.link))}" target="_blank" rel="noopener noreferrer">${esc(q.title)}</a>
            <span class="tag d-${esc(q.difficulty)}">${LABEL[q.difficulty] || ""}</span>
            <span class="plat">${esc(q.platform || "")}</span>
          </li>`;
        })
        .join("");
      return `<section class="topic">
        <button class="topic-head" type="button" data-topic="${esc(topic)}" aria-expanded="${!collapsed}">
          <span class="topic-line">
            <span class="topic-name">${esc(topic)}</span>
            <span class="topic-count">${solved} / ${all.length}</span>
          </span>
          <span class="strip" aria-hidden="true">${strip}</span>
        </button>
        ${collapsed ? "" : `<ul class="rows">${rows}</ul>`}
      </section>`;
    })
    .join("");

  host.innerHTML = html || `<div class="empty">No problems match these filters.</div>`;
}

/* ---------- Rendering: admin ---------- */
function renderAdmin() {
  if (state.role !== "admin") return;
  $("#qCount").textContent = `(${state.questions.length})`;
  $("#qTable").innerHTML = state.questions
    .map(
      (q) => `<tr>
        <td><a href="${esc(safeUrl(q.link))}" target="_blank" rel="noopener noreferrer">${esc(q.title)}</a></td>
        <td>${esc(q.topic)}</td>
        <td><span class="tag d-${esc(q.difficulty)}">${LABEL[q.difficulty] || ""}</span></td>
        <td class="act">
          <button class="btn sm" type="button" data-act="edit" data-id="${esc(q.id)}">Edit</button>
          <button class="btn sm danger" type="button" data-act="delete" data-id="${esc(q.id)}">Delete</button>
        </td>
      </tr>`
    )
    .join("");
}

function renderAll() {
  syncTopicOptions([...new Set(state.questions.map((q) => q.topic))]);
  renderStats();
  renderSheet();
  renderAdmin();
}

/* ---------- Sheet interactions ---------- */
$("#sheet").addEventListener("click", (e) => {
  const head = e.target.closest(".topic-head");
  if (!head) return;
  const t = head.dataset.topic;
  state.collapsed.has(t) ? state.collapsed.delete(t) : state.collapsed.add(t);
  renderSheet();
});

$("#sheet").addEventListener("change", async (e) => {
  const box = e.target.closest("input[type=checkbox][data-id]");
  if (!box) return;
  if (!state.user) {
    box.checked = false;
    openAuth("signin");
    return;
  }
  const ref = doc(db, "users", state.user.uid, "progress", box.dataset.id);
  try {
    if (box.checked) await setDoc(ref, { solved: true, solvedAt: serverTimestamp() });
    else await deleteDoc(ref);
  } catch (err) {
    console.error(err);
    box.checked = !box.checked;
    toast("Could not save your progress. Try again.");
  }
});

$("#fSearch").addEventListener("input", (e) => { state.filters.search = e.target.value.trim(); renderSheet(); });
$("#fTopic").addEventListener("change", (e) => { state.filters.topic = e.target.value; renderSheet(); });
$("#fDifficulty").addEventListener("change", (e) => { state.filters.difficulty = e.target.value; renderSheet(); });
$("#fStatus").addEventListener("change", (e) => { state.filters.status = e.target.value; renderSheet(); });

/* ---------- Auth dialog ---------- */
const dlg = $("#authDialog");
let authMode = "signin";

function setAuthMode(mode) {
  authMode = mode;
  const create = mode === "signup";
  $("#authTitle").textContent = create ? "Create an account" : "Sign in";
  $("#authSubmit").textContent = create ? "Create account" : "Sign in";
  $("#authSwitch").textContent = create ? "I already have an account" : "Create an account";
  $("#aPassword").autocomplete = create ? "new-password" : "current-password";
  $("#authReset").hidden = create;
  showAuthError("");
}
function showAuthError(msg) {
  const el = $("#authError");
  el.textContent = msg;
  el.hidden = !msg;
}
function openAuth(mode) {
  setAuthMode(mode);
  if (!dlg.open) dlg.showModal();
  $("#aEmail").focus();
}
function authMessage(err) {
  const code = err?.code;
  const map = {
    "auth/invalid-email": "Enter a valid email address.",
    "auth/missing-password": "Enter your password.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account uses this email. Create an account first.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/popup-closed-by-user": "",
    "auth/cancelled-popup-request": "",
    "auth/network-request-failed": "Network error. Check your connection and try again."
  };
  return code in map ? map[code] : "Something went wrong. Try again.";
}

$("#authBtn").addEventListener("click", async () => {
  if (state.user) {
    await signOut(auth);
    toast("Signed out");
  } else {
    openAuth("signin");
  }
});
$("#authClose").addEventListener("click", () => dlg.close());
$("#authSwitch").addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));

$("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#aEmail").value.trim();
  const password = $("#aPassword").value;
  const btn = $("#authSubmit");
  btn.disabled = true;
  showAuthError("");
  try {
    if (authMode === "signup") await createUserWithEmailAndPassword(auth, email, password);
    else await signInWithEmailAndPassword(auth, email, password);
    dlg.close();
    $("#authForm").reset();
  } catch (err) {
    showAuthError(authMessage(err));
  } finally {
    btn.disabled = false;
  }
});

$("#googleBtn").addEventListener("click", async () => {
  showAuthError("");
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    dlg.close();
  } catch (err) {
    showAuthError(authMessage(err));
  }
});

$("#authReset").addEventListener("click", async () => {
  const email = $("#aEmail").value.trim();
  if (!email) return showAuthError("Enter your email above, then select Forgot password again.");
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthError("");
    toast("Password reset email sent");
  } catch (err) {
    showAuthError(authMessage(err));
  }
});

/* ---------- Admin: add, edit, delete ---------- */
const form = $("#qForm");

function resetForm() {
  state.editingId = null;
  form.reset();
  $("#qPlatform").value = "LeetCode";
  $("#qFormTitle").textContent = "Add a question";
  $("#qSubmit").textContent = "Add question";
  $("#qCancel").hidden = true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (state.role !== "admin") return;
  const data = {
    title: $("#qTitle").value.trim(),
    link: $("#qLink").value.trim(),
    topic: $("#qTopic").value.trim(),
    difficulty: $("#qDifficulty").value,
    platform: $("#qPlatform").value.trim()
  };
  if (!/^https?:\/\//i.test(data.link)) return toast("Enter a link that starts with https://");
  const btn = $("#qSubmit");
  btn.disabled = true;
  try {
    if (state.editingId) {
      await updateDoc(doc(db, "questions", state.editingId), data);
      toast("Question updated");
    } else {
      const order = state.questions.reduce((m, q) => Math.max(m, q.order ?? 0), 0) + 1;
      await addDoc(collection(db, "questions"), { ...data, order, createdAt: serverTimestamp() });
      toast("Question added");
    }
    resetForm();
  } catch (err) {
    console.error(err);
    toast("Could not save the question. Check that you are an admin.");
  } finally {
    btn.disabled = false;
  }
});

$("#qCancel").addEventListener("click", resetForm);

$("#qTable").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn || state.role !== "admin") return;
  const q = state.questions.find((x) => x.id === btn.dataset.id);
  if (!q) return;

  if (btn.dataset.act === "edit") {
    state.editingId = q.id;
    $("#qTitle").value = q.title;
    $("#qLink").value = q.link;
    $("#qTopic").value = q.topic;
    $("#qDifficulty").value = q.difficulty;
    $("#qPlatform").value = q.platform || "";
    $("#qFormTitle").textContent = "Edit question";
    $("#qSubmit").textContent = "Save changes";
    $("#qCancel").hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#qTitle").focus();
  } else if (btn.dataset.act === "delete") {
    if (!confirm(`Delete "${q.title}"? Users' progress on it will no longer count.`)) return;
    try {
      await deleteDoc(doc(db, "questions", q.id));
      if (state.editingId === q.id) resetForm();
      toast("Question deleted");
    } catch (err) {
      console.error(err);
      toast("Could not delete the question.");
    }
  }
});

/* ---------- Admin: bulk add ---------- */
async function bulkAdd(items) {
  const known = new Set(state.questions.map((q) => q.link));
  const fresh = items.filter((q) => !known.has(q.link));
  if (!fresh.length) return toast("Nothing new to add. Those links already exist.");
  let order = state.questions.reduce((m, q) => Math.max(m, q.order ?? 0), 0);
  for (let i = 0; i < fresh.length; i += 400) {
    const batch = writeBatch(db);
    fresh.slice(i, i + 400).forEach((q) => {
      batch.set(doc(collection(db, "questions")), { ...q, order: ++order, createdAt: serverTimestamp() });
    });
    await batch.commit();
  }
  toast(`Added ${fresh.length} question${fresh.length === 1 ? "" : "s"}`);
}

$("#seedBtn").addEventListener("click", async () => {
  if (state.role !== "admin") return;
  if (!confirm(`Add ${starterQuestions.length} starter problems? Existing questions are kept.`)) return;
  try { await bulkAdd(starterQuestions); }
  catch (err) { console.error(err); toast("Could not add the starter set."); }
});

$("#importBtn").addEventListener("click", async () => {
  if (state.role !== "admin") return;
  let list;
  try { list = JSON.parse($("#importText").value); }
  catch { return toast("That is not valid JSON."); }
  if (!Array.isArray(list) || !list.length) return toast("Paste a JSON array with at least one question.");

  const clean = [];
  for (const [i, q] of list.entries()) {
    const item = {
      title: String(q?.title ?? "").trim(),
      link: String(q?.link ?? "").trim(),
      topic: String(q?.topic ?? "").trim(),
      difficulty: String(q?.difficulty ?? "").toLowerCase(),
      platform: String(q?.platform ?? "").trim()
    };
    if (!item.title || !item.topic || !/^https?:\/\//i.test(item.link) || !DIFFS.includes(item.difficulty)) {
      return toast(`Item ${i + 1} needs a title, topic, https link and difficulty (easy, medium or hard).`);
    }
    clean.push(item);
  }
  try {
    await bulkAdd(clean);
    $("#importText").value = "";
  } catch (err) {
    console.error(err);
    toast("Could not import. Check that you are an admin.");
  }
});

/* ---------- Boot ---------- */
setAuthMode("signin");
renderChrome();
renderAll();
