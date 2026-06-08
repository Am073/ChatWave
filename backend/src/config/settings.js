const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string({
    required_error: 'MONGO_URI is required',
  }).url(),
  JWT_SECRET: z.string({
    required_error: 'JWT_SECRET is required',
  }).min(16),
  JWT_REFRESH_SECRET: z.string({
    required_error: 'JWT_REFRESH_SECRET is required',
  }).min(16),
  CSRF_SECRET: z.string({
    required_error: 'CSRF_SECRET is required',
  }).min(16),
  GEMINI_API_KEY: z.string({
    required_error: 'GEMINI_API_KEY is required',
  }),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  QDRANT_URL: z.string({
    required_error: 'QDRANT_URL is required',
  }).url(),
  QDRANT_API_KEY: z.string().optional().default(''),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  throw new Error('Invalid environment variables configuration');
}

module.exports = parsed.data;
