// Configuration de la reconnaissance vocale
class VoiceRecognition {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.onResult = null;
        this.onError = null;
        this.onStart = null;
        this.onEnd = null;
        
        this.init();
    }
    
    async checkMicroPermission() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('⚠️ API mediaDevices non disponible');
                return false;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log('✅ Permission micro accordée');
            return true;
        } catch (err) {
            console.error('❌ Permission micro refusée ou indisponible:', err.name, err.message);
            if (err.name === 'NotAllowedError') {
                alert('⚠️ Accès au micro bloqué. Veuillez autoriser le micro dans les paramètres du navigateur (icône micro dans la barre d\'adresse).');
            }
            return false;
        }
    }

    init() {
        // Vérifier si le navigateur supporte la reconnaissance vocale
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'fr-FR';
            this.recognition.continuous = true;
            this.recognition.interimResults = false;
            this.recognition.maxAlternatives = 1;

            // Événements
            this.recognition.onresult = (event) => {
                console.log('🔍 onresult déclenché - nombre de résultats:', event.results.length);
                const last = event.results.length - 1;
                const transcript = event.results[last][0].transcript;
                const confidence = event.results[last][0].confidence;
                console.log(`📝 Transcript: "${transcript}" (confiance: ${(confidence * 100).toFixed(1)}%)`);
                if (this.onResult) {
                    this.onResult(transcript);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('❌ Erreur de reconnaissance vocale:', event.error, '(no-speech, audio-capture, not-allowed, etc.)');
                if (this.onError) {
                    this.onError(event.error);
                }
            };

            this.recognition.onstart = () => {
                console.log('🎙️ Reconnaissance démarrée (onstart)');
                this.isListening = true;
                if (this.onStart) {
                    this.onStart();
                }
            };

            this.recognition.onend = () => {
                console.log('🏁 Reconnaissance terminée (onend) - isListening passe à false');
                this.isListening = false;
                if (this.onEnd) {
                    this.onEnd();
                }
            };

            this.recognition.onaudiostart = () => console.log('🔊 Audio capturé démarre (onaudiostart)');
            this.recognition.onsoundstart = () => console.log('👂 Son détecté (onsoundstart)');
            this.recognition.onspeechstart = () => console.log('🗣️ Parole détectée (onspeechstart)');
            this.recognition.onspeechend = () => console.log('🤫 Parole terminée (onspeechend)');
            this.recognition.onsoundend = () => console.log('🔈 Son terminé (onsoundend)');
            this.recognition.onaudioend = () => console.log('🔇 Audio capturé terminé (onaudioend)');
        } else {
            console.error('❌ La reconnaissance vocale n\'est pas supportée par ce navigateur');
        }
    }
    
    async start() {
        if (this.recognition && !this.isListening) {
            const hasPerm = await this.checkMicroPermission();
            if (!hasPerm) {
                console.warn('⚠️ start() annulé: pas de permission micro');
                return;
            }
            window.__speechController.request(this);
            try {
                this.recognition.start();
                console.log('▶️ start() appelé avec succès');
            } catch (e) {
                console.warn('⚠️ start() a échoué:', e.message);
            }
        } else if (this.isListening) {
            console.log('ℹ️ start() ignoré: reconnaissance déjà en cours');
        }
    }

    stop() {
        if (this.recognition && this.isListening) {
            console.log('⏹️ stop() appelé - arrêt de la reconnaissance');
            try {
                this.recognition.stop();
            } catch (e) {
                console.warn('⚠️ stop() a échoué:', e.message);
            }
        } else if (!this.isListening) {
            console.log('ℹ️ stop() ignoré: reconnaissance déjà arrêtée');
        }
        window.__speechController.release(this);
    }

    listenOnce(timeoutMs = 15000) {
        return new Promise(async (resolve, reject) => {
            if (!this.recognition) {
                reject(new Error('Reconnaissance vocale non supportée'));
                return;
            }
            console.log(`🚀 listenOnce() appelé (timeout=${timeoutMs}ms)`);

            const hasPerm = await this.checkMicroPermission();
            if (!hasPerm) {
                reject(new Error('Permission micro refusée'));
                return;
            }

            let done = false;
            let resultReceived = false;
            const originalResult = this.recognition.onresult;
            const originalError = this.recognition.onerror;
            const originalEnd = this.recognition.onend;
            let lastTranscript = "";

            let timeoutId = null;
            const clearTout = () => { if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; } };

            const cleanup = () => {
                clearTout();
                this.recognition.onresult = originalResult;
                this.recognition.onerror = originalError;
                this.recognition.onend = originalEnd;
            };

            const settle = (fn, arg) => {
                if (done) return;
                done = true;
                cleanup();
                if (this.isListening) {
                    try { this.recognition.stop(); } catch (e) {}
                }
                fn(arg);
            };

            this.recognition.onresult = (event) => {
                const last = event.results.length - 1;
                const transcript = event.results[last][0].transcript;
                const confidence = event.results[last][0].confidence;
                console.log(`✅ listenOnce onresult: "${transcript}" (${(confidence * 100).toFixed(1)}%)`);
                lastTranscript = transcript;
                resultReceived = true;
                clearTout();
                setTimeout(() => {
                    if (lastTranscript.trim()) {
                        settle(resolve, lastTranscript.trim());
                    }
                }, 400);
            };

            this.recognition.onerror = (event) => {
                console.error('❌ listenOnce onerror:', event.error);
                if (event.error === 'no-speech') {
                    if (!resultReceived) {
                        console.log('⚠️ no-speech détecté, on attend encore...');
                        return;
                    }
                }
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    settle(reject, new Error('Micro bloqué par le navigateur. Autorisez le micro dans les paramètres.'));
                    return;
                }
                if (!done && !resultReceived) {
                    settle(reject, new Error(event.error));
                }
            };

            this.recognition.onend = () => {
                console.log('🏁 listenOnce onend - resultReceived:', resultReceived, 'transcript:', `"${lastTranscript}"`);
                if (!done) {
                    if (lastTranscript.trim()) {
                        settle(resolve, lastTranscript.trim());
                    } else if (!resultReceived) {
                        console.log('🔁 listenOnce: pas de résultat, on redémarre la reconnaissance');
                        try {
                            window.__speechController.request(this);
                            this.recognition.start();
                        } catch (e) {
                            console.warn('⚠️ listenOnce restart échoué:', e.message);
                            if (!done) settle(reject, new Error(e.message));
                        }
                    }
                }
            };

            timeoutId = setTimeout(() => {
                console.log(`⏰ listenOnce timeout après ${timeoutMs}ms - transcript="${lastTranscript}"`);
                if (lastTranscript.trim()) {
                    settle(resolve, lastTranscript.trim());
                } else {
                    settle(reject, new Error('Timeout: aucune parole détectée'));
                }
            }, timeoutMs);

            window.__speechController.request(this);
            try {
                if (this.isListening) {
                    console.log('ℹ️ listenOnce: reconnaissance déjà active, on stop puis restart');
                    this.recognition.stop();
                    setTimeout(() => {
                        if (!done) {
                            try { this.recognition.start(); }
                            catch (e) { console.warn('⚠️ listenOnce start après stop échoué:', e.message); }
                        }
                    }, 150);
                } else {
                    this.recognition.start();
                }
                console.log('▶️ listenOnce: reconnaissance démarrée');
            } catch (e) {
                if (String(e.message).includes("already started")) {
                    console.log('ℹ️ listenOnce: déjà démarré, on continue');
                } else {
                    console.error('❌ listenOnce start erreur:', e.message);
                    settle(reject, new Error(e.message));
                }
            }
        });
    }
    
    isSupported() {
        return this.recognition !== null;
    }
    
    setCallbacks(callbacks) {
        if (callbacks.onResult) this.onResult = callbacks.onResult;
        if (callbacks.onError) this.onError = callbacks.onError;
        if (callbacks.onStart) this.onStart = callbacks.onStart;
        if (callbacks.onEnd) this.onEnd = callbacks.onEnd;
    }
    
    speak(text) {
        return new Promise((resolve) => {
            if (!('speechSynthesis' in window)) { resolve(); return; }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'fr-FR';
            window.speechSynthesis.speak(utterance);
            const t0 = Date.now();
            const iv = setInterval(() => {
                if ((!window.speechSynthesis.speaking && !window.speechSynthesis.pending) || Date.now() - t0 > 30000) {
                    clearInterval(iv);
                    resolve();
                }
            }, 100);
        });
    }
}

// Contrôleur global : une seule reconnaissance à la fois
window.__speechController = {
    active: null,
    request(instance) {
        if (this.active && this.active !== instance) {
            try { this.active.stop(); } catch (e) {}
        }
        this.active = instance;
    },
    release(instance) {
        if (this.active === instance) this.active = null;
    }
};

// Créer une instance globale
const voiceRecognition = new VoiceRecognition();

// Exporter
window.voice = voiceRecognition;

// Talk button modal functionality
const talkBtn = document.getElementById("talk-btn");
const talkBtnRegister = document.getElementById("talk-btn-register");
const modal = document.getElementById("voice-modal");
const promptEl = document.getElementById("voice-prompt");
const closeModal = document.getElementById("close-modal");
const progressFill = document.getElementById("progress-fill");
const micIcon = document.querySelector(".mic-icon");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function speak(text, lang = "fr-FR") {
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  synth.speak(utter);
}

async function checkMicroPermissionStandalone() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("⚠️ API mediaDevices non disponible");
      return true;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    console.log("✅ Permission micro accordée (voiceFillFlow)");
    return true;
  } catch (err) {
    console.error("❌ Permission micro refusée (voiceFillFlow):", err.name, err.message);
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      alert("⚠️ Accès au micro bloqué. Veuillez autoriser le micro dans les paramètres du navigateur (icône micro dans la barre d'adresse).");
    }
    return false;
  }
}

function safeRestartRecognition(recognition, delay = 200) {
  console.log(`🔄 safeRestartRecognition appelé (delay=${delay}ms)`);
  try { recognition.stop(); } catch(e) {
    console.log("ℹ️ stop déjà stoppé:", e.message);
  }
  setTimeout(() => {
    try {
      recognition.start();
      console.log("▶️ safeRestartRecognition: restart OK");
    } catch(e) {
      if (String(e.message).includes("already started")) {
        console.log("ℹ️ safeRestartRecognition: déjà démarré");
      } else {
        console.warn("⚠️ safeRestartRecognition erreur:", e.message);
        setTimeout(() => {
          try { recognition.start(); } catch(e2) {}
        }, delay + 200);
      }
    }
  }, delay);
}

async function voiceFillFlow(steps, activeBtn, lang = "fr-FR") {
  if (!SpeechRecognition) {
    alert("La reconnaissance vocale n'est pas supportée par votre navigateur. Utilisez Chrome ou Edge.");
    return;
  }

  const hasPerm = await checkMicroPermissionStandalone();
  if (!hasPerm) {
    alert("❌ Impossible de démarrer sans accès au micro.");
    return;
  }

  modal.style.display = "flex";
  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  if (activeBtn) {
    activeBtn.classList.add("active");
  }

  let flowResultReceived = false;
  let flowLastTranscript = "";

  recognition.onaudiostart = () => console.log("🔊 [voiceFillFlow] onaudiostart");
  recognition.onsoundstart = () => console.log("👂 [voiceFillFlow] onsoundstart");
  recognition.onspeechstart = () => console.log("🗣️ [voiceFillFlow] onspeechstart");
  recognition.onspeechend = () => console.log("🤫 [voiceFillFlow] onspeechend");
  recognition.onsoundend = () => console.log("🔈 [voiceFillFlow] onsoundend");
  recognition.onaudioend = () => console.log("🔇 [voiceFillFlow] onaudioend");

  recognition.onstart = () => {
    console.log("🎙️ [voiceFillFlow] Reconnaissance démarrée (onstart)");
    flowResultReceived = false;
    flowLastTranscript = "";
    if (promptEl.textContent && !promptEl.textContent.includes("🎙️")) {
      promptEl.textContent += " 🎙️ (parlez...)";
    }
    promptEl.classList.add("listening");
    if (micIcon) {
      micIcon.classList.add("listening");
    }
  };

  recognition.onend = () => {
    console.log("🏁 [voiceFillFlow] Reconnaissance terminée (onend) - resultReceived:", flowResultReceived);
    promptEl.textContent = promptEl.textContent.replace(" 🎙️ (parlez...)", "");
    promptEl.classList.remove("listening");
    if (micIcon) {
      micIcon.classList.remove("listening");
    }
    if (!flowResultReceived && modal.style.display === "flex") {
      console.log("🔁 [voiceFillFlow] onend sans résultat, on redémarre");
      safeRestartRecognition(recognition, 150);
    }
  };

  recognition.onerror = (err) => {
    console.error("❌ [voiceFillFlow] Erreur vocale:", err.error);
    if (err.error === "no-speech") {
      console.log("⚠️ [voiceFillFlow] no-speech - on continue d'écouter");
      return;
    }
    if (err.error === "not-allowed" || err.error === "service-not-allowed") {
      promptEl.textContent = "❌ Micro bloqué";
      alert("Micro bloqué par le navigateur. Autorisez le micro dans les paramètres.");
      return;
    }
    if (err.error === "aborted") {
      console.log("ℹ️ [voiceFillFlow] aborted (normal lors d'un restart)");
      return;
    }
    promptEl.textContent = "⚠️ Erreur, veuillez répéter";
    if (modal.style.display === "flex") {
      safeRestartRecognition(recognition, 500);
    }
  };

  let currentStep = 0;
  const confirmYes = lang === "fr-FR" ? ["oui", "yes", "d'accord", "ok", "ouais"] : ["yes", "yeah", "ok", "correct", "yep"];
  const confirmNo = lang === "fr-FR" ? ["non", "no", "pas", "nan"] : ["no", "nope", "wrong", "nah"];

  function updateProgress() {
    const progress = ((currentStep) / steps.length) * 100;
    if (progressFill) {
      progressFill.style.width = progress + "%";
    }
  }

  function askConfirmation(transcript) {
    const confirmPrompt = lang === "fr-FR"
      ? `Vous avez dit : ${transcript}. Voulez-vous confirmer ?`
      : `You said: ${transcript}. Do you confirm?`;
    promptEl.textContent = confirmPrompt;
    speak(confirmPrompt, lang);

    safeRestartRecognition(recognition, 400);

    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const response = event.results[last][0].transcript.toLowerCase().trim();
      const confidence = event.results[last][0].confidence;
      console.log(`✅ [voiceFillFlow - confirmation] Transcript: "${response}" (${(confidence*100).toFixed(1)}%)`);
      flowResultReceived = true;
      flowLastTranscript = response;

      const isYes = confirmYes.some(word => response.includes(word));
      const isNo = confirmNo.some(word => response.includes(word));

      if (isYes) {
        console.log("👉 Confirmation: OUI");
        currentStep++;
        setTimeout(nextStep, 800);
      } else if (isNo) {
        console.log("👉 Confirmation: NON - on réessaie l'étape");
        setTimeout(nextStep, 800);
      } else {
        console.log("👉 Confirmation: INCERTAIN - on redemande");
        setTimeout(() => askConfirmation(transcript), 500);
      }
    };
  }

  function countdown(callback) {
    let count = 3;
    promptEl.textContent = count.toString();

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        promptEl.textContent = count.toString();
      } else {
        clearInterval(interval);
        callback();
      }
    }, 800);
  }

  function nextStep() {
    if (currentStep >= steps.length) {
      promptEl.textContent = lang === "fr-FR" ? "Terminé ✅" : "Done ✅";
      speak(lang === "fr-FR" ? "Terminé" : "Done", lang);
      if (progressFill) {
        progressFill.style.width = "100%";
      }
      if (activeBtn) {
        activeBtn.classList.remove("active");
      }
      try { recognition.stop(); } catch(e) {}
      setTimeout(() => modal.style.display = "none", 1500);
      return;
    }
    const { prompt, fieldId } = steps[currentStep];

    countdown(() => {
      promptEl.textContent = prompt;
      speak(prompt, lang);
      updateProgress();

      safeRestartRecognition(recognition, 300);

      recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript;
        const confidence = event.results[last][0].confidence;
        console.log(`✅ [voiceFillFlow - step ${currentStep+1}] Transcript: "${transcript}" (${(confidence*100).toFixed(1)}%)`);
        flowResultReceived = true;
        flowLastTranscript = transcript;

        const field = document.getElementById(fieldId);
        if (field) {
          field.value = transcript;
          if (field.type === "password" || fieldId.includes("password")) {
            field.type = "password";
          }
        }
        setTimeout(() => askConfirmation(transcript), 400);
      };
    });
  }

  nextStep();
}

if (talkBtn) {
  talkBtn.addEventListener("click", () => {
    console.log("Bouton Talk cliqué !");
    voiceFillFlow([
      { prompt: "Entrez votre Email", fieldId: "login-email" },
      { prompt: "Entrez votre Mot de passe", fieldId: "login-password" }
    ], talkBtn);
  });
}

if (talkBtnRegister) {
  talkBtnRegister.addEventListener("click", () => {
    console.log("Bouton Talk Register cliqué !");
    voiceFillFlow([
      { prompt: "Entrez votre Nom d'utilisateur", fieldId: "reg-username" },
      { prompt: "Entrez votre Email", fieldId: "reg-email" },
      { prompt: "Entrez votre Mot de passe", fieldId: "reg-password" }
    ], talkBtnRegister);
  });
}

if (closeModal) {
  closeModal.addEventListener("click", () => modal.style.display = "none");
}
