const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { validateLogin } = require('../validators/authValidator');
const { requireAuth } = require('../middleware/auth');
const { AppError } = require('../errors');

const INVALID_LOGIN = 'Нэвтрэх нэр эсвэл нууц үг буруу байна';

// Хэрэглэгч олдоогүй үед ч bcrypt ажиллуулж хариу өгөх хугацааг ижил байлгана
// (хэрэглэгч байгаа эсэхийг хугацаагаар таах боломжгүй болгоно).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 4);

function createAuthRoutes(db, config) {
  const router = express.Router();
  const findUser = db.prepare(
    'SELECT user_id, username, full_name, password_hash, gender, role FROM users WHERE username = ?'
  );

  // Brute-force хамгаалалт: 15 минутад 5 амжилтгүй оролдлого
  const loginLimiter = rateLimit({
    windowMs: config.login.windowMs,
    limit: config.login.maxFailedAttempts,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Хэт олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу.' },
  });

  router.post('/login', loginLimiter, (req, res, next) => {
    const { errors, invalidCredentials, data } = validateLogin(req.body);
    if (errors) throw new AppError(400, 'Нэвтрэх мэдээллээ бүрэн оруулна уу', errors);
    if (invalidCredentials) throw new AppError(401, INVALID_LOGIN);

    const user = findUser.get(data.username);
    const passwordOk = bcrypt.compareSync(data.password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !passwordOk) throw new AppError(401, INVALID_LOGIN);

    // Session fixation-аас хамгаалж нэвтрэх бүрд session ID шинэчилнэ
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = {
        id: user.user_id,
        username: user.username,
        fullName: user.full_name,
        gender: user.gender,
        role: user.role,
      };
      return res.json({ message: 'Амжилттай нэвтэрлээ', user: req.session.user });
    });
  });

  router.post('/logout', (req, res, next) => {
    if (!req.session) return res.json({ message: 'Системээс гарлаа' });
    return req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('odb.sid');
      return res.json({ message: 'Системээс гарлаа' });
    });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.session.user });
  });

  return router;
}

module.exports = { createAuthRoutes };
