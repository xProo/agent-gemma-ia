import { ChatOpenAI } from "@langchain/openai";

// Configuration pour LM Studio
// LM Studio expose généralement l'API OpenAI sur http://localhost:1234/v1
export const createLocalModel = (
  options: {
    temperature?: number;
    maxTokens?: number;
    modelName?: string;
  } = {}
) => {
  const {
    temperature = 0.7,
    maxTokens = 4096,
    modelName = "google/gemma-3-12b",
  } = options;

  return new ChatOpenAI({
    modelName: modelName,
    temperature: temperature,
    maxTokens: maxTokens,
    openAIApiKey: "lm-studio",
    configuration: {
      baseURL: "http://localhost:1234/v1",
    },
    streaming: true,
  });
};

// Modèle par défaut pour l'agent myges
export const localGemmaModel = createLocalModel({
  temperature: 0.5,
  maxTokens: 4096,
  modelName: "google/gemma-3-12b",
});
