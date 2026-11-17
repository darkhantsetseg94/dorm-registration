const path = require('path');
const { AppError } = require('../errors');

const NOT_FOUND_PAGE = path.join(__dirname, '..', 'public', '404.html');

/**
 * Төвлөрсөн алдаа боловсруулагч.
 * Хэрэглэгчид stack trace, SQL алдаа зэрэг дотоод мэдээлэл харуулахгүй.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }

  // express.json() буруу JSON эсвэл хэт том body ирэхэд
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Хүсэлтийн формат буруу байна' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Илгээсэн өгөгдөл хэт том байна' });
  }

  // Урьдчилан тооцоогүй алдаа — зөвхөн серверийн log-д бүрэн бичнэ
  console.error('[ERROR]', err);
  return res.status(500).json({ error: 'Серверт алдаа гарлаа. Дахин оролдоно уу' });
}

/** API-д JSON, хөтчийн хуудсанд 404.html буцаана */
function notFoundHandler(req, res) {
  const wantsPage = req.method === 'GET' && !req.path.startsWith('/api/') && req.accepts(['json', 'html']) === 'html';
  if (wantsPage) return res.status(404).sendFile(NOT_FOUND_PAGE);
  return res.status(404).json({ error: 'Хуудас олдсонгүй' });
}

module.exports = { errorHandler, notFoundHandler };
