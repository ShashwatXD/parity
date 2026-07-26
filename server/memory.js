import { generateContent } from './llm.js';

/**
 * Custom TF-IDF/Keyword Search engine for local zero-dependency RAG
 */
export class SimpleRAGIndex {
  constructor() {
    this.chunks = [];
  }

  // Tokenize and clean text
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2); // filter short words
  }

  // Index document content by chunking
  addDocument(filename, content) {
    // Chunk by paragraphs or double newlines
    const rawChunks = content.split(/\n\s*\n+/);
    rawChunks.forEach((textChunk, index) => {
      const trimmed = textChunk.trim();
      if (trimmed.length < 50) return; // skip tiny chunks

      // Sub-chunk if too long (more than 1200 characters)
      if (trimmed.length > 1200) {
        const sentences = trimmed.match(/[^.!?]+[.!?]+/g) || [trimmed];
        let currentChunk = '';
        sentences.forEach(sentence => {
          if ((currentChunk + sentence).length > 1200) {
            this.chunks.push({
              id: `${filename}_${index}_sub`,
              text: currentChunk.trim(),
              tokens: this.tokenize(currentChunk)
            });
            currentChunk = sentence;
          } else {
            currentChunk += ' ' + sentence;
          }
        });
        if (currentChunk.trim()) {
          this.chunks.push({
            id: `${filename}_${index}_last`,
            text: currentChunk.trim(),
            tokens: this.tokenize(currentChunk)
          });
        }
      } else {
        this.chunks.push({
          id: `${filename}_${index}`,
          text: trimmed,
          tokens: this.tokenize(trimmed)
        });
      }
    });
  }

  // TF-IDF style search
  search(query, topK = 3) {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || this.chunks.length === 0) {
      return [];
    }

    // Calculate document frequency (DF) for query tokens
    const df = {};
    queryTokens.forEach(token => {
      let count = 0;
      this.chunks.forEach(chunk => {
        if (chunk.tokens.includes(token)) count++;
      });
      df[token] = count;
    });

    const scoredChunks = this.chunks.map(chunk => {
      let score = 0;
      queryTokens.forEach(token => {
        const tf = chunk.tokens.filter(t => t === token).length;
        if (tf > 0) {
          const idf = Math.log((this.chunks.length + 1) / (df[token] + 1)) + 1;
          score += tf * idf;
        }
      });
      return { chunk, score };
    });

    // Sort descending and filter score > 0
    return scoredChunks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => ({
        source: item.chunk.id,
        text: item.chunk.text,
        score: Number(item.score.toFixed(4))
      }));
  }
}

/**
 * Shared memory manager per debate session
 */
export class SharedMemory {
  constructor() {
    this.claims = []; // Array of { agent, text, round, relevance }
    this.ragIndex = new SimpleRAGIndex();
    this.hasDocuments = false;
  }

  addClaim(agent, text, round) {
    this.claims.push({
      id: `claim_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      agent,
      text,
      round,
      timestamp: new Date().toISOString()
    });
  }

  addGroundingDocument(filename, text) {
    this.ragIndex.addDocument(filename, text);
    this.hasDocuments = true;
  }

  // Retrieve relevant info based on a query
  retrieveContext(queryText) {
    const memoryClaims = this.claims.slice(-5); // get last 5 claims
    const ragMatches = this.hasDocuments ? this.ragIndex.search(queryText, 2) : [];
    
    return {
      recentClaims: memoryClaims,
      ragGrounding: ragMatches
    };
  }

  getSnapshot() {
    return {
      claims: this.claims,
      hasDocuments: this.hasDocuments
    };
  }
}

/**
 * Compresses historical messages when they exceed safety token windows
 */
export async function compressHistory(messages, topic) {
  // If we have fewer than 4 messages, no compression needed
  if (messages.length < 4) {
    return null;
  }

  const historyText = messages
    .filter(m => m.sender !== 'fact_checker' && m.sender !== 'judge')
    .map(m => `${m.sender.toUpperCase()} (Round ${m.round}): ${m.content}`)
    .join('\n\n');

  const compressPrompt = `
You are the Summarizer Agent for a multi-agent debate platform.
The topic of debate is: "${topic}"

Review the historical arguments between DEBATER and CHALLENGER:
===
${historyText}
===

Please provide a highly compact summary of the debate progress. Identify:
1. Main arguments proposed by DEBATER (proponent).
2. Main counters and rebuttals proposed by CHALLENGER (opponent).
3. Current areas of disagreement.

Your summary must be under 200 words and retain all core facts and claims.
`;

  try {
    const result = await generateContent({
      model: 'gemini-2.5-flash',
      role: 'summarizer',
      prompt: compressPrompt,
      systemPrompt: 'You are a precise summarization agent. Keep summaries dense and objective.'
    });
    return result;
  } catch (error) {
    console.error('Failed to compress context history:', error);
    return null;
  }
}
