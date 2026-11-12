const config = require('./config');
const { createDatabase } = require('./db/database');
const { createApp } = require('./app');

const db = createDatabase(config.dbFile);
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0) {
  console.warn('Анхааруулга: өгөгдлийн сан хоосон байна. Эхлээд "npm run seed" ажиллуулна уу.');
}

const app = createApp({ db, config });
app.listen(config.port, () => {
  console.log(`ОДБ систем ажиллаж байна: http://localhost:${config.port}`);
});
