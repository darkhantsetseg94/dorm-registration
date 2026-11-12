const request = require('supertest');
const { createTestApp, loginAs, VALID_APPLICATION } = require('./helpers');

describe('US-01: Дотуур байранд суух хүсэлт илгээх', () => {
  let app;
  let db;

  beforeEach(() => {
    ({ app, db } = createTestApp());
  });

  test('TC02: зөв өгөгдлөөр илгээхэд "Хүлээгдэж буй" төлөвтэй хадгалагдана', async () => {
    const agent = await loginAs(app, 'B221910001');
    const res = await agent.post('/api/applications').send(VALID_APPLICATION);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Хүсэлт амжилттай илгээгдлээ');
    expect(res.body.application).toMatchObject({
      phone: VALID_APPLICATION.phone,
      status: 'PENDING',
      statusLabel: 'Хүлээгдэж буй',
    });
    expect(res.body.application.academicYear).toMatch(/^\d{4}-\d{4}$/);

    const my = await agent.get('/api/applications/my');
    expect(my.status).toBe(200);
    expect(my.body.applications).toHaveLength(1);
    expect(my.body.applications[0].status).toBe('PENDING');
  });

  test('TC03: хүсэлт илгээгээгүй оюутанд "Илгээсэн хүсэлт байхгүй байна"', async () => {
    const agent = await loginAs(app, 'B221910002');
    const res = await agent.get('/api/applications/my');

    expect(res.status).toBe(200);
    expect(res.body.applications).toEqual([]);
    expect(res.body.message).toBe('Илгээсэн хүсэлт байхгүй байна');
  });

  test('TC04: өөр оюутны хүсэлтэд хандахад 403 Access denied', async () => {
    const studentA = await loginAs(app, 'B221910001');
    const created = await studentA.post('/api/applications').send(VALID_APPLICATION);
    const { id } = created.body.application;

    const studentB = await loginAs(app, 'B221910002');
    const res = await studentB.get(`/api/applications/${id}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Хандах эрхгүй (Access denied)');
    expect(res.body).not.toHaveProperty('application');

    const own = await studentA.get(`/api/applications/${id}`);
    expect(own.status).toBe(200);
  });

  test('TC05: хоосон form-д 4 талбарын алдаа', async () => {
    const agent = await loginAs(app, 'B221910001');
    const res = await agent.post('/api/applications').send({});

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details).sort()).toEqual(
      ['emergencyName', 'emergencyPhone', 'phone', 'reason']
    );
  });

  test.each([
    ['утас 5 оронтой', 'phone', { phone: '99112' }],
    ['утсанд үсэг', 'phone', { phone: '9911abcd' }],
    ['утас 9 оронтой', 'phone', { phone: '991122334' }],
    ['утас массив', 'phone', { phone: ['99112233'] }],
    ['нэрэнд HTML', 'emergencyName', { emergencyName: 'Болд<b>' }],
    ['шалтгаан зөвхөн хоосон зай', 'reason', { reason: '            ' }],
    ['нэрэнд тоо', 'emergencyName', { emergencyName: 'Bat123' }],
    ['өөрийн утастай ижил', 'emergencyPhone', { emergencyPhone: '99112233' }],
    ['шалтгаан богино', 'reason', { reason: 'богино' }],
    ['шалтгаан 501 тэмдэгт', 'reason', { reason: 'а'.repeat(501) }],
    ['яаралтай утас 2 оронтой', 'emergencyPhone', { emergencyPhone: '12' }],
  ])('TC06: буруу input татгалзана — %s', async (label, field, override) => {
    const agent = await loginAs(app, 'B221910001');
    const res = await agent.post('/api/applications').send({ ...VALID_APPLICATION, ...override });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty(field);
    const count = db.prepare('SELECT COUNT(*) AS n FROM applications').get().n;
    expect(count).toBe(0);
  });

  test('TC08: нэвтрээгүй хэрэглэгч хүсэлт илгээхэд 401', async () => {
    const res = await request(app).post('/api/applications').send(VALID_APPLICATION);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Системд нэвтэрнэ үү');
  });

  test('TC09: нэг хичээлийн жилд давхар хүсэлт илгээхэд 409', async () => {
    const agent = await loginAs(app, 'B221910001');
    const first = await agent.post('/api/applications').send(VALID_APPLICATION);
    expect(first.status).toBe(201);

    const second = await agent.post('/api/applications').send({ ...VALID_APPLICATION, phone: '95556677' });
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/хүсэлт илгээсэн байна/);
  });

  test('TC10: ID параметрт SQL injection оролдлого 400', async () => {
    const agent = await loginAs(app, 'B221910001');
    const res = await agent.get(`/api/applications/${encodeURIComponent('1 OR 1=1')}`);
    expect(res.status).toBe(400);
  });

  test.each([
    '<script>alert(1)</script> байранд суумаар байна',
    '<img src=x onerror=alert(1)> байранд суумаар байна',
    'javascript:alert(1) байранд суумаар байна',
  ])('TC11: XSS оролдлого татгалзана (%s)', async (reason) => {
    const agent = await loginAs(app, 'B221910001');
    const res = await agent.post('/api/applications').send({ ...VALID_APPLICATION, reason });
    expect(res.status).toBe(400);
    expect(res.body.details.reason).toBe('HTML код болон тусгай тэмдэгт оруулах боломжгүй');
  });

  test('TC12: body дахь хуурамч studentId, status-ийг үл тооно', async () => {
    const agent = await loginAs(app, 'B221910001');
    const res = await agent
      .post('/api/applications')
      .send({ ...VALID_APPLICATION, studentId: 2, status: 'APPROVED' });

    expect(res.status).toBe(201);
    const row = db.prepare('SELECT student_id, status FROM applications').get();
    const studentA = db.prepare("SELECT user_id FROM users WHERE username = 'B221910001'").get();
    expect(row.student_id).toBe(studentA.user_id);
    expect(row.status).toBe('PENDING');
  });

  test('TC14: ажилтан хүсэлт илгээхэд 403', async () => {
    const staff = await loginAs(app, 'staff01');
    const res = await staff.post('/api/applications').send(VALID_APPLICATION);
    expect(res.status).toBe(403);
  });

  test('TC17: нэг байртай тул body дахь dormId-г үл тооно (хуучин клиент)', async () => {
    const agent = await loginAs(app, 'B221910001');
    const res = await agent.post('/api/applications').send({ ...VALID_APPLICATION, dormId: 2 });
    expect(res.status).toBe(201);
    expect(res.body.application).not.toHaveProperty('dormId');
  });

  test('Байр сонгох /api/dormitories endpoint байхгүй (404)', async () => {
    const agent = await loginAs(app, 'B221910001');
    const res = await agent.get('/api/dormitories');
    expect(res.status).toBe(404);
  });
});
