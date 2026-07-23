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
    
    init() {
        // Vérifier si le navigateur supporte la reconnaissance vocale
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'fr-FR';
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            
            // Événements
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (this.onResult) {
                    this.onResult(transcript);
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Erreur de reconnaissance vocale:', event.error);
                if (this.onError) {
                    this.onError(event.error);
                }
            };
            
            this.recognition.onstart = () => {
                this.isListening = true;
                if (this.onStart) {
                    this.onStart();
                }
            };
            
            this.recognition.onend = () => {
                this.isListening = false;
                if (this.onEnd) {
                    this.onEnd();
                }
            };
        } else {
            console.error('La reconnaissance vocale n\'est pas supportée par ce navigateur');
        }
    }
    
    start() {
        if (this.recognition && !this.isListening) {
            this.recognition.start();
        }
    }
    
    stop() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }
    
    listenOnce() {
        return new Promise((resolve, reject) => {
            if (!this.recognition) {
                reject(new Error('Reconnaissance vocale non supportée'));
                return;
            }
            
            const originalOnResult = this.recognition.onresult;
            const originalOnError = this.recognition.onerror;
            const originalOnEnd = this.recognition.onend;
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.recognition.onresult = originalOnResult;
                this.recognition.onerror = originalOnError;
                this.recognition.onend = originalOnEnd;
                resolve(transcript);
            };
            
            this.recognition.onerror = (event) => {
                this.recognition.onresult = originalOnResult;
                this.recognition.onerror = originalOnError;
                this.recognition.onend = originalOnEnd;
                reject(new Error(event.error));
            };
            
            this.recognition.onend = () => {
                this.recognition.onresult = originalOnResult;
                this.recognition.onerror = originalOnError;
                this.recognition.onend = originalOnEnd;
            };
            
            this.recognition.start();
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
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'fr-FR';
            window.speechSynthesis.speak(utterance);
        }
    }
}

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

function voiceFillFlow(steps, activeBtn, lang = "fr-FR") {
  if (!SpeechRecognition) {
    alert("La reconnaissance vocale n'est pas supportée.");
    return;
  }

  modal.style.display = "flex";
  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  if (activeBtn) {
    activeBtn.classList.add("active");
  }

  recognition.onstart = () => {
    console.log("Reconnaissance vocale démarrée");
    promptEl.textContent += " 🎙️ (parlez...)";
    promptEl.classList.add("listening");
    if (micIcon) {
      micIcon.classList.add("listening");
    }
  };
  recognition.onend = () => {
    console.log("Reconnaissance terminée");
    promptEl.textContent = promptEl.textContent.replace(" 🎙️ (parlez...)", "");
    promptEl.classList.remove("listening");
    if (micIcon) {
      micIcon.classList.remove("listening");
    }
  };

  recognition.onerror = (err) => {
    console.error("Erreur vocale :", err.error);
    promptEl.textContent = "Veuillez répéter";
  };

  let currentStep = 0;
  const confirmYes = lang === "fr-FR" ? ["oui", "yes", "d'accord", "ok"] : ["yes", "yeah", "ok", "correct"];
  const confirmNo = lang === "fr-FR" ? ["non", "no", "pas"] : ["no", "nope", "wrong"];

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
    recognition.start();

    recognition.onresult = (event) => {
      const response = event.results[0][0].transcript.toLowerCase();
      const isYes = confirmYes.some(word => response.includes(word));
      const isNo = confirmNo.some(word => response.includes(word));

      if (isYes) {
        currentStep++;
        setTimeout(nextStep, 1000);
      } else if (isNo) {
        // Retry current step
        setTimeout(nextStep, 1000);
      } else {
        // Unclear response, ask again
        askConfirmation(transcript);
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
    }, 1000);
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
      setTimeout(() => modal.style.display = "none", 1500);
      return;
    }
    const { prompt, fieldId } = steps[currentStep];
    
    countdown(() => {
      promptEl.textContent = prompt;
      speak(prompt, lang);
      updateProgress();
      recognition.start();

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("Texte reconnu :", transcript);
        const field = document.getElementById(fieldId);
        field.value = transcript;
        // Mask password fields for security
        if (field.type === "password" || fieldId.includes("password")) {
          field.type = "password";
        }
        // Ask for confirmation
        setTimeout(() => askConfirmation(transcript), 500);
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
