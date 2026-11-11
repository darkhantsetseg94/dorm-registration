const request = require('supertest');
const { createDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');
const { seedDemo } = require('../database/seed');
const config = require('../src/config');

const PASSWORD = 'TestPass2026!';

const VALID_APPLICATION = {
  dormId: 1, // 1-р байр (эрэгтэй)
  phone: '99112233',
  emergencyName: 'Болд',
  emergencyPhone: '88112233',
  reason: 'Хөдөө орон нутгаас ирсэн тул байранд суух шаардлагатай',
};

/**
 * Тест бүрд шинэ in-memory өгөгдлийн сан, шинэ app (rate limiter, session тусдаа).
 */
function createTestApp() {
  const db = createDatabase(':memory:');
  seedDemo(db, PASSWORD, config.bcryptRounds);
  const app = createApp({ db, config });
  return { app, db };
}

/**
 * Нэвтэрсэн supertest agent буцаана (cookie хадгална).
 */
async function loginAs(app, username, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`Login failed for ${username}: ${res.status}`);
  return agent;
}

module.exports = { createTestApp, loginAs, PASSWORD, VALID_APPLICATION };
