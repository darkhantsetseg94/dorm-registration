const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const defaultConfig = require('./config');
const { createAuthRoutes } = require('./routes/authRoutes');
const { createApplicationRoutes } = require('./routes/applicationRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

/**
 * Express app үүсгэнэ. db-г гаднаас дамжуулдаг тул тест бүр
 * өөрийн in-memory өгөгдлийн сантай тусдаа app ашиглана.
 */
function createApp({ db, config = defaultConfig }) {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet()); // CSP, X-Frame-Options, X-Content-Type-Options гэх мэт header
  app.use(express.json({ limit: '10kb' }));

  app.use(
    session({
      name: 'odb.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true, // JavaScript-ээс cookie уншихыг хориглоно (XSS)
        sameSite: 'strict', // CSRF-ээс хамгаална
        secure: config.isProduction, // production-д зөвхөн HTTPS
        maxAge: config.sessionMaxAgeMs,
      },
    })
  );

  app.use('/api/auth', createAuthRoutes(db, config));
  app.use('/api', createApplicationRoutes(db));
  app.use('/api', notFound);

  app.use(express.static(path.join(__dirname, 'public'), { index: 'login.html' }));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
