/**
 * Environment-aware logger utility.
 * Suppresses console output in production builds.
 *
 * Usage:
 *   import logger from '../../utils/logger';
 *   logger.log('debug info');
 *   logger.warn('something off');
 *   logger.error('critical failure');
 */

const isProd = import.meta.env.PROD;

const logger = {
  log: (...args) => {
    if (!isProd) console.log(...args);
  },
  warn: (...args) => {
    if (!isProd) console.warn(...args);
  },
  error: (...args) => {
    if (!isProd) console.error(...args);
  },
};

export default logger;
