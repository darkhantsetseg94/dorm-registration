/**
 * Хэрэглэгчид харуулах боломжтой алдаа. status нь HTTP код,
 * details нь талбар тус бүрийн алдааны мессеж (заавал биш).
 */
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

module.exports = { AppError };
