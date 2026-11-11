/**
 * Authentication: хэрэглэгч нэвтэрсэн эсэхийг шалгана.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Системд нэвтэрнэ үү' });
  }
  return next();
}

/**
 * Authorization: хэрэглэгчийн эрх (role) зөвшөөрөгдсөн эсэхийг шалгана.
 * @param  {...string} roles  зөвшөөрөгдөх эрхүүд, жишээ нь 'student'
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Системд нэвтэрнэ үү' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Хандах эрхгүй (Access denied)' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
