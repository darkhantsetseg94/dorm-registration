const request = require('supertest');
const { buildTestApp, loginAs, VALID_FORM } = require('./helpers');

describe('US-01: Дотуур байранд суух хүсэлт илгээх', () => {
  let app;
  let db;

  beforeEach(() => {
    ({ app, db } = buildTestApp());
  });

  test('TC02: Зөв өгөгдлөөр хүсэлт илгээхэд "Хүлээгдэж буй" төлөвтэй бүртгэгдэнэ', async () => {
    const bat = await loginAs(app, 'bat');
    const res = await bat.post('/api/applications').send(VALID_FORM);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Хүсэлт амжилттай илгээгдлээ');
    expect(res.body.application).toMatchObject({
      dormName: '1-р байр',
      status: 'PENDING',
      statusLabel: 'Хүлээгдэж буй',
    });

    const my = await bat.get('/api/applications/my');
    expect(my.body.applications).toHaveLength(1);
  });

  test('TC03: Хүсэлт илгээгээгүй оюутанд "Илгээсэн хүсэлт байхгүй байна" гэж харуулна', async () => {
    const saraa = await loginAs(app, 'saraa');
    const res = await saraa.get('/api/applications/my');

    expect(res.status).toBe(200);
    expect(res.body.applications).toEqual([]);
    expect(res.body.message).toBe('Илгээсэн хүсэлт байхгүй байна');
  });

  test('TC04: Оюутан өөр оюутны хүсэлтийг харах гэвэл Access denied (403)', async () => {
    const bat = await loginAs(app, 'bat');
    const created = await bat.post('/api/applications').send(VALID_FORM);
    const batAppId = created.body.application.id;

    const saraa = await loginAs(app, 'saraa');
    const res = await saraa.get(`/api/applications/${batAppId}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Хандах эрхгүй (Access denied)');
    expect(res.body.application).toBeUndefined();

    // Эзэмшигч өөрөө харж чадна
    expect((await bat.get(`/api/applications/${batAppId}`)).status).toBe(200);
  });

  test('TC05: Хоосон form илгээхэд талбар бүрийн validation алдаа өгнө', async () => {
    const bat = await loginAs(app, 'bat');
    const res = await bat.post('/api/applications').send({});

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details).sort()).toEqual(
      ['dormId', 'emergencyName', 'emergencyPhone', 'phone', 'reason'].sort()
    );
    expect(db.prepare('SELECT COUNT(*) AS n FROM applications').get().n).toBe(0);
  });

  test.each([
    ['утас 5 оронтой', { phone: '99112' }, 'phone'],
    ['утсанд үсэг орсон', { phone: '9911abcd' }, 'phone'],
    ['байхгүй байр', { dormId: 999 }, 'dormId'],
    ['байрны ID тоо биш', { dormId: 'abc' }, 'dormId'],
    ['байрны ID boolean төрөл', { dormId: true }, 'dormId'],
    ['байрны ID массив', { dormId: [1] }, 'dormId'],
    ['утас тоон төрөл', { phone: 99112233 }, 'phone'],
    ['нэрэнд тоо орсон', { emergencyName: 'Bat123' }, 'emergencyName'],
    ['ижил утасны дугаар', { emergencyPhone: '99112233' }, 'emergencyPhone'],
    ['шалтгаан хэт богино', { reason: 'Байр' }, 'reason'],
    ['шалтгаан 500-аас урт', { reason: 'а'.repeat(501) }, 'reason'],
  ])('TC06: Буруу input (%s) хүсэлтийг татгалзана', async (_label, override, field) => {
    const bat = await loginAs(app, 'bat');
    const res = await bat.post('/api/applications').send({ ...VALID_FORM, ...override });

    expect(res.status).toBe(400);
    expect(res.body.details[field]).toBeDefined();
    expect(db.prepare('SELECT COUNT(*) AS n FROM applications').get().n).toBe(0);
  });

  test('TC08: Нэвтрээгүй хэрэглэгч хүсэлт илгээх боломжгүй (401)', async () => {
    const res = await request(app).post('/api/applications').send(VALID_FORM);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Системд нэвтэрнэ үү');
  });

  test('TC09: Нэг хичээлийн жилд давхар хүсэлт илгээхэд 409 буцаана', async () => {
    const bat = await loginAs(app, 'bat');
    expect((await bat.post('/api/applications').send(VALID_FORM)).status).toBe(201);

    const second = await bat.post('/api/applications').send({ ...VALID_FORM, dormId: 3 });
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/хичээлийн жилд хүсэлт илгээсэн байна/);
  });

  test('TC10: URL параметрээр SQL Injection оролдлого хийхэд татгалзана', async () => {
    const bat = await loginAs(app, 'bat');
    const res = await bat.get(`/api/applications/${encodeURIComponent('1 OR 1=1')}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Хүсэлтийн дугаар буруу байна');
  });

  test('TC11: Шалтгаан талбарт <script> (XSS) оруулахад татгалзана', async () => {
    const bat = await loginAs(app, 'bat');
    const payloads = ['<script>alert("xss")</script> байр хэрэгтэй', 'Сайн байна уу <img src=x onerror=alert(1)>', 'javascript:alert(document.cookie)'];
    for (const reason of payloads) {
      // eslint-disable-next-line no-await-in-loop
      const res = await bat.post('/api/applications').send({ ...VALID_FORM, reason });
      expect(res.status).toBe(400);
      expect(res.body.details.reason).toBe('HTML код болон тусгай тэмдэгт оруулах боломжгүй');
    }
  });

  test('TC12: Body-д өөр studentId, status дамжуулсан ч өөрийн ID-аар "PENDING" хадгална', async () => {
    const bat = await loginAs(app, 'bat');
    const saraaId = db.prepare("SELECT user_id FROM users WHERE username = 'B221910002'").get().user_id;

    const res = await bat
      .post('/api/applications')
      .send({ ...VALID_FORM, studentId: saraaId, student_id: saraaId, status: 'APPROVED' });

    expect(res.status).toBe(201);
    const row = db.prepare('SELECT student_id, status FROM applications WHERE application_id = ?').get(res.body.application.id);
    expect(row.student_id).not.toBe(saraaId);
    expect(row.status).toBe('PENDING');
  });

  test('TC14: Ажилтны эрхтэй хэрэглэгч оюутны хүсэлт илгээх боломжгүй (403)', async () => {
    const staff = await loginAs(app, 'staff');
    const res = await staff.post('/api/applications').send(VALID_FORM);
    expect(res.status).toBe(403);
  });

  test('TC17: Хүйсэнд тохирохгүй байр сонгоход татгалзана', async () => {
    const bat = await loginAs(app, 'bat'); // эрэгтэй оюутан
    const res = await bat.post('/api/applications').send({ ...VALID_FORM, dormId: 2 }); // эмэгтэй байр
    expect(res.status).toBe(400);
    expect(res.body.details.dormId).toBe('Энэ байр таны хүйсэнд тохирохгүй байна');

    const dorms = await bat.get('/api/dormitories');
    expect(dorms.body.dormitories.map((d) => d.name)).toEqual(['1-р байр', '3-р байр']);
  });

  test('Ажилтан бүх хүсэлтийг дэлгэрэнгүй харах эрхтэй', async () => {
    const bat = await loginAs(app, 'bat');
    const created = await bat.post('/api/applications').send(VALID_FORM);
    const staff = await loginAs(app, 'staff');
    const res = await staff.get(`/api/applications/${created.body.application.id}`);
    expect(res.status).toBe(200);
  });
});
