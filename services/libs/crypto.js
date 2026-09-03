import crypto from 'crypto';
import { createWrapper } from '../wrapper.js';

const cryptoLib = {
  hash(algorithm, data) {
    const algo = algorithm.toLowerCase();
    if (!['sha256', 'sha512', 'md5'].includes(algo)) {
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
    }
    const input = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash(algo).update(input).digest('hex');
  },

  hmac(algorithm, key, data) {
    const algo = algorithm.toLowerCase();
    if (!['sha256', 'sha512', 'md5'].includes(algo)) {
      throw new Error(`Unsupported hmac algorithm: ${algorithm}`);
    }
    const input = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHmac(algo, key).update(input).digest('hex');
  },

  encrypt(algorithm, key, iv, data) {
    const algo = algorithm.toLowerCase();
    const keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
    const ivBuf = Buffer.isBuffer(iv) ? iv : Buffer.from(iv, 'hex');
    const input = typeof data === 'string' ? data : JSON.stringify(data);
    const cipher = crypto.createCipheriv(algo, keyBuf, ivBuf);
    let encrypted = cipher.update(input, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  },

  decrypt(algorithm, key, iv, data) {
    const algo = algorithm.toLowerCase();
    const keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
    const ivBuf = Buffer.isBuffer(iv) ? iv : Buffer.from(iv, 'hex');
    const decipher = crypto.createDecipheriv(algo, keyBuf, ivBuf);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  },

  randomBytes(size) {
    return crypto.randomBytes(size).toString('hex');
  },

  randomUUID() {
    return crypto.randomUUID();
  }
};

export default createWrapper(cryptoLib);
