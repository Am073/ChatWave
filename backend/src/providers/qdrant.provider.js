/**
 * qdrant.provider.js
 *
 * Uses axios (not @qdrant/js-client-rest) to talk to Qdrant Cloud REST API.
 * Reason: Node.js v26 ships with a newer built-in undici/fetch that is
 * incompatible with the older undici bundled inside @qdrant/js-client-rest,
 * causing UND_ERR_INVALID_ARG "invalid onError method" crashes.
 *
 * Axios uses Node's http/https modules directly — no undici conflict.
 */

const axios = require('axios');
const settings = require('../config/settings');

class QdrantProvider {
  constructor() {
    const baseURL = (settings.QDRANT_URL || '').replace(/\/$/, '');
    const apiKey  = settings.QDRANT_API_KEY;

    if (!baseURL) throw new Error('QDRANT_URL is not set in environment variables.');

    this.http = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'api-key': apiKey } : {}),
      },
      timeout: 15000,
    });

    this.vectorSize = 768;   // gemini-embedding-001 dimension
    this.distance   = 'Cosine';
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  getCollectionName(collegeName) {
    const slug = collegeName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `cw_${slug}`;
  }

  // ── Collection Management ────────────────────────────────────────────────

  async ensureCollection(collegeName) {
    const collectionName = this.getCollectionName(collegeName);
    if (process.env.NODE_ENV === 'test') return collectionName;

    try {
      // Check if collection already exists
      const res = await this.http.get(`/collections/${collectionName}`);
      if (res.status === 200) return collectionName;  // already exists
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error(`Failed to ensure Qdrant collection ${collectionName}:`, err.message);
        throw err;
      }
    }

    // 404 → create it
    try {
      console.log(`Creating Qdrant collection: ${collectionName}`);
      await this.http.put(`/collections/${collectionName}`, {
        vectors: {
          size: this.vectorSize,
          distance: this.distance,
        },
      });

      // Create payload indexes for strict mode compatibility
      console.log(`Creating payload indexes in ${collectionName}...`);
      await this.http.put(`/collections/${collectionName}/index`, {
        field_name: 'department',
        field_schema: 'keyword',
      });
      await this.http.put(`/collections/${collectionName}/index`, {
        field_name: 'documentId',
        field_schema: 'keyword',
      });
    } catch (createErr) {
      console.error(`Failed to create Qdrant collection ${collectionName}:`, createErr.message);
      throw createErr;
    }

    return collectionName;
  }

  // ── Upsert ───────────────────────────────────────────────────────────────

  async upsertVectors(collegeName, points) {
    if (process.env.NODE_ENV === 'test') return { status: 'completed' };

    const collectionName = await this.ensureCollection(collegeName);
    try {
      const res = await this.http.put(
        `/collections/${collectionName}/points?wait=true`,
        { points }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to upsert vectors in ${collectionName}:`, err.message);
      throw err;
    }
  }

  // ── Search ───────────────────────────────────────────────────────────────

  async search(collegeName, vector, limit = 5, filter = null) {
    if (process.env.NODE_ENV === 'test') {
      return [
        {
          score: 0.95,
          payload: {
            text: 'Mock document section content.',
            documentId: 'doc123',
            chunkIndex: 2,
          },
        },
      ];
    }

    const collectionName = await this.ensureCollection(collegeName);
    try {
      const body = { vector, limit, with_payload: true };
      if (filter) body.filter = filter;

      const res = await this.http.post(
        `/collections/${collectionName}/points/search`,
        body
      );
      return res.data?.result || [];
    } catch (err) {
      console.error(`Failed to search vectors in ${collectionName}:`, err.message);
      throw err;
    }
  }

  // ── Delete by documentId ─────────────────────────────────────────────────

  async deleteByDocumentId(collegeName, documentId) {
    if (process.env.NODE_ENV === 'test') return { status: 'deleted' };

    const collectionName = await this.ensureCollection(collegeName);
    try {
      const res = await this.http.post(
        `/collections/${collectionName}/points/delete`,
        {
          filter: {
            must: [{ key: 'documentId', match: { value: documentId } }],
          },
        }
      );
      return res.data;
    } catch (err) {
      console.error(`Failed to delete points by documentId in ${collectionName}:`, err.message);
      throw err;
    }
  }
}

module.exports = new QdrantProvider();
