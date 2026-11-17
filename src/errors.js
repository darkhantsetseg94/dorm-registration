/**
 * Хэрэглэгчид харуулж болох, урьдчилан тооцсон алдаа.
 * status — HTTP код, details — талбар тус бүрийн алдааны мессеж.
 */
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (message, details) => new AppError(400, message, details);
const forbidden = (message = 'Хандах эрхгүй (Access denied)') => new AppError(403, message);
const notFound = (message = 'Олдсонгүй') => new AppError(404, message);
const conflict = (message, details) => new AppError(409, message, details);

/** Form-ын талбарын алдаа: { field: message } */
const invalid = (details, message = 'Form-ын мэдээлэл буруу байна') => new AppError(400, message, details);

module.exports = { AppError, badRequest, forbidden, notFound, conflict, invalid };
