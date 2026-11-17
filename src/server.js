const config = require('./config');
const { createDatabase } = require('./db/database');
const { createApp } = require('./app');

const db = createDatabase(config.dbFile);
const app = createApp(db);

app.listen(config.port, () => {
  console.log(`ОДБ сервер ажиллаж байна: http://localhost:${config.port}`);
});
