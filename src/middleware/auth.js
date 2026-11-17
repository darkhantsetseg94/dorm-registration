/**
 * Session дэх хэрэглэгчийг өгөгдлийн сангаас шинэчилнэ.
 * Ажилтан хэрэглэгчийг идэвхгүй болгосон эсвэл устгасан бол
 * тухайн хэрэглэгч дараагийн хүсэлтээс эхлэн нэвтрээгүй тооцогдоно.
 */
function loadCurrentUser(userService) {
  return (req, res, next) => {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser) return next();
    const row = userService.findById(sessionUser.id);
    if (!row || row.is_active !== 1) {
      delete req.session.user;
      return next();
    }
    req.session.user = userService.toSessionUser(row);
    return next();
  };
}

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
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Хандах эрхгүй (Access denied)' });
    }
    return next();
  };
}

/** Эрхээс хамаарч нүүр хуудас */
function homePath(user) {
  if (!user) return '/login.html';
  return user.role === 'staff' ? '/admin/' : '/dashboard.html';
}

const STUDENT_PAGES = ['/dashboard.html', '/apply.html'];
const SIGNED_IN_PAGES = ['/profile.html'];
const GUEST_PAGES = ['/login.html', '/register.html'];

/**
 * HTML хуудасны хамгаалалт: нэвтрээгүй бол login руу, эрхгүй бол өөрийн
 * нүүр хуудас руу шилжүүлнэ. Өгөгдөл API-аар ирдэг тул энэ нь зөвхөн UX.
 */
function pageGuard(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const { path } = req;
  const user = req.session && req.session.user;

  if (GUEST_PAGES.includes(path)) return user ? res.redirect(homePath(user)) : next();

  const staffPage = path === '/admin' || path.startsWith('/admin/');
  const studentPage = STUDENT_PAGES.includes(path);
  if (!staffPage && !studentPage && !SIGNED_IN_PAGES.includes(path)) return next();

  if (!user) return res.redirect(`/login.html?next=${encodeURIComponent(req.originalUrl)}`);
  if (staffPage && user.role !== 'staff') return res.redirect(homePath(user));
  if (studentPage && user.role !== 'student') return res.redirect(homePath(user));
  return next();
}

module.exports = { loadCurrentUser, requireAuth, requireRole, pageGuard, homePath };
