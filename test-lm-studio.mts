#!/usr/bin/env node

import { createLocalModel } from "./Agents/myges/local-model.mts";

async function testLMStudio() {
  console.log("🧪 Test de connexion avec LM Studio...\n");

  try {
    // Créer le modèle local
    const model = createLocalModel({
      temperature: 0.7,
      maxTokens: 100,
      modelName: "google/gemma-3-12b",
    });

    console.log("✅ Modèle créé avec succès");
    console.log("📡 Tentative de connexion à LM Studio...\n");

    // Test simple
    const response = await model.invoke([
      {
        role: "user",
        content: "Bonjour ! Peux-tu me dire bonjour en français ?",
      },
    ]);

    console.log("✅ Connexion réussie !");
    console.log("🤖 Réponse du modèle :");
    console.log(response.content);
    console.log("\n🎉 LM Studio est correctement configuré !");
  } catch (error) {
    console.error("❌ Erreur de connexion :", error);
    console.log("\n🔧 Vérifiez que :");
    console.log("   1. LM Studio est démarré");
    console.log("   2. Le serveur local est actif sur le port 1234");
    console.log("   3. Le modèle google/gemma-3-12b est chargé");
    console.log(
      "   4. Vous pouvez tester avec : curl http://localhost:1234/v1/models"
    );
  }
}

// Exécuter le test si le script est lancé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  testLMStudio();
}

export { testLMStudio };
