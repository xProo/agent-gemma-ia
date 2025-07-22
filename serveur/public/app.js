// Configuration et état global
class ChatApp {
  constructor() {
    this.config = {
      apiUrl: "http://localhost:5432",
      bearerToken: "",
      streamMode: true,
      debugMode: true,
    };

    this.state = {
      selectedAgent: null,
      currentThreadId: null,
      isConnected: false,
      isTyping: false,
      agents: [],
    };

    this.init();
  }

  async init() {
    this.loadConfig();
    this.setupEventListeners();
    await this.loadAgents();
    await this.checkConnection();
    this.updateUI();
  }

  // Configuration
  loadConfig() {
    const saved = localStorage.getItem("chatConfig");
    if (saved) {
      this.config = { ...this.config, ...JSON.parse(saved) };
    }

    // Mettre à jour les champs du modal
    document.getElementById("apiUrl").value = this.config.apiUrl;
    document.getElementById("bearerToken").value = this.config.bearerToken;
    document.getElementById("streamMode").checked = this.config.streamMode;
    document.getElementById("debugMode").checked = this.config.debugMode;
  }

  saveConfig() {
    this.config.apiUrl = document.getElementById("apiUrl").value;
    this.config.bearerToken = document.getElementById("bearerToken").value;
    this.config.streamMode = document.getElementById("streamMode").checked;
    this.config.debugMode = document.getElementById("debugMode").checked;

    localStorage.setItem("chatConfig", JSON.stringify(this.config));
    this.log("Configuration sauvegardée");
  }

  // Gestion des événements
  setupEventListeners() {
    // Sélection d'agent
    document.getElementById("agentSelect").addEventListener("change", (e) => {
      this.selectAgent(e.target.value);
    });

    // Bouton d'envoi
    document.getElementById("sendButton").addEventListener("click", () => {
      this.sendMessage();
    });

    // Saisie de message
    const messageInput = document.getElementById("messageInput");
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    messageInput.addEventListener("input", () => {
      this.updateSendButton();
    });

    // Bouton d'effacement
    document.getElementById("clearChat").addEventListener("click", () => {
      this.clearChat();
    });

    // Modal de paramètres
    document.getElementById("settingsBtn").addEventListener("click", () => {
      this.showSettings();
    });

    document.getElementById("closeSettings").addEventListener("click", () => {
      this.hideSettings();
    });

    document.getElementById("saveSettings").addEventListener("click", () => {
      this.saveConfig();
      this.hideSettings();
      this.checkConnection();
    });

    document.getElementById("testConnection").addEventListener("click", () => {
      this.testConnection();
    });

    // Fermer le modal en cliquant à l'extérieur
    document.getElementById("settingsModal").addEventListener("click", (e) => {
      if (e.target.id === "settingsModal") {
        this.hideSettings();
      }
    });
  }

  // API et communication
  async checkConnection() {
    try {
      const response = await fetch(`${this.config.apiUrl}/health`);
      const data = await response.json();

      this.state.isConnected = response.ok;
      this.log("Connexion API:", data);

      if (response.ok) {
        this.updateConnectionStatus("connected", "Connecté");
      } else {
        this.updateConnectionStatus("disconnected", "Erreur de connexion");
      }
    } catch (error) {
      this.state.isConnected = false;
      this.updateConnectionStatus("disconnected", "Déconnecté");
      this.log("Erreur de connexion:", error);
    }
  }

  async testConnection() {
    this.log("Test de connexion...");
    await this.checkConnection();

    if (this.state.isConnected) {
      this.showNotification("Connexion réussie !", "success");
    } else {
      this.showNotification("Échec de la connexion", "error");
    }
  }

  async loadAgents() {
    try {
      const headers = this.getHeaders();
      const response = await fetch(`${this.config.apiUrl}/agents`, { headers });

      if (response.ok) {
        this.state.agents = await response.json();
        this.updateAgentSelect();
        this.updateAgentList();
        this.log("Agents chargés:", this.state.agents);
      } else {
        this.log("Erreur lors du chargement des agents");
      }
    } catch (error) {
      this.log("Erreur lors du chargement des agents:", error);
    }
  }

  async sendMessage() {
    const messageInput = document.getElementById("messageInput");
    const message = messageInput.value.trim();

    if (!message || !this.state.selectedAgent || this.state.isTyping) {
      return;
    }

    // Ajouter le message utilisateur
    this.addMessage("human", message);
    messageInput.value = "";
    this.updateSendButton();

    // Créer un nouveau thread si nécessaire
    if (!this.state.currentThreadId) {
      this.state.currentThreadId = this.generateId();
    }

    this.state.isTyping = true;
    this.updateTypingIndicator(true);

    try {
      // Utiliser le mode invoke par défaut (plus fiable)
      await this.sendMessageInvoke(message);
    } catch (error) {
      this.log("Erreur lors de l'envoi du message:", error);
      this.addMessage(
        "ai",
        "Désolé, une erreur s'est produite. Veuillez réessayer."
      );
    } finally {
      this.state.isTyping = false;
      this.updateTypingIndicator(false);
    }
  }

  async sendMessageStream(message) {
    const headers = this.getHeaders();
    headers["Content-Type"] = "application/json";

    const response = await fetch(
      `${this.config.apiUrl}/${this.state.selectedAgent}/stream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          message,
          thread_id: this.state.currentThreadId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiMessage = "";
    let messageElement = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              break;
            }

            try {
              const event = JSON.parse(data);

              switch (event.type) {
                case "stream_start":
                  messageElement = this.addMessage("ai", "");
                  break;

                case "stream_token":
                  aiMessage += event.content;
                  if (messageElement) {
                    const cleanMessage = this.cleanAgentResponse(aiMessage);
                    messageElement.querySelector(
                      ".message-content"
                    ).textContent = cleanMessage;
                    this.scrollToBottom();
                  }
                  break;

                case "tool_execution_start":
                  this.addMessage(
                    "tool",
                    `🔧 Utilisation de l'outil: ${event.tool_name}`
                  );
                  break;

                case "tool_execution_complete":
                  this.addMessage(
                    "tool",
                    `✅ Outil terminé: ${event.tool_name}`
                  );
                  break;

                case "stream_end":
                  break;

                case "error":
                  this.log("Erreur de streaming:", event);
                  break;
              }
            } catch (e) {
              this.log("Erreur parsing SSE:", e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async sendMessageInvoke(message) {
    const headers = this.getHeaders();
    headers["Content-Type"] = "application/json";

    this.log("Envoi du message à l'agent:", message);
    this.log(
      "URL:",
      `${this.config.apiUrl}/${this.state.selectedAgent}/invoke`
    );

    const response = await fetch(
      `${this.config.apiUrl}/${this.state.selectedAgent}/invoke`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          message,
          thread_id: this.state.currentThreadId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    this.log("Réponse reçue:", data);

    const cleanContent = this.cleanAgentResponse(data.content);
    this.log("Contenu nettoyé:", cleanContent);

    this.addMessage("ai", cleanContent);
  }

  // Interface utilisateur
  selectAgent(agentId) {
    this.state.selectedAgent = agentId;
    this.state.currentThreadId = null; // Nouveau thread pour chaque agent

    if (agentId) {
      this.clearChat();
      this.log(`Agent sélectionné: ${agentId}`);
    }

    this.updateUI();
  }

  addMessage(type, content) {
    const chatMessages = document.getElementById("chatMessages");

    // Supprimer le message de bienvenue si c'est le premier message
    const welcomeMessage = chatMessages.querySelector(".welcome-message");
    if (welcomeMessage) {
      welcomeMessage.remove();
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;

    const time = new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    messageDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(content)}</div>
            <span class="message-time">${time}</span>
        `;

    chatMessages.appendChild(messageDiv);
    this.scrollToBottom();

    return messageDiv;
  }

  clearChat() {
    const chatMessages = document.getElementById("chatMessages");
    chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-robot"></i>
                </div>
                <h2>Bienvenue !</h2>
                <p>Sélectionnez un agent et commencez à discuter.</p>
                <div class="agent-list" id="agentList">
                    <!-- Les agents seront chargés ici -->
                </div>
            </div>
        `;

    this.state.currentThreadId = null;
    this.updateAgentList();
    this.log("Chat effacé");
  }

  updateAgentSelect() {
    const select = document.getElementById("agentSelect");
    select.innerHTML = '<option value="">Choisir un agent...</option>';

    this.state.agents.forEach((agent) => {
      const option = document.createElement("option");
      option.value = agent.id;
      option.textContent = agent.name;
      select.appendChild(option);
    });
  }

  updateAgentList() {
    const agentList = document.getElementById("agentList");
    if (!agentList) return;

    agentList.innerHTML = "";

    this.state.agents.forEach((agent) => {
      const card = document.createElement("div");
      card.className = "agent-card";
      card.innerHTML = `
                <h3>${this.escapeHtml(agent.name)}</h3>
                <p>${this.escapeHtml(agent.description)}</p>
            `;

      card.addEventListener("click", () => {
        document.getElementById("agentSelect").value = agent.id;
        this.selectAgent(agent.id);
      });

      agentList.appendChild(card);
    });
  }

  updateSendButton() {
    const messageInput = document.getElementById("messageInput");
    const sendButton = document.getElementById("sendButton");
    const hasMessage = messageInput.value.trim().length > 0;
    const hasAgent = this.state.selectedAgent !== null;
    const isConnected = this.state.isConnected;

    sendButton.disabled =
      !hasMessage || !hasAgent || !isConnected || this.state.isTyping;
  }

  updateTypingIndicator(show) {
    const indicator = document.getElementById("typingIndicator");
    const statusMessage = document.getElementById("statusMessage");

    if (show) {
      indicator.classList.remove("hidden");
      statusMessage.textContent = "L'agent réfléchit...";
    } else {
      indicator.classList.add("hidden");
      statusMessage.textContent = "";
    }
  }

  updateConnectionStatus(status, text) {
    const statusElement = document.getElementById("connectionStatus");
    const textElement = document.getElementById("connectionText");

    statusElement.className = `connection-status ${status}`;
    textElement.textContent = text;
  }

  updateUI() {
    this.updateSendButton();
    this.updateConnectionStatus(
      this.state.isConnected ? "connected" : "disconnected",
      this.state.isConnected ? "Connecté" : "Déconnecté"
    );
  }

  showSettings() {
    document.getElementById("settingsModal").classList.remove("hidden");
  }

  hideSettings() {
    document.getElementById("settingsModal").classList.add("hidden");
  }

  showNotification(message, type = "info") {
    // Créer une notification temporaire
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Styles pour la notification
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "1rem 1.5rem",
      borderRadius: "8px",
      color: "white",
      fontWeight: "500",
      zIndex: "10000",
      animation: "slideIn 0.3s ease-out",
    });

    if (type === "success") {
      notification.style.background = "#10b981";
    } else if (type === "error") {
      notification.style.background = "#ef4444";
    } else {
      notification.style.background = "#6366f1";
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease-out";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  scrollToBottom() {
    const chatMessages = document.getElementById("chatMessages");
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Utilitaires
  getHeaders() {
    const headers = {};
    if (this.config.bearerToken) {
      headers["Authorization"] = `Bearer ${this.config.bearerToken}`;
    }
    return headers;
  }

  generateId() {
    return (
      "thread_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    );
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  cleanAgentResponse(content) {
    // Nettoyer le contenu des balises TOOL_REQUEST
    let cleanContent = content.replace(
      /\[TOOL_REQUEST\].*?\[END_TOOL_REQUEST\]/gs,
      ""
    );
    cleanContent = cleanContent.replace(/\[TOOL_REQUEST\].*$/s, "");
    cleanContent = cleanContent.trim();
    return cleanContent;
  }

  log(...args) {
    if (this.config.debugMode) {
      console.log("[ChatApp]", ...args);
    }
  }
}

// Styles CSS pour les animations de notification
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialiser l'application
document.addEventListener("DOMContentLoaded", () => {
  window.chatApp = new ChatApp();
});
