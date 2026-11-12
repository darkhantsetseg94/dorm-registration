# Оюутны дотуур байрны бүртгэлийн систем (ОДБ)

![CI](https://github.com/darkhantsetseg94/dorm-registration/actions/workflows/ci.yml/badge.svg)

F.CSA316 — Программ хангамж хөгжүүлэлтийн процесс · 4-р баг (Н. Батболд, О. Баттөмөр, А. Дарханцэцэг)

Энэ repo нь лабораторийн ажлуудын кодыг агуулна:

- **Лаб 5 — US-01:** оюутан системд нэвтэрч, дотуур байранд суух хүсэлтээ цахимаар илгээх, илгээсэн хүсэлтээ «Хүлээгдэж буй» төлөвтэйгөөр харах.
- **Лаб 8 — Continuous Integration:** push болон pull request бүрд GitHub Actions автоматаар build хийж, тест ажиллуулна.
- **Лаб 11 — REST API / CRUD:** оюутан хүсэлтээ засах (PATCH), цуцлах (DELETE → CANCELLED); ажилтан ирсэн хүсэлтийг жагсааж, зөвшөөрөх / татгалзах (US-05). Backend-ийг route → controller → service → model давхаргад хуваасан.

Лаб бүрийн эцсийн төлөвийг `lab5`, `lab8`, `lab11` Git tag-аар тэмдэглэнэ.

Дотуур байр **нэг байртай** тул хүсэлт илгээхэд байр сонгохгүй; оюутан утас, яаралтай үед холбогдох хүн, шалтгаанаа бөглөнө.

## Технологи

| Хэсэг | Хэрэгсэл |
| --- | --- |
| Backend | Node.js 20+, Express 4 |
| Өгөгдлийн сан | SQLite (better-sqlite3) |
| Frontend | HTML, CSS, JavaScript |
| Security | bcryptjs, express-session, helmet, express-rate-limit |
| Тест | Jest, Supertest |
| CI | GitHub Actions |

## Суулгах, ажиллуулах

```bash
npm install
cp .env.example .env        # SESSION_SECRET, DEMO_PASSWORD-ийг өөрчилнө
npm run seed                # 3 demo хэрэглэгч үүсгэнэ
npm start                   # http://localhost:3000
npm test                    # автомат тестүүд
```

Windows PowerShell дээр `cp`-ийн оронд `copy .env.example .env` ашиглана.

> **Өмнөх хувилбарын өгөгдлийн сантай бол:** хүснэгтийн бүтэц өөрчлөгдсөн (олон байр → нэг байр) тул `data` хавтсыг устгаад `npm run seed`-ийг дахин ажиллуулна. Сервер хуучин бүтэцтэй өгөгдлийн санг илрүүлбэл энэ тухай мессеж гаргана.

Demo хэрэглэгч (нууц үг нь `.env` доторх `DEMO_PASSWORD`):

| Нэвтрэх нэр | Үүрэг |
| --- | --- |
| B221910001 | Эрэгтэй оюутан |
| B221910002 | Эмэгтэй оюутан |
| staff01 | Ажилтан |

## Кодын бүтэц

```text
src/
├── app.js                  Express app, middleware
├── server.js               Сервер эхлүүлэх
├── config.js               .env-ээс тохиргоо унших
├── errors.js               AppError класс
├── db/database.js          SQLite холболт, schema
├── middleware/             requireAuth, requireRole, errorHandler
├── validators/             Нэвтрэх ба хүсэлтийн form шалгах
├── routes/                 URL + method → middleware, controller
├── controllers/            HTTP хүсэлт → service → JSON хариу
├── services/               Бизнесийн дүрэм (эрх, төлөвийн шилжилт)
├── models/                 SQL query (prepared statement)
└── public/                 login, dashboard, apply хуудас
database/                   schema.sql, seed.js
tests/                      Jest тестүүд
.github/workflows/ci.yml    CI тохиргоо
```

## API

| Method | Endpoint | Эрх | Үүрэг |
| --- | --- | --- | --- |
| POST | /api/auth/login | Бүгд | Нэвтрэх |
| POST | /api/auth/logout | Нэвтэрсэн | Гарах |
| GET | /api/auth/me | Нэвтэрсэн | Одоогийн хэрэглэгч |
| GET | /api/applications | Нэвтэрсэн | Оюутан: өөрийнх · Ажилтан: бүгд (`?status=PENDING`) |
| GET | /api/applications/my | student | Өөрийн хүсэлтүүд |
| POST | /api/applications | student | Хүсэлт илгээх (US-01) → 201 |
| GET | /api/applications/:id | Эзэмшигч, staff | Хүсэлтийн дэлгэрэнгүй → 200 / 404 |
| PATCH | /api/applications/:id | Эзэмшигч | PENDING хүсэлтийн талбар засах → 200 |
| PATCH | /api/applications/:id | staff | `{"status":"APPROVED"}` эсвэл `{"status":"REJECTED","reviewNote":"…"}` (US-05) → 200 |
| DELETE | /api/applications/:id | Эзэмшигч | PENDING хүсэлтийг цуцлах (CANCELLED) → 204 |

Хүсэлтийн төлөв: `PENDING` → `APPROVED` / `REJECTED` (ажилтан) эсвэл `CANCELLED` (оюутан). Шийдвэрлэгдсэн хүсэлтийг засах, цуцлахад `409 Conflict`. Цуцалсан хүсэлт тооцогдохгүй тул тухайн хичээлийн жилд дахин хүсэлт илгээх боломжтой.

## Security

- Нууц үгийг bcrypt hash-аар хадгална (хэрэглэгч бүрт тусдаа salt).
- Session cookie: HttpOnly, SameSite=Strict, production-д Secure; нэвтрэх бүрд session ID шинэчилнэ.
- 15 минутад 5 амжилтгүй нэвтрэх оролдлогын хязгаар (brute-force).
- Бүх SQL query parameterized (prepared statement).
- Input validation (whitelist талбар, regex, урт); HTML/`javascript:` агуулсан текстийг татгалзана.
- Frontend өгөгдлийг `textContent`-оор харуулна; helmet CSP header.
- Оюутан зөвхөн өөрийн хүсэлтийг харна (IDOR хамгаалалт).
- Алдааны мессежид stack trace, SQL алдаа харуулахгүй.

## Continuous Integration

`.github/workflows/ci.yml` нь `main`, `develop`, `feature/**`, `ci/**` салбарт push хийх болон `main`/`develop` руу pull request нээх бүрд ажиллана.

Алхмууд: код татах → Node.js (20, 22) суулгах → `npm ci` → better-sqlite3 шалгах → JS syntax шалгах → `npm test`.

Нэг тест унавал workflow улаан болж, branch protection-оор `main`-д нэгтгэх боломжгүй болно. Локал дээр CI-тэй ижил шалгалт хийх:

```bash
npm ci && npm test
```
