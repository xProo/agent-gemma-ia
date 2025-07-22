#!/usr/bin/env pwsh

# Script pour démarrer l'interface web de l'agent IA
# Compatible Windows PowerShell

Write-Host "🤖 Démarrage de l'interface web Agent IA..." -ForegroundColor Cyan

# Vérifier si Node.js est installé
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js détecté: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "📥 Téléchargez Node.js depuis: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Vérifier si les dépendances sont installées
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de l'installation des dépendances" -ForegroundColor Red
        exit 1
    }
}

# Vérifier si le fichier .env existe
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Fichier .env non trouvé" -ForegroundColor Yellow
    Write-Host "📝 Création d'un fichier .env par défaut..." -ForegroundColor Yellow
    
    @"
# Configuration API
API_URL=http://localhost:9999
PORT=9999

# Authentification (optionnelle)
BEARER_TOKEN=
REQUIRE_AUTH=false

# Clés API pour les agents réels
OPENAI_API_KEY=
TAVILY_API_KEY=
"@ | Out-File -FilePath ".env" -Encoding UTF8
    
    Write-Host "✅ Fichier .env créé" -ForegroundColor Green
}

# Démarrer le serveur
Write-Host "🚀 Démarrage du serveur web..." -ForegroundColor Green
Write-Host "🌐 L'interface sera accessible sur: http://localhost:9999" -ForegroundColor Cyan
Write-Host "📋 Health check: http://localhost:9999/health" -ForegroundColor Cyan
Write-Host "🤖 API Agents: http://localhost:9999/agents" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Appuyez sur Ctrl+C pour arrêter le serveur" -ForegroundColor Yellow
Write-Host ""

# Démarrer le serveur avec rechargement automatique
try {
    npx tsx serveur/server.mts
} catch {
    Write-Host "❌ Erreur lors du démarrage du serveur" -ForegroundColor Red
    Write-Host "🔧 Essayez de redémarrer PowerShell en tant qu'administrateur" -ForegroundColor Yellow
    exit 1
} 