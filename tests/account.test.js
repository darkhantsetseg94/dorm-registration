const request = require('supertest');
const { buildTestApp, loginAs, PASSWORD } = require('./helpers');

const NEW_STUDENT = {
  username: 'b231910099',
  fullName: 'Тэмүүжин Баттулга',
  email: 'Temuujin@Stud.edu.mn',
  phone: '95112233',
  gender: 'male',
  password: 'Shine2026pass',
  passwordConfirm: 'Shine2026pass',
};

describe('Бүртгүүлэх, профайл, нууц үг', () => {
  let app;
  let db;

  beforeEach(() => {
    ({ app, db } = buildTestApp());
  });

  test('TC18: Оюутан өөрөө бүртгүүлээд шууд нэвтэрсэн төлөвт орно', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send(NEW_STUDENT);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: 'B231910099', role: 'student', gender: 'male' });
    expect(res.body.redirect).toBe('/dashboard.html');

    const row = db.prepare("SELECT email, role, password_hash FROM users WHERE username = 'B231910099'").get();
    expect(row.email).toBe('temuujin@stud.edu.mn'); // жижиг үсгээр хадгална
    expect(row.role).toBe('student');
    expect(row.password_hash).toMatch(/^\$2[aby]\$/);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
  });

  test('TC19: Body-д role: staff дамжуулсан ч зөвхөн оюутан үүснэ', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...NEW_STUDENT, role: 'staff' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('student');
  });

  test('TC20: Давхардсан оюутны код, имэйлээр бүртгүүлэхэд 409', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...NEW_STUDENT, username: 'b221910001', email: 'BAT@test.mn' });
    expect(res.status).toBe(409);
    expect(res.body.details.username).toBeDefined();
    expect(res.body.details.email).toBeDefined();
  });

  test.each([
    ['богино нууц үг', { password: 'abc12', passwordConfirm: 'abc12' }, 'password'],
    ['тоогүй нууц үг', { password: 'abcdefghij', passwordConfirm: 'abcdefghij' }, 'password'],
    ['нууц үг таарахгүй', { passwordConfirm: 'Other2026pass' }, 'passwordConfirm'],
    ['буруу оюутны код', { username: 'hello' }, 'username'],
    ['буруу имэйл', { email: 'not-an-email' }, 'email'],
    ['хүйс сонгоогүй', { gender: 'other' }, 'gender'],
    ['нэрэнд HTML', { fullName: '<b>Бат</b>' }, 'fullName'],
  ])('TC21: Бүртгэлийн буруу өгөгдөл (%s) татгалзана', async (_label, override, field) => {
    const res = await request(app).post('/api/auth/register').send({ ...NEW_STUDENT, ...override });
    expect(res.status).toBe(400);
    expect(res.body.details[field]).toBeDefined();
  });

  test('TC22: Ажилтан бүртгэлийг хаасан үед бүртгүүлэх боломжгүй (403)', async () => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('registration_open', '0')").run();
    const res = await request(app).post('/api/auth/register').send(NEW_STUDENT);
    expect(res.status).toBe(403);
    const meta = await request(app).get('/api/meta');
    expect(meta.body.registrationOpen).toBe(false);
  });

  test('TC23: Нэвтрэх нэр том, жижиг үсгээс үл хамааран ажиллана', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'b221910001', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('B221910001');
  });

  test('TC24: Идэвхгүй болгосон хэрэглэгч нэвтэрч чадахгүй, нэвтэрсэн session нь хүчингүй болно', async () => {
    const bat = await loginAs(app, 'bat');
    db.prepare("UPDATE users SET is_active = 0 WHERE username = 'B221910001'").run();

    expect((await bat.get('/api/applications/my')).status).toBe(401);
    const res = await request(app).post('/api/auth/login').send({ username: 'B221910001', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/идэвхгүй/);
  });

  test('TC25: Профайлын имэйл, утсыг засна; бусдын имэйлийг авах боломжгүй', async () => {
    const bat = await loginAs(app, 'bat');
    const ok = await bat.patch('/api/profile').send({ email: 'bat.new@test.mn', phone: '99001122' });
    expect(ok.status).toBe(200);
    expect(ok.body.profile).toMatchObject({ email: 'bat.new@test.mn', phone: '99001122' });

    const taken = await bat.patch('/api/profile').send({ email: 'saraa@test.mn' });
    expect(taken.status).toBe(409);
    expect(taken.body.details.email).toBeDefined();
  });

  test('TC26: Нууц үг солиход хуучин нууц үг шаардлагатай, бусад session гарна', async () => {
    const laptop = await loginAs(app, 'bat');
    const phone = await loginAs(app, 'bat');

    const wrong = await laptop.post('/api/profile/password')
      .send({ currentPassword: 'Буруу123', newPassword: 'Shine2026pass', newPasswordConfirm: 'Shine2026pass' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.details.currentPassword).toBe('Одоогийн нууц үг буруу байна');

    const ok = await laptop.post('/api/profile/password')
      .send({ currentPassword: PASSWORD, newPassword: 'Shine2026pass', newPasswordConfirm: 'Shine2026pass' });
    expect(ok.status).toBe(200);

    expect((await laptop.get('/api/auth/me')).status).toBe(200); // одоогийн төхөөрөмж үлдэнэ
    expect((await phone.get('/api/auth/me')).status).toBe(401); // бусад нь гарна

    const oldLogin = await request(app).post('/api/auth/login').send({ username: 'B221910001', password: PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/auth/login').send({ username: 'B221910001', password: 'Shine2026pass' });
    expect(newLogin.status).toBe(200);
  });

  test('TC27: Session өгөгдлийн санд хадгалагдана (сервер дахин асахад хэрэглэгч гарахгүй)', async () => {
    await loginAs(app, 'bat');
    const row = db.prepare('SELECT user_id, expires_at FROM sessions').get();
    expect(row.user_id).toBe(1);
    expect(row.expires_at).toBeGreaterThan(Date.now());
  });

  test('TC28: Хуудас хамгаалалт — нэвтрээгүй бол login руу, оюутан admin хуудас руу орж чадахгүй', async () => {
    const guest = await request(app).get('/admin/applications.html');
    expect(guest.status).toBe(302);
    expect(guest.headers.location).toBe('/login.html?next=%2Fadmin%2Fapplications.html');

    const bat = await loginAs(app, 'bat');
    const asStudent = await bat.get('/admin/');
    expect(asStudent.status).toBe(302);
    expect(asStudent.headers.location).toBe('/dashboard.html');

    const staff = await loginAs(app, 'staff');
    expect((await staff.get('/')).headers.location).toBe('/admin/');
    expect((await staff.get('/apply.html')).headers.location).toBe('/admin/');
  });

  test('TC29: Мэдэгдлийг зөвхөн эзэн нь уншсан болгоно', async () => {
    const saraaId = db.prepare("SELECT user_id FROM users WHERE username = 'B221910002'").get().user_id;
    const { lastInsertRowid: id } = db.prepare('INSERT INTO notifications (user_id, title) VALUES (?, ?)').run(saraaId, 'Туршилт');

    const bat = await loginAs(app, 'bat');
    expect((await bat.post(`/api/notifications/${id}/read`)).status).toBe(404);

    const saraa = await loginAs(app, 'saraa');
    expect((await saraa.get('/api/notifications')).body.unread).toBe(1);
    expect((await saraa.post(`/api/notifications/${id}/read`)).status).toBe(200);
    expect((await saraa.get('/api/notifications')).body.unread).toBe(0);
  });
});
