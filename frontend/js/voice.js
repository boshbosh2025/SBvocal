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
