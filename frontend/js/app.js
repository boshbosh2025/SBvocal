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
};

// ── Éléments DOM ──
const el = {
  destInput: document.getElementById("dest-input"),
  objInput: document.getElementById("obj-input"),
  corpsInput: document.getElementById("corps-input"),
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

el.logSearch.addEventListener("keyup", () => {
  state.searchQuery = el.logSearch.value.trim();
  refreshConsole();
});
el.logSort.addEventListener("change", () => {
  state.sort = el.logSort.value;
  refreshConsole();
});

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
    log("✅ Email sent successfully!");
    speak("The message was sent successfully.");
    resetDraft();
  } catch (err) {
    log(`❌ Send error: ${err.message}`);
    speak("Error while sending.");
  }
}

// ── Boutons micro par champ ──
document.querySelectorAll(".mic-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const field = btn.dataset.field;
    btn.classList.add("recording");
    btn.textContent = "⏹";
    setStatus(`🎤 Recording: ${field}...`);
    el.pulseRing.classList.add("active");
    el.waveBar.classList.add("active");
    try {
      const texte = await voice.listenOnce();
      log(`🗣 Reconnu : "${texte}"`);
      if (field === "destinataire" || field === "objet" || field === "corps") {
        // Si on est en dictée libre (workflow vocal complet), passer par le routeur
        if (state.etat !== "attente") {
          router(texte);
        } else {
          // Sinon, remplissage direct du champ ciblé
          if (field === "destinataire") state.email_data.destinataire = texte.replace(/\s/g, "");
          if (field === "objet") state.email_data.objet = texte;
          if (field === "corps") state.email_data.corps += (state.email_data.corps ? " " : "") + appliquerPonctuation(texte);
          updateForm();
        }
      }
    } catch (err) {
      log(`❌ Erreur micro : ${err.message}`);
    } finally {
      btn.classList.remove("recording");
      btn.textContent = "🎤";
      setStatus("Idle...");
      el.pulseRing.classList.remove("active");
      el.waveBar.classList.remove("active");
    }
  });
});

// ── Réécriture locale (équivalent polish_text, sans IA) ──
function polishText(text) {
  if (!text) return text;
  let s = text.trim().replace(/\s+/g, " ");
  s = s.replace(/\s+([,;:.!?])/g, "$1").replace(/([,;:.!?])(\w)/g, "$1 $2");
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}
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

// ── Bouton Send principal ──
document.getElementById("send-btn").addEventListener("click", () => {
  state.email_data.destinataire = el.destInput.value.trim();
  state.email_data.objet = el.objInput.value.trim();
  state.email_data.corps = el.corpsInput.value.trim();
  envoyerEmail();
});

// ── Sidebar (placeholders, comme dans main.py) ──
document.getElementById("btn-new-mail").onclick = () => {
  state.email_data = { destinataire: "", objet: "", corps: "" };
  updateForm();
  log("✳️ Nouveau mail démarré via la barre latérale");
  setGuide("Who would you like to send this email to?");
  state.etat = "destinataire";
};
document.getElementById("btn-sent").onclick = () => log("📤 Afficher : Sent (placeholder)");
document.getElementById("btn-all-mail").onclick = () => log("📥 Afficher : All Mail (placeholder)");
document.getElementById("btn-trash").onclick = () => log("🗑 Afficher : Trash (placeholder)");
document.getElementById("btn-starred").onclick = () => log("⭐ Afficher : Starred (placeholder)");
document.getElementById("btn-history").onclick = () => log("🕘 Afficher : Historical (placeholder)");
document.getElementById("btn-settings").onclick = () => log("⚙️ Settings (placeholder)");

// ── Message d'accueil au chargement ──
log("🔧 Calibrating microphone...");
log("✅ Microphone calibrated successfully!");
speak('Welcome to SpeedyBosh. Say "hello" to compose a message.');
