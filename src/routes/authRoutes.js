const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { checkLoginInput, validateRegistration } = require('../validators/authValidator');
const { requireAuth, homePath } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { invalid } = require('../errors');

// Хэрэглэгч олдоогүй үед ч bcrypt харьцуулалт хийж, хариу өгөх хугацаагаар
// хэрэглэгч байгаа эсэхийг тааж мэдэхээс сэргийлнэ (user enumeration).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);
const LOGIN_FAILED = 'Нэвтрэх нэр эсвэл нууц үг буруу байна';

/** Session fixation-аас сэргийлж шинэ session ID үүсгээд хэрэглэгчийг нэвтрүүлнэ */
function signIn(req, sessionUser) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = sessionUser;
      return resolve();
    });
  });
}

function createAuthRouter(services, { loginRateLimit, registerRateLimit }) {
  const router = express.Router();
  const { users } = services;

  // Brute-force халдлагаас хамгаалах: 15 минутад 5 удаа буруу оролдлого
  const loginLimiter = rateLimit({
    windowMs: loginRateLimit.windowMs,
    limit: loginRateLimit.limit,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Хэт олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу' },
  });

  // Олон бүртгэл автоматаар үүсгэхээс сэргийлнэ
  const registerLimiter = rateLimit({
    windowMs: registerRateLimit.windowMs,
    limit: registerRateLimit.limit,
    skipFailedRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Хэт олон бүртгэл үүсгэлээ. Дараа дахин оролдоно уу' },
  });

  router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
    const input = checkLoginInput(req.body);
    if (input.problem === 'empty') {
      return res.status(400).json({ error: 'Нэвтрэх нэр болон нууц үгээ оруулна уу' });
    }
    if (input.problem === 'invalid') {
      return res.status(401).json({ error: LOGIN_FAILED });
    }

    const user = users.findForLogin(input.username); // parameterized query
    const ok = await bcrypt.compare(input.password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      return res.status(401).json({ error: LOGIN_FAILED });
    }
    // Нууц үг зөв үед л идэвхгүй гэдгийг хэлнэ (enumeration биш)
    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'Таны бүртгэл идэвхгүй болсон байна. Дотуур байрны ажилтанд хандана уу' });
    }

    const sessionUser = users.toSessionUser(user);
    await signIn(req, sessionUser);
    users.recordLogin(user.user_id);
    return res.json({ message: 'Амжилттай нэвтэрлээ', user: sessionUser, redirect: homePath(sessionUser) });
  }));

  // Оюутан өөрөө бүртгүүлэх
  router.post('/register', registerLimiter, asyncHandler(async (req, res) => {
    const { errors, data } = validateRegistration(req.body);
    if (errors) throw invalid(errors);
    const row = await users.register(data);
    const sessionUser = users.toSessionUser(row);
    await signIn(req, sessionUser);
    users.recordLogin(row.user_id);
    res.status(201).json({ message: 'Бүртгэл амжилттай үүслээ', user: sessionUser, redirect: homePath(sessionUser) });
  }));

  router.post('/logout', (req, res, next) => {
    req.session.destroy((err) => {
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

module.exports = { createAuthRouter };
