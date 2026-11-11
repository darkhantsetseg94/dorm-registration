require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const isTest = env === 'test';
const isProduction = env === 'production';

/**
 * Нууц утгыг .env-ээс уншина. Тест орчноос бусад үед заавал байх ёстой.
 */
function required(name, testDefault) {
  const value = process.env[name];
  if (value) return value;
  if (isTest) return testDefault;
  throw new Error(`${name} орчны хувьсагч тохируулагдаагүй байна (.env.example-ийг үзнэ үү)`);
}

module.exports = {
  env,
  isTest,
  isProduction,
  port: Number(process.env.PORT) || 3000,
  dbFile: process.env.DB_FILE || 'data/odb.db',
  sessionSecret: required('SESSION_SECRET', 'test-only-session-secret'),
  sessionMaxAgeMs: 2 * 60 * 60 * 1000, // 2 цаг
  // bcrypt-ийн cost. Тестэд хурдан ажиллуулахын тулд бага утга ашиглана.
  bcryptRounds: isTest ? 4 : 10,
  login: {
    windowMs: 15 * 60 * 1000, // 15 минут
    maxFailedAttempts: 5,
  },
};
