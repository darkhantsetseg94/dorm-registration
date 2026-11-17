/**
 * Express 4 async функцийн алдааг өөрөө барьдаггүй тул
 * Promise-ийн алдааг next() руу дамжуулна.
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { asyncHandler };
