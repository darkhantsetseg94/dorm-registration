const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const config = require('./config');
const constants = require('./constants');
const { createServices } = require('./services');
const { SqliteSessionStore } = require('./db/sessionStore');
const { createAuthRouter } = require('./routes/authRoutes');
const { createApplicationRouter } = require('./routes/applicationRoutes');
const { createAccountRouter } = require('./routes/accountRoutes');
const { createAdminRouter } = require('./routes/adminRoutes');
const {
  loadCurrentUser, requireAuth, pageGuard, homePath,
} = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

/**
 * Express app үүсгэнэ. db-г гаднаас дамжуулдаг тул тестэд
 * ':memory:' өгөгдлийн сан ашиглах боломжтой.
 */
function createApp(db, options = {}) {
  const loginRateLimit = options.loginRateLimit || config.loginRateLimit;
  const registerRateLimit = options.registerRateLimit || config.registerRateLimit;
  const services = createServices(db);
  const sessionStore = new SqliteSessionStore(db, { defaultTtlMs: config.sessionMaxAgeMs });
  const app = express();

  app.disable('x-powered-by');
  // CSP, X-Frame-Options, X-Content-Type-Options гэх мэт header.
  // HTTPS-гүй орчинд (localhost, дотоод сүлжээ) upgrade-insecure-requests нь
  // CSS/JS ачаалахыг эвддэг тул зөвхөн production-д асаана.
  app.use(helmet({
    contentSecurityPolicy: {
      directives: { upgradeInsecureRequests: config.isProduction ? [] : null },
    },
    strictTransportSecurity: config.isProduction,
  }));
  app.use(express.json({ limit: '10kb' }));

  // CSS, JS, фонт, зургийг session-гүйгээр өгнө (файл бүрт өгөгдлийн сан руу хандахгүй)
  const publicDir = path.join(__dirname, 'public');
  ['css', 'js', 'fonts', 'img'].forEach((dir) => {
    app.use(`/${dir}`, express.static(path.join(publicDir, dir), { maxAge: config.isProduction ? '1d' : 0 }));
  });

  app.use(
    session({
      name: 'odb.sid',
      secret: config.sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      rolling: true, // идэвхтэй хэрэглэгчийн хугацааг сунгана
      cookie: {
        httpOnly: true, // JavaScript-ээс cookie уншихыг хориглоно (XSS)
        sameSite: 'strict', // CSRF-ээс хамгаална
        secure: config.isProduction, // production-д зөвхөн HTTPS
        maxAge: config.sessionMaxAgeMs,
      },
    })
  );
  app.use(loadCurrentUser(services.users));

  // ---------- API ----------
  app.use('/api/auth', createAuthRouter(services, { loginRateLimit, registerRateLimit }));

  // Нэвтрэхээс өмнө хэрэгтэй жагсаалт, тохиргоо (нууц мэдээлэлгүй)
  app.get('/api/meta', (req, res) => {
    res.json({
      statuses: constants.STATUS_LABELS,
      events: constants.EVENT_LABELS,
      genders: constants.GENDER_LABELS,
      dormGenders: constants.DORM_GENDER_LABELS,
      roles: constants.ROLE_LABELS,
      audiences: constants.AUDIENCE_LABELS,
      provinces: constants.PROVINCES,
      priorityTags: constants.PRIORITY_TAGS,
      relations: constants.RELATIONS,
      courses: constants.COURSE_LABELS,
      registrationOpen: services.settings.get().registrationOpen,
      window: services.settings.applicationWindow(),
      // Хөгжүүлэлтийн орчинд нэвтрэх хуудсанд туршилтын бүртгэлийг санал болгоно
      demoAccounts: config.isProduction ? [] : [
        { username: 'B221910001', label: 'Оюутан (эрэгтэй)' },
        { username: 'B221910002', label: 'Оюутан (эмэгтэй)' },
        { username: 'staff01', label: 'Ажилтан' },
      ],
    });
  });

  // Доорх бүх endpoint нэвтэрсэн хэрэглэгч шаардана
  app.use('/api', requireAuth);
  app.use('/api', createApplicationRouter(services));
  app.use('/api', createAccountRouter(services, { sessionStore }));
  app.use('/api/admin', createAdminRouter(services, { sessionStore }));

  // ---------- Хуудсууд ----------
  app.get('/', (req, res) => res.redirect(homePath(req.session.user)));
  app.use(pageGuard);
  app.use(express.static(publicDir, { index: 'index.html' }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.locals.services = services;
  app.locals.sessionStore = sessionStore;
  return app;
}

module.exports = { createApp };
