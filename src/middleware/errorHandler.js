const { AppError } = require('../errors');

/**
 * Төвлөрсөн алдаа боловсруулалт. Stack trace, SQL алдааг зөвхөн log-д бичиж,
 * хэрэглэгчид ерөнхий мессеж буцаана.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Хүсэлтийн формат буруу байна' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Хүсэлтийн хэмжээ хэт их байна' });
  }

  if (process.env.NODE_ENV !== 'test') console.error(err);
  return res.status(500).json({ error: 'Серверт алдаа гарлаа. Дахин оролдоно уу.' });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Хуудас олдсонгүй' });
}

module.exports = { errorHandler, notFound };
