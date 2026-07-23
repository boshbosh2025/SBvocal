// ─────────────────────────────────────────────────────────────
// SpeedyBosh — client API vers le backend FastAPI (auth.py)
// Adapte API_BASE si ton backend tourne ailleurs qu'en local.
// ─────────────────────────────────────────────────────────────
const API_BASE = "http://127.0.0.1:8000";

const TOKEN_KEY = "speedybosh_token";

const Api = {
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  setToken(t) { localStorage.setItem(TOKEN_KEY, t); },
  clearToken() { localStorage.removeItem(TOKEN_KEY); },

  async register(username, email, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || "Erreur d'inscription");
    return res.json();
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || "Identifiants invalides");
    const data = await res.json();
    this.setToken(data.access_token);
    return data;
  },

  async me() {
    const token = this.getToken();
    if (!token) throw new Error("Non connecté");
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Session expirée");
    return res.json();
  },

  async sendMail(payload) {
    const token = localStorage.getItem("speedybosh_token");
    console.log("Envoi vers:", "http://127.0.0.1:8000/mail/send");
    console.log("Payload:", payload);
    console.log("Token:", token);
    const response = await fetch("http://127.0.0.1:8000/mail/send", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error("Erreur envoi mail: " + response.status);
    }
    return await response.json();
  },

  logout() { this.clearToken(); },
};
