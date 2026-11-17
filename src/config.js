require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';

// Нууц утгыг код дотор бичихгүй — заавал орчны хувьсагчаас уншина.
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET орчны хувьсагч тохируулагдаагүй байна (.env файлыг шалгана уу)');
}

module.exports = {
  env,
  isProduction: env === 'production',
  port: Number(process.env.PORT) || 3000,
  sessionSecret: process.env.SESSION_SECRET,
  dbFile: process.env.DB_FILE || 'database/odb.db',
  // Хичээлийн жил, хүсэлтийн эцсийн хугацааг энэ цагийн бүсээр тооцно
  timeZone: process.env.TIME_ZONE || 'Asia/Ulaanbaatar',
  bcryptRounds: 10,
  sessionMaxAgeMs: 30 * 60 * 1000, // 30 минут идэвхгүй бол гаргана (идэвхтэй үед сунгагдана)
  loginRateLimit: { windowMs: 15 * 60 * 1000, limit: 5 },
  registerRateLimit: { windowMs: 60 * 60 * 1000, limit: 10 },
};
