const { GoogleGenerativeAI } = require('@google/generative-ai');
const settings = require('../config/settings');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry(fn, maxRetries = 6, initialDelay = 1000) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      const isRateLimit = error.status === 429 || 
                          (error.message && error.message.includes('429')) ||
                          (error.message && error.message.includes('quota'));
      if (isRateLimit && attempt <= maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.warn(`[Gemini API] Quota/Rate Limit (429) hit. Retrying attempt ${attempt}/${maxRetries} in ${Math.round(delay)}ms...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
}

class GeminiProvider {
  constructor() {
    if (!settings.GEMINI_API_KEY) {
      throw new Error('No Gemini API key found in settings.');
    }
    this.client = new GoogleGenerativeAI(settings.GEMINI_API_KEY);
    this.modelName = settings.GEMINI_MODEL;
    console.log(`Loaded Gemini API provider with model: ${this.modelName}`);
  }

  async generateText(prompt, systemPrompt) {
    if (process.env.NODE_ENV === 'test') {
      return 'Mock answer from ChatWave.';
    }

    return callWithRetry(async () => {
      try {
        const model = this.client.getGenerativeModel({ model: this.modelName });
        
        const reqPayload = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        };
        if (systemPrompt) {
          reqPayload.systemInstruction = systemPrompt;
        }

        const result = await model.generateContent(reqPayload);
        return result.response.text();
      } catch (error) {
        console.error(`Error generating text:`, error.message);
        throw error;
      }
    });
  }

  async generateTextStream(prompt, systemPrompt, onChunk) {
    if (process.env.NODE_ENV === 'test') {
      onChunk('Mock ');
      onChunk('streamed ');
      onChunk('response.');
      return 'Mock streamed response.';
    }

    return callWithRetry(async () => {
      try {
        const model = this.client.getGenerativeModel({ model: this.modelName });
        
        const reqPayload = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        };
        if (systemPrompt) {
          reqPayload.systemInstruction = systemPrompt;
        }

        const result = await model.generateContentStream(reqPayload);
        let fullText = '';
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullText += chunkText;
          if (onChunk) {
            onChunk(chunkText);
          }
        }
        return fullText;
      } catch (error) {
        console.error(`Error generating text stream:`, error.message);
        throw error;
      }
    });
  }

  async generateEmbedding(text) {
    if (process.env.NODE_ENV === 'test') {
      return new Array(768).fill(0.1);
    }

    return callWithRetry(async () => {
      try {
        const model = this.client.getGenerativeModel({ model: 'gemini-embedding-001' });
        const result = await model.embedContent({
          content: { parts: [{ text }] },
          outputDimensionality: 768
        });
        
        if (result && result.embedding && result.embedding.values) {
          return result.embedding.values;
        }
        throw new Error('Unexpected empty response from embedContent');
      } catch (error) {
        console.error(`Error generating embedding:`, error.message);
        throw error;
      }
    });
  }
}

module.exports = new GeminiProvider();
