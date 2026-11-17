const request = require('supertest');
const { buildTestApp, USERS, PASSWORD } = require('./helpers');

describe('Нэвтрэх (Authentication)', () => {
  let app;
  let db;

  beforeEach(() => {
    ({ app, db } = buildTestApp());
  });

  test('TC01: Зөв хэрэглэгч нэвтрэхэд амжилттай болж, хамгаалагдсан cookie өгнө', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: USERS.bat.username, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Амжилттай нэвтэрлээ');
    expect(res.body.user).toMatchObject({ username: 'B221910001', role: 'student' });
    expect(res.body.user.password_hash).toBeUndefined();

    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  test('TC07: Буруу нууц үг болон байхгүй хэрэглэгчид ижил ерөнхий мессеж өгнө', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ username: USERS.bat.username, password: 'Wrong@123' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ username: 'B999999999', password: 'Wrong@123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error).toBe('Нэвтрэх нэр эсвэл нууц үг буруу байна');
    expect(unknownUser.body.error).toBe(wrongPassword.body.error);
  });

  test('TC05: Хоосон нэвтрэх нэр, нууц үгээр нэвтрэхэд validation алдаа өгнө', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: '  ', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Нэвтрэх нэр болон нууц үгээ оруулна уу');
  });

  test("TC10: SQL Injection оролдлого (' OR '1'='1) нэвтрэлт өгөхгүй", async () => {
    const payloads = ["' OR '1'='1", "admin'--", 'B221910001" OR 1=1 --'];
    for (const username of payloads) {
      const res = await request(app).post('/api/auth/login').send({ username, password: "' OR '1'='1" });
      expect(res.status).toBe(401);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  test('TC13: Нууц үг өгөгдлийн санд plaintext биш, bcrypt hash хэлбэрээр хадгалагдсан', () => {
    const rows = db.prepare('SELECT password_hash FROM users').all();
    rows.forEach(({ password_hash: hash }) => {
      expect(hash).not.toBe(PASSWORD);
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    });
  });

  test('TC15: Алдаатай JSON илгээхэд 400 буцааж, stack trace харуулахгүй', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": "B221910001", "password": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Хүсэлтийн формат буруу байна' });
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js|SyntaxError|node_modules/);
  });

  test('TC16: 5 удаа буруу оролдсоны дараа нэвтрэлтийг түр хаана (brute-force)', async () => {
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post('/api/auth/login').send({ username: USERS.bat.username, password: `bad${i}` });
      expect(res.status).toBe(401);
    }
    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ username: USERS.bat.username, password: PASSWORD });
    expect(blocked.status).toBe(429);
  });

  test('Системээс гарсны дараа хамгаалагдсан API руу хандах боломжгүй', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: USERS.bat.username, password: PASSWORD });
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  test('Аюулгүй байдлын HTTP header-ууд (helmet) тохируулагдсан', async () => {
    const res = await request(app).get('/login.html');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
