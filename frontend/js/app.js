// ─────────────────────────────────────────────────────────────
// SpeedyBosh — logique du dashboard (portage web de main.py)
// ─────────────────────────────────────────────────────────────

// ── Garde d'authentification ──
if (!Api.getToken()) {
  window.location.href = "index.html";
}

// ── État applicatif (équivalent self.email_data / self.etat) ──
const state = {
  etat: "attente", // attente | destinataire | objet | corps | confirmation
  email_data: { destinataire: "", objet: "", corps: "" },
  messages: [],     // {ts, text}
  searchQuery: "",
  sort: "date_desc",
  originalMainContent: "", // Save original dashboard content
  selectMode: true, // true = tout sélectionner, false = filtrer tous
  starMode: true, // true = ajouter aux favoris, false = filtrer favoris
  readMode: true, // true = marquer comme lu, false = marquer comme non lu
};

// ── Éléments DOM ──
const el = {
  destInput: document.getElementById("dest-input"),
  objInput: document.getElementById("obj-input"),
  corpsInput: document.getElementById("newMessage"),
  guideText: document.getElementById("guide-text"),
  statusLbl: document.getElementById("status-lbl"),
  pulseRing: document.getElementById("pulse-ring"),
  waveBar: document.getElementById("wave-bar"),
  console: document.getElementById("console"),
  logSearch: document.getElementById("log-search"),
  logSort: document.getElementById("log-sort"),
  avatar: document.getElementById("avatar-circle"),
  signinPill: document.getElementById("signin-pill"),
};

// Génère les 20 barres du wave-bar
for (let i = 0; i < 20; i++) {
  const bar = document.createElement("span");
  el.waveBar.appendChild(bar);
}

// ── Init utilisateur (équivalent self.smtp_config["email"]) ──
Api.me().then((user) => {
  el.avatar.textContent = user.email[0].toUpperCase();
  el.signinPill.textContent = user.email;
}).catch(() => {
  Api.clearToken();
  window.location.href = "index.html";
});

document.getElementById("btn-logout").onclick = () => {
  Api.logout();
  window.location.href = "index.html";
};

// ── Log console (équivalent self.log / self._refresh_console) ──
function log(text) {
  state.messages.push({ ts: new Date(), text });
  refreshConsole();
}

function refreshConsole() {
  const q = state.searchQuery.toLowerCase();
  let items = state.messages.filter((m) => {
    if (!q) return true;
    const s1 = m.ts.toLocaleString().toLowerCase();
    return m.text.toLowerCase().includes(q) || s1.includes(q);
  });

  items = items.slice().sort((a, b) => {
    switch (state.sort) {
      case "date_asc": return a.ts - b.ts;
      case "alpha_asc": return a.text.localeCompare(b.text);
      case "alpha_desc": return b.text.localeCompare(a.text);
      default: return b.ts - a.ts; // date_desc
    }
  });

  el.console.innerHTML = items
    .map((m) => `<div class="line">[${m.ts.toLocaleString()}] ${escapeHtml(m.text)}</div>`)
    .join("");
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ── Guide + statut ──
function setGuide(text) { el.guideText.textContent = text; }
function setStatus(text) { el.statusLbl.textContent = text; }

function speak(text) {
  log(`🤖 ${text}`);
  voice.speak(text);
}

// ── Mise à jour des champs affichés depuis state.email_data ──
function updateForm() {
  el.destInput.value = state.email_data.destinataire;
  el.objInput.value = state.email_data.objet;
  el.corpsInput.value = state.email_data.corps;
}

// Synchro inverse : édition manuelle des champs → state
el.destInput.addEventListener("input", () => state.email_data.destinataire = el.destInput.value);
el.objInput.addEventListener("input", () => state.email_data.objet = el.objInput.value);
el.corpsInput.addEventListener("input", () => state.email_data.corps = el.corpsInput.value);

// ── Validation email (équivalent valider_email) ──
function validerEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// ── Construction d'email à partir de texte dicté ──
function construireEmail(texte) {
  const ADDR_STOP = ["envoyer","envoie","envoi","envoies","envoyez","un","une","mail","e-mail","email","au","pour","le","la","les","du","de","bonjour","hello","oui","voulez","svp","merci","composer","écrire"];
  let t = texte.toLowerCase().trim();
  let m = t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  if (m) return m[0];
  for (const w of ADDR_STOP) t = t.replace(new RegExp("\\b"+w+"\\b","gi")," ");
  t = t.replace(/\s+/g," ").trim();
  t = t.replace(/[ \t]+/g,"");
  t = t.replace(/à|â|ä/g,"a").replace(/é|è|ê|ë/g,"e").replace(/î|ï/g,"i").replace(/ô|ö/g,"o").replace(/ù|û|ü/g,"u").replace(/ç/g,"c");
  t = t.replace(/,\s*/g,",").replace(/,point\s*/gi,".").replace(/pointvirgule\s*/gi,";").replace(/point\s*/gi,".").replace(/\s+/g,"");
  if (t.includes("arobase")) t = t.replace(/arobase\s*/gi,"@");
  else if (t.includes("@")) {}
  else if (t.length > 2) {
    const dom = ["gmail.com","yahoo.com","outlook.com","hotmail.com","live.com","icloud.com","orange.fr","sfr.fr","free.fr","laposte.net"];
    for (const d of dom) {
      const re = new RegExp(d.replace(/\./g,"\\.?")+"$","i");
      if (t.match(re)) {
        const body = t.slice(0, t.length - d.length).replace(/[\.\s]+$/g,"");
        if (body) return body + "@" + d;
      }
      const re2 = new RegExp("(.*)"+d.replace(/\./g,"\\s*\\.?\\s*").replace(/com/,"(c|k)o?m{0,2}"),"i");
      const mm = t.match(re2);
      if (mm && mm[1]) {
        const body = mm[1].replace(/[\.\s]+$/g,"");
        if (body) return body + "@" + d;
      }
    }
    if (!t.includes("@")) {
      const pos = t.lastIndexOf("gmail"); if (pos>0) return t.slice(0,pos)+"@gmail.com";
      const p2 = t.lastIndexOf("yahoo"); if (p2>0) return t.slice(0,p2)+"@yahoo.com";
      const p3 = t.lastIndexOf("outlook"); if (p3>0) return t.slice(0,p3)+"@outlook.com";
    }
  }
  let adr = t;
  if (!adr.includes("@")) {
    for (const d of ["gmail.com","yahoo.com","outlook.com"]) {
      const testDom = "@"+d;
      const test = adr + testDom;
      if (validerEmail(test)) { adr = test; break; }
    }
  }
  return adr;
}

// ── Ponctuation vocale (équivalent appliquer_ponctuation) ──
const PONCTUATION = {
  "point": ".", "virgule": ",", "point virgule": ";", "deux points": ":",
  "point d'exclamation": "!", "point d'interrogation": "?",
  "nouvelle ligne": "\n", "à la ligne": "\n",
  "ouvrir parenthèse": "(", "fermer parenthèse": ")",
  "tiret": "-", "guillemet": '"',
};
function appliquerPonctuation(texte) {
  let t = texte;
  for (const [mot, signe] of Object.entries(PONCTUATION)) {
    t = t.replace(new RegExp(`\\b${mot}\\b`, "gi"), signe);
  }
  return t;
}

// ── Routeur principal (portage de self._router) ──
function router(texte) {
  const c = texte.toLowerCase().trim();

  if (state.etat === "attente") {
    if (["hello", "activer", "nouveau mail", "composer"].some((w) => c.includes(w))) {
      state.etat = "destinataire";
      state.email_data = { destinataire: "", objet: "", corps: "" };
      updateForm();
      setGuide("Who would you like to send this email to?");
      speak("Who would you like to send this email to?");
    } else {
      speak('Dites "hello" pour commencer à composer un message.');
    }
    return;
  }

  if (c.includes("annuler")) { resetDraft(); speak("Brouillon annulé."); return; }

  if (state.etat === "destinataire") {
    if (validerEmail(texte.replace(/\s/g, ""))) {
      state.email_data.destinataire = texte.replace(/\s/g, "").toLowerCase();
      updateForm();
      log(`📧 Email : ${state.email_data.destinataire}`);
      setGuide("Quel est l'objet de votre message ?");
      speak(`Destinataire enregistré : ${state.email_data.destinataire}. Quel est l'objet ?`);
      state.etat = "objet";
    } else {
      speak("Je n'ai pas reconnu cette adresse. Réessayez.");
    }
  } else if (state.etat === "objet") {
    state.email_data.objet = texte;
    updateForm();
    log(`📌 Objet : ${texte}`);
    setGuide("Dictez le corps de votre message.");
    speak(`Objet enregistré : ${texte}. Dictez le corps de votre message.`);
    state.etat = "corps";
  } else if (state.etat === "corps") {
    if (c.includes("effacer")) {
      state.email_data.corps = ""; updateForm();
      speak("Corps effacé. Dictez à nouveau votre message.");
      return;
    }
    const corps = appliquerPonctuation(texte);
    state.email_data.corps += (state.email_data.corps ? " " : "") + corps;
    updateForm();
    log("📝 Corps mis à jour");
    if (["envoyer", "envoie", "send"].some((w) => c.includes(w))) {
      state.etat = "confirmation";
      relireMail(true);
    } else {
      setGuide('Continue dictating or say "Send", "Read", "Edit" or "Cancel".');
      speak("Text added. Continue or say Send, Read, or Cancel.");
    }
  } else if (state.etat === "confirmation") {
    if (["envoyer", "envoie", "oui", "confirmer", "yes"].some((w) => c.includes(w))) {
      envoyerEmail();
    } else if (["modifier", "corriger", "non"].some((w) => c.includes(w))) {
      state.etat = "corps";
      setGuide("Dictate your changes.");
      speak("Dictate your changes.");
    }
  }
}

function relireMail(avecConfirmation = false) {
  const d = state.email_data;
  let msg = `Destinataire : ${d.destinataire || "non défini"}. Objet : ${d.objet || "non défini"}. Corps : ${d.corps || "vide"}.`;
  if (avecConfirmation) {
    msg += " Souhaitez-vous envoyer ce mail, le modifier ou l'annuler ?";
    setGuide("Dites : Envoyer, Modifier ou Annuler.");
  }
  log("📖 Relecture du mail");
  speak(msg);
}

function resetDraft() {
  state.etat = "attente";
  state.email_data = { destinataire: "", objet: "", corps: "" };
  updateForm();
  setGuide('Say "hello" to start.');

  // Clear PDF upload input
  const pdfInput = document.getElementById("pdfInput");
  if (pdfInput) pdfInput.value = "";

  // Clear attachment upload input
  const attachmentInput = document.getElementById("attachmentInput");
  if (attachmentInput) attachmentInput.value = "";
}

// ── Envoi email : nécessite un endpoint backend (voir README) ──
async function envoyerEmail() {
  const d = state.email_data;
  if (!validerEmail(d.destinataire)) { speak("Adresse destinataire invalide."); return; }
  if (!d.objet) { speak("L'objet est vide."); return; }

  log("📤 Sending...");
  try {
    const res = await fetch(`${API_BASE}/mail/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Api.getToken()}`,
      },
      body: JSON.stringify(d),
    });
    if (!res.ok) throw new Error((await res.json()).detail || "Erreur d'envoi");
    log("✅ Message envoyé avec succès !");
    speak("The message was sent successfully.");
    resetDraft();
  } catch (err) {
    log(`❌ Send error: ${err.message}`);
    speak("Error while sending.");
  }
}

// ── Réécriture locale (équivalent polish_text, sans IA) ──
function polishText(text) {
  if (!text) return text;
  let s = text.trim().replace(/\s+/g, " ");
  s = s.replace(/\s+([,;:.!?])/g, "$1").replace(/([,;:.!?])(\w)/g, "$1 $2");
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

// ── Initialize dashboard event listeners ──
function initDashboardListeners() {
  // Re-initialize elements first
  el.destInput = document.getElementById("dest-input");
  el.objInput = document.getElementById("obj-input");
  el.corpsInput = document.getElementById("newMessage");
  el.guideText = document.getElementById("guide-text");
  el.statusLbl = document.getElementById("status-lbl");
  el.pulseRing = document.getElementById("pulse-ring");
  el.waveBar = document.getElementById("wave-bar");
  el.console = document.getElementById("console");
  el.logSearch = document.getElementById("log-search");
  el.logSort = document.getElementById("log-sort");
  el.avatar = document.getElementById("avatar-circle");
  el.signinPill = document.getElementById("signin-pill");

  // Boutons micro par champ
  document.querySelectorAll(".mic-btn").forEach((btn) => {
    if (btn.__micListenerAttached) return;
    btn.__micListenerAttached = true;
    const origHTML = btn.innerHTML;
    let isRunning = false;

    btn.addEventListener("click", async () => {
      if (isRunning) return;
      isRunning = true;
      const field = btn.dataset.field;
      log(`🔘 [app.js] Bouton micro cliqué → champ: ${field} | state.etat=${state.etat}`);

      btn.classList.add("recording");
      if (btn.querySelector("i")) btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
      else btn.textContent = "⏹";
      setStatus(`🎤 Recording: ${field}...`);
      if (el.pulseRing) el.pulseRing.classList.add("active");
      if (el.waveBar) el.waveBar.classList.add("active");

      try {
        log(`⏳ [app.js] Appel voice.listenOnce(20000)...`);
        const texte = await voice.listenOnce(20000);
        log(`✅ [app.js] listenOnce résolu: "${texte}" (${texte.length} chars)`);

        if (!texte || !texte.trim()) {
          log(`⚠️ [app.js] Aucun texte reconnu, champ ${field} non mis à jour`);
          setTimeout(() => { isRunning = false; }, 400);
          return;
        }

        log(`🗣 Reconnu : "${texte}"`);
        if (field === "destinataire") {
          const email = construireEmail(texte);
          log(`📧 [app.js] Email construit depuis "${texte}" → "${email}"`);
          if (email && validerEmail(email)) {
            state.email_data.destinataire = email;
          } else {
            state.email_data.destinataire = texte.replace(/\s/g, "").toLowerCase();
          }
          log(`✅ [app.js] Destinataire = ${state.email_data.destinataire}`);
          if (state.etat === "attente") state.etat = "objet";
        }
        else if (field === "objet") {
          state.email_data.objet = texte;
          log(`📌 [app.js] Objet = ${state.email_data.objet}`);
          if (state.etat === "attente" || state.etat === "destinataire") state.etat = "corps";
        }
        else if (field === "corps") {
          const corps = appliquerPonctuation(texte);
          state.email_data.corps += (state.email_data.corps ? " " : "") + corps;
          log(`📝 [app.js] Corps ajouté: "${corps}" (total=${state.email_data.corps.length} chars)`);
        }
        updateForm();
      } catch (err) {
        log(`❌ Erreur micro : ${err.message}`);
      } finally {
        btn.classList.remove("recording");
        btn.innerHTML = origHTML;
        if (/[🎤⏹]/.test(btn.textContent)) btn.textContent = "🎤";
        setStatus("Idle...");
        if (el.pulseRing) el.pulseRing.classList.remove("active");
        if (el.waveBar) el.waveBar.classList.remove("active");
        setTimeout(() => { isRunning = false; }, 300);
      }
    });
  });

  // Rewrite buttons
  document.querySelectorAll(".rewrite-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.field;
      const input = field === "corps" ? el.corpsInput : (field === "objet" ? el.objInput : el.destInput);
      const improved = polishText(input.value);
      if (confirm(`Suggestion :\n\n${improved}\n\nAppliquer ?`)) {
        input.value = improved;
        state.email_data[field] = improved;
        log("✍️ Texte rédigé et appliqué");
      }
    });
  });

  // Send button
  document.getElementById("send-btn").addEventListener("click", () => {
    state.email_data.destinataire = el.destInput.value.trim();
    state.email_data.objet = el.objInput.value.trim();
    state.email_data.corps = el.corpsInput.value.trim();
    
    const pdfFile = document.getElementById("pdfInput").files[0];
    const attachmentFile = document.getElementById("attachmentInput").files[0];
    
    const sendBtn = document.getElementById("send-btn");
    sendBtn.classList.add("sent");
    setTimeout(() => sendBtn.classList.remove("sent"), 800);

    if (attachmentFile) {
      sendAttachmentMail();
    } else if (pdfFile) {
      sendPdfMail();
    } else {
      envoyerEmail();
    }
  });

  // Trigger speech recognition by clicking on "Say Hello to start" guide text or the pulse ring
  const triggerSpeech = async () => {
    setStatus("🎤 Listening...");
    el.pulseRing.classList.add("active");
    el.waveBar.classList.add("active");
    try {
      const texte = await voice.listenOnce();
      log(`🗣 Reconnu : "${texte}"`);
      router(texte);
    } catch (err) {
      log(`❌ Erreur micro : ${err.message}`);
    } finally {
      setStatus("Idle...");
      el.pulseRing.classList.remove("active");
      el.waveBar.classList.remove("active");
    }
  };

  if (el.guideText) {
    el.guideText.style.cursor = "pointer";
    el.guideText.addEventListener("click", triggerSpeech);
  }
  const bigMic = document.getElementById("pulse-ring");
  if (bigMic) {
    bigMic.style.cursor = "pointer";
    bigMic.addEventListener("click", triggerSpeech);
  }

  // Log search and sort
  el.logSearch.addEventListener("keyup", () => {
    state.searchQuery = el.logSearch.value.trim();
    refreshConsole();
  });
  el.logSort.addEventListener("change", () => {
    state.sort = el.logSort.value;
    refreshConsole();
  });

  // PDF Page Selection
  const selectPagesBtn = document.getElementById("selectPagesBtn");
  if (selectPagesBtn) {
    selectPagesBtn.addEventListener("click", async () => {
      const file = document.getElementById("pdfInput").files[0];
      if (!file) {
        alert("Please select a PDF file first.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://127.0.0.1:8000/mail/pdf/select-pages", {
          method: "POST",
          body: formData
        });
        const data = await response.json();
        alert(`Selected pages: ${data.selected_pages}`);
      } catch (error) {
        console.error("Error selecting PDF pages:", error);
        alert("Error selecting PDF pages.");
      }
    });
  }

  // PDF Input change event listener
  const pdfInput = document.getElementById("pdfInput");
  if (pdfInput) {
    pdfInput.addEventListener("change", (e) => {
      const files = e.target.files;
      const messageBox = document.getElementById("newMessage");
      if (files.length > 0 && messageBox) {
        // Affiche les noms des fichiers dans la zone de texte
        for (let i = 0; i < files.length; i++) {
          messageBox.value += `\n📎 PDF attaché : ${files[i].name}`;
        }
        // Met à jour l'état de l'application
        state.email_data.corps = messageBox.value;
      }
    });
  }

  // Attachment Input change event listener
  const attachmentInput = document.getElementById("attachmentInput");
  if (attachmentInput) {
    attachmentInput.addEventListener("change", async (e) => {
      const files = e.target.files;
      const messageBox = document.getElementById("newMessage");
      if (files.length > 0 && messageBox) {
        let attachmentsText = "\n📎 Pièces jointes : ";
        for (let i = 0; i < files.length; i++) {
          attachmentsText += `${files[i].name}${i < files.length - 1 ? ", " : ""}`;
        }
        messageBox.value += attachmentsText;
        state.email_data.corps = messageBox.value;

        // Directly trigger send option if recipient is set
        const recipient = el.destInput.value.trim();
        if (recipient && confirm("Souhaitez-vous envoyer cet e-mail immédiatement avec ces pièces jointes ?")) {
          await sendAttachmentMail();
        }
      }
    });
  }
}

// ── SPA View Loader ──
async function loadView(view) {
  const mainContainer = document.getElementById("main-content");

  // Handle "New email" view specially (restore compose dashboard)
  if (view === "New email") {
    mainContainer.innerHTML = state.originalMainContent;
    initDashboardListeners();
    state.email_data = { destinataire: "", objet: "", corps: "" };
    updateForm();
    log("✳️ Nouveau mail démarré via la barre latérale");
    setGuide("Who would you like to send this email to?");
    state.etat = "destinataire";
    return;
  }

  // For mail list views
  let title = "";
  let endpoint = "";
  
  if (view === "All Mail") {
    title = "📧 Tous les mails";
    endpoint = "/mail/all";
  } else if (view === "Sent") {
    title = "📤 Mails envoyés";
    endpoint = "/mail/all"; // Using /all for now since backend doesn't have /sent yet
  } else if (view === "Inbox") {
    title = "📥 Boîte de réception";
    endpoint = "/mail/all"; // Using /all for now since backend doesn't have /inbox yet
  } else if (view === "Trash") {
    title = "🗑 Corbeille";
    endpoint = "/mail/trash";
  } else if (view === "Starred") {
    title = "⭐ Favoris";
    endpoint = "/mail/starred";
  } else if (view === "History") {
    title = "🕘 Historique";
    endpoint = "/mail/all"; // Using /all for now since backend doesn't have /history yet
  } else if (view === "Settings") {
    title = "⚙️ Paramètres";
    mainContainer.innerHTML = `<h2>${title}</h2><p style="padding: 0 14px;">Paramètres à venir...</p>`;
    return;
  }

  mainContainer.innerHTML = `
    <h2>${title}</h2>
    <div id="toolbar" class="mail-toolbar">
      <button id="btn-toggle-read"><i class="fa-solid fa-envelope-open"></i> Marquer comme lu</button>
      <button id="btn-toggle-select"><i class="fa-solid fa-square-check"></i> Tout sélectionner</button>
      <span id="selected-count">0 sélectionné(s)</span>
    </div>
  `;

  // ── Fetch and render mails ──
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    const mails = await res.json();
    renderMails(mails);
  } catch (error) {
    console.error("Error loading mails:", error);
    mainContainer.innerHTML += `<p style='padding: 0 14px; color: red;'>Erreur de chargement: ${error.message}</p>`;
  }

  // ── Helper function to render mails (reusable) ──
  function renderMails(mails) {
    // Clear existing mail items but keep toolbar and title
    const existingItems = mainContainer.querySelectorAll(".mail-item");
    existingItems.forEach(item => item.remove());
    const noMailMsg = mainContainer.querySelector("p[style*='padding: 0 14px']");
    if (noMailMsg) noMailMsg.remove();

    if (mails.length === 0) {
      mainContainer.innerHTML += "<p style='padding: 0 14px;'>Aucun mail trouvé.</p>";
      return;
    }

    const currentView = endpoint; // /mail/all, /mail/trash, /mail/starred
    const isTrashView = currentView === "/mail/trash";

    mails.forEach(mail => {
      const item = document.createElement("div");
      item.classList.add("mail-item");
      item.dataset.id = mail.id; // Store mail ID for later use
      const starClass = mail.starred ? "fa-solid text-warning" : "fa-regular";
      if (mail.read) {
        item.style.opacity = "0.7";
      }

      const restoreButton = isTrashView
        ? `<i class="fa-solid fa-arrow-rotate-left mail-restore" title="Restaurer"></i>`
        : ``;

      item.innerHTML = `
        <div class="mail-actions">
          <input type="checkbox" class="mail-select">
          <i class="${starClass} fa-star mail-star"></i>
          ${restoreButton}
          <i class="fa-solid fa-trash mail-trash"></i>
        </div>
        <div class="mail-info">
          <p><strong>From:</strong> ${mail.sender}</p>
          <p><strong>To:</strong> ${mail.recipient}</p>
          <p><strong>Subject:</strong> ${mail.subject}</p>
          <p>${mail.body}</p>
          <p><em>Sent at:</em> ${new Date(mail.sent_at).toLocaleString()}</p>
        </div>
      `;
      mainContainer.appendChild(item);
    });
  }

  // ── Fetch and render mails helpers ──
  async function showStarred() {
    const res = await fetch(`${API_BASE}/mail/starred`);
    const mails = await res.json();
    renderMails(mails);
  }

  async function showTrash() {
    const res = await fetch(`${API_BASE}/mail/trash`);
    const mails = await res.json();
    renderMails(mails);
  }

  // ── Attach direct event listeners to toolbar buttons ──
  const toggleReadBtn = document.getElementById("btn-toggle-read");
  toggleReadBtn.addEventListener("click", async () => {
    const selected = [...document.querySelectorAll(".mail-select:checked")];
    for (const cb of selected) {
      const mailId = cb.closest(".mail-item").dataset.id;
      const endpoint = state.readMode ? `/mail/${mailId}/read` : `/mail/${mailId}/unread`;
      try {
        await fetch(`${API_BASE}${endpoint}`, { method: "POST" });
        cb.closest(".mail-item").style.opacity = state.readMode ? "0.7" : "1";
      } catch (error) {
        console.error(`Error marking as ${state.readMode ? "read" : "unread"}:`, mailId, error);
      }
    }
    toggleReadBtn.innerHTML = state.readMode
      ? '<i class="fa-solid fa-envelope"></i> Marquer comme non lu'
      : '<i class="fa-solid fa-envelope-open"></i> Marquer comme lu';
    state.readMode = !state.readMode;
  });

  const toggleStarBtn = document.getElementById("btn-toggle-star");
  toggleStarBtn.addEventListener("click", async () => {
    if (state.starMode) {
      const selected = [...document.querySelectorAll(".mail-select:checked")];
      for (const cb of selected) {
        const mailId = cb.closest(".mail-item").dataset.id;
        const starIcon = cb.closest(".mail-item").querySelector(".mail-star");
        try {
          await fetch(`${API_BASE}/mail/${mailId}/star`, { method: "POST" });
          starIcon.classList.remove("fa-regular");
          starIcon.classList.add("fa-solid", "text-warning");
        } catch (error) {
          console.error("Error starring mail:", mailId, error);
        }
      }
    } else {
      // Filter mode: reload only starred mails from backend
      await showStarred();
    }
    toggleStarBtn.innerHTML = state.starMode
      ? '<i class="fa-solid fa-filter"></i> Filtrer favoris'
      : '<i class="fa-solid fa-star"></i> Ajouter aux favoris';
    state.starMode = !state.starMode;
  });

  const toggleSelectBtn = document.getElementById("btn-toggle-select");
  toggleSelectBtn.addEventListener("click", () => {
    if (state.selectMode) {
      document.querySelectorAll(".mail-select").forEach(cb => cb.checked = true);
      const count = document.querySelectorAll(".mail-select:checked").length;
      const countEl = document.getElementById("selected-count");
      if (countEl) countEl.textContent = `${count} sélectionné(s)`;
    } else {
      // Reset filter: reload current endpoint (all mails by default)
      fetch(`${API_BASE}${endpoint}`)
        .then(r => r.json())
        .then(mails => renderMails(mails))
        .catch(err => console.error("Error reloading mails:", err));
    }
    toggleSelectBtn.innerHTML = state.selectMode
      ? '<i class="fa-solid fa-inbox"></i> Filtrer tous'
      : '<i class="fa-solid fa-square-check"></i> Tout sélectionner';
    state.selectMode = !state.selectMode;
  });

  // Filter trash button: load trash via API
  const filterTrashBtn = document.getElementById("btn-filter-trash");
  if (filterTrashBtn) {
    filterTrashBtn.addEventListener("click", async () => {
      await showTrash();
    });
  }

  fetch(`${API_BASE}${endpoint}`)
    .then(r => r.json())
    .then(mails => {
      renderMails(mails);
    })
    .catch(err => {
      mainContainer.innerHTML += `<p style='padding: 0 14px; color: red;'>Erreur : ${err.message}</p>`;
    });
}

// ── Sidebar buttons connected to loadView ──
document.getElementById("btn-new-mail").onclick = () => loadView("New email");
document.getElementById("btn-sent").onclick = () => loadView("Sent");
document.getElementById("btn-all-mail").onclick = () => loadView("All Mail");
document.getElementById("btn-trash").onclick = () => loadView("Trash");
document.getElementById("btn-starred").onclick = () => loadView("Starred");
document.getElementById("btn-history").onclick = () => loadView("History");
document.getElementById("btn-settings").onclick = () => loadView("Settings");

// ── Save original dashboard content FIRST ──
state.originalMainContent = document.getElementById("main-content").innerHTML;

// ── Initialize dashboard on page load ──
initDashboardListeners();



// ── Update selected count on checkbox change
document.addEventListener("change", (e) => {
  if (e.target.classList.contains("mail-select")) {
    const count = document.querySelectorAll(".mail-select:checked").length;
    const countEl = document.getElementById("selected-count");
    if (countEl) {
      countEl.textContent = `${count} sélectionné(s)`;
    }
  }
});

// ── Interactive listeners for mail icons ──
document.addEventListener("click", async (e) => {
  // Individual star toggle
  if (e.target.classList.contains("mail-star")) {
    const mailItem = e.target.closest(".mail-item");
    const mailId = mailItem.dataset.id;
    try {
      // Send request to backend
      const response = await fetch(`${API_BASE}/mail/${mailId}/star`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to toggle star");
      // Update UI
      e.target.classList.toggle("fa-regular");
      e.target.classList.toggle("fa-solid");
      e.target.classList.toggle("text-warning");
      console.log("Toggled star for mail:", mailId);
    } catch (error) {
      console.error("Error toggling star:", error);
    }
  }

  // Individual trash
  if (e.target.classList.contains("mail-trash")) {
    const mailItem = e.target.closest(".mail-item");
    const mailId = mailItem.dataset.id;
    try {
      // Send request to backend
      const response = await fetch(`${API_BASE}/mail/${mailId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete mail");
      const data = await response.json();
      // Update UI with fade-out
      mailItem.classList.add("fade-out");
      setTimeout(() => {
        mailItem.remove();
        // If we're in trash view, nothing more to do; it was permanently deleted
        // Otherwise, just remove it from the list (it was moved to trash)
      }, 400);
      console.log(`Mail ${mailId}: ${data.status}`);
    } catch (error) {
      console.error("Error deleting mail:", error);
    }
  }

  // Individual restore from trash
  if (e.target.classList.contains("mail-restore")) {
    const mailItem = e.target.closest(".mail-item");
    const mailId = mailItem.dataset.id;
    try {
      const response = await fetch(`${API_BASE}/mail/${mailId}/restore`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to restore mail");
      mailItem.classList.add("fade-out");
      setTimeout(() => mailItem.remove(), 400);
      console.log("Restored mail:", mailId);
    } catch (error) {
      console.error("Error restoring mail:", error);
    }
  }

  // Delete selected
  if (e.target.id === "btn-delete-selected" || e.target.closest("#btn-delete-selected")) {
    const selected = [...document.querySelectorAll(".mail-select:checked")];
    for (const cb of selected) {
      const mailItem = cb.closest(".mail-item");
      const mailId = mailItem.dataset.id;
      try {
        await fetch(`${API_BASE}/mail/${mailId}`, { method: "DELETE" });
        mailItem.classList.add("fade-out");
        setTimeout(() => mailItem.remove(), 400);
      } catch (error) {
        console.error("Error deleting mail:", mailId, error);
      }
    }
  }

  // Filter: trash (placeholder)
  if (e.target.id === "btn-filter-trash" || e.target.closest("#btn-filter-trash")) {
    // TODO: implement trash filter when backend supports it
    alert("Filtre Corbeille à venir !");
  }
});

// ── Message d'accueil au chargement ──
log("🔧 Calibrating microphone...");
log("✅ Microphone calibrated successfully!");
speak('Welcome to SpeedyBosh. Say "hello" to compose a message.');
// ── Send PDF Mail ──
async function sendPdfMail() {
  const files = document.getElementById("pdfInput").files;
  const recipient = el.destInput.value.trim();
  const subject = el.objInput.value.trim();
  const body = el.corpsInput.value.trim();

  if (files.length === 0) {
    alert("Veuillez sélectionner au moins un PDF.");
    return;
  }

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }
  formData.append("recipient", recipient);
  formData.append("subject", subject);
  formData.append("body", body);

  try {
    const response = await fetch("http://127.0.0.1:8000/mail/send-pdf", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Api.getToken()}`,
      },
      body: formData
    });

    const result = await response.json();
    console.log(result);
    if (result.status === "sent") {
      log("✅ Message envoyé avec succès !");
      alert("PDFs envoyés avec succès !");
      resetDraft();
    } else {
      alert("Erreur : " + (result.error || result.detail || "Erreur inconnue"));
    }
  } catch (error) {
    console.error("Error sending PDF:", error);
    alert("Erreur lors de l'envoi du PDF.");
  }
}

// ── Send Mail with Generic Attachments ──
async function sendAttachmentMail() {
  const files = document.getElementById("attachmentInput").files;
  const recipient = el.destInput.value.trim();
  const subject = el.objInput.value.trim();
  const body = el.corpsInput.value.trim();

  if (files.length === 0) {
    alert("Veuillez sélectionner au moins un fichier.");
    return;
  }
  if (!validerEmail(recipient)) {
    speak("Adresse destinataire invalide.");
    alert("Adresse destinataire invalide.");
    return;
  }

  log("📤 Sending mail with attachments...");
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append("files", files[i]);
  }
  formData.append("recipient", recipient);
  formData.append("subject", subject || "Message avec pièce(s) jointe(s)");
  formData.append("body", body || "Veuillez trouver les fichiers ci-joints.");

  try {
    const response = await fetch(`${API_BASE}/mail/send-attachment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Api.getToken()}`,
      },
      body: formData
    });

    const result = await response.json();
    if (response.ok && result.status === "sent") {
      log("✅ Message envoyé avec succès !");
      speak("The message with attachments was sent successfully.");
      alert("Message avec pièce(s) jointe(s) envoyé !");
      resetDraft();
    } else {
      const errMsg = result.error || result.detail || "Erreur inconnue";
      log(`❌ Send error: ${errMsg}`);
      alert("Erreur : " + errMsg);
    }
  } catch (error) {
    console.error("Error sending attachments:", error);
    log(`❌ Send error: ${error.message}`);
    alert("Erreur lors de l'envoi des pièces jointes.");
  }
}
