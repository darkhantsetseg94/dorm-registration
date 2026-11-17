const request = require('supertest');
const { buildTestApp, loginAs } = require('./helpers');

describe('Хуудас, нийтийн API', () => {
  let app;

  beforeEach(() => {
    ({ app } = buildTestApp());
  });

  test('TC62: Байхгүй хуудсанд 404.html, байхгүй API-д JSON 404 буцаана', async () => {
    const page = await request(app).get('/baihgui.html').set('Accept', 'text/html');
    expect(page.status).toBe(404);
    expect(page.headers['content-type']).toMatch(/html/);
    expect(page.text).toContain('Ийм хуудас алга');

    const bat = await loginAs(app, 'bat');
    const api = await bat.get('/api/baihgui');
    expect(api.status).toBe(404);
    expect(api.body).toEqual({ error: 'Хуудас олдсонгүй' });
  });

  test('TC63: /api/meta нэвтрэхгүйгээр жагсаалт өгнө, нууц мэдээлэл агуулахгүй', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.status).toBe(200);
    expect(res.body.provinces).toHaveLength(22);
    expect(Object.keys(res.body.priorityTags)).toContain('rural');
    expect(res.body.window).toMatchObject({ open: true });
    expect(JSON.stringify(res.body)).not.toMatch(/password|secret|hash/i);
  });

  test('TC64: HTTPS-гүй орчинд upgrade-insecure-requests идэвхгүй (дотоод сүлжээнээс ажиллана)', async () => {
    const res = await request(app).get('/login.html');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    expect(res.headers['content-security-policy']).toContain("script-src-attr 'none'");
  });

  test('TC65: Нэвтэрсэн хэрэглэгч login хуудас руу орвол нүүр хуудас руу шилжинэ', async () => {
    const bat = await loginAs(app, 'bat');
    const res = await bat.get('/login.html');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard.html');
  });
});
