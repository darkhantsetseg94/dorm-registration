const request = require('supertest');
const { createTestApp, loginAs, PASSWORD } = require('./helpers');

describe('Нэвтрэлт ба security', () => {
  let app;
  let db;

  beforeEach(() => {
    ({ app, db } = createTestApp());
  });

  test('TC01: зөв хэрэглэгч нэвтэрч, HttpOnly cookie авна', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'B221910001', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Амжилттай нэвтэрлээ');
    expect(res.body.user).toMatchObject({ username: 'B221910001', role: 'student' });
    expect(res.body.user).not.toHaveProperty('password_hash');

    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/odb\.sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  test('TC05: хоосон login талбарт 400 validation error', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('username');
    expect(res.body.details).toHaveProperty('password');
  });

  test('TC07: буруу нууц үг болон байхгүй хэрэглэгчид ижил ерөнхий мессеж', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ username: 'B221910001', password: 'wrong-password' });
    const noUser = await request(app)
      .post('/api/auth/login')
      .send({ username: 'B999999999', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPassword.body.error).toBe(noUser.body.error);
  });

  test.each([
    ["' OR '1'='1", "' OR '1'='1"],
    ["admin'--", 'anything'],
    ['B221910001', "' OR 1=1 --"],
  ])('TC10: SQL injection оролдлого (%s) нэвтрүүлэхгүй', async (username, password) => {
    const res = await request(app).post('/api/auth/login').send({ username, password });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('TC13: нууц үг plaintext биш, хэрэглэгч бүр тусдаа salt-тай bcrypt hash', () => {
    const rows = db.prepare('SELECT password_hash FROM users').all();
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      expect(row.password_hash).toMatch(/^\$2[aby]\$/);
      expect(row.password_hash).not.toContain(PASSWORD);
    });
    const unique = new Set(rows.map((r) => r.password_hash));
    expect(unique.size).toBe(rows.length);
  });

  test('TC15: алдаатай JSON-д 400, stack trace харуулахгүй', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": "B221910001", ');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Хүсэлтийн формат буруу байна');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js|SyntaxError|stack/i);
  });

  test('TC16: 5 буруу оролдлогын дараа 429 (brute-force хамгаалалт)', async () => {
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'B221910001', password: `wrong-${i}` });
      expect(res.status).toBe(401);
    }
    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ username: 'B221910001', password: PASSWORD });
    expect(blocked.status).toBe(429);
  });

  test('Нэвтэрсний дараа /api/auth/me хэрэглэгчийг буцаана, гарсны дараа 401', async () => {
    const agent = await loginAs(app, 'B221910001');
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('B221910001');

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const after = await agent.get('/api/auth/me');
    expect(after.status).toBe(401);
  });

  test('Session fixation: нэвтрэх бүрд шинэ session ID олгоно', async () => {
    const agent = request.agent(app);
    const first = await agent.post('/api/auth/login').send({ username: 'B221910001', password: PASSWORD });
    const second = await agent.post('/api/auth/login').send({ username: 'B221910001', password: PASSWORD });
    const sid = (res) => res.headers['set-cookie'][0].split(';')[0];
    expect(sid(first)).not.toBe(sid(second));
  });

  test('helmet хамгаалалтын header-үүд тохируулагдсан', async () => {
    const res = await request(app).get('/login.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
