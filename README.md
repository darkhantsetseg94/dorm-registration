# Оюутны дотуур байрны бүртгэлийн систем (ОДБ)

![CI](https://github.com/<darkhantsetseg94>/dorm-registration/actions/workflows/ci.yml/badge.svg)

F.CSA316 — Программ хангамж хөгжүүлэлтийн процесс · 4-р баг (Н. Батболд, О. Баттөмөр, А. Дарханцэцэг)

Энэ repo нь лабораторийн ажлуудын кодыг агуулна:

- **Лаб 5 — US-01:** оюутан системд нэвтэрч, дотуур байранд суух хүсэлтээ цахимаар илгээх, илгээсэн хүсэлтээ «Хүлээгдэж буй» төлөвтэйгөөр харах.
- **Лаб 8 — Continuous Integration:** push болон pull request бүрд GitHub Actions автоматаар build хийж, тест ажиллуулна.

Лаб бүрийн эцсийн төлөвийг `lab5`, `lab8` Git tag-аар тэмдэглэнэ.

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
npm run seed                # 3 байр, 3 demo хэрэглэгч үүсгэнэ
npm start                   # http://localhost:3000
npm test                    # автомат тестүүд
```

Windows дээр `cp` ажиллахгүй бол `.env.example`-ийг хуулж `.env` нэртэй болгоно.

Demo хэрэглэгч (нууц үг нь `.env` доторх `DEMO_PASSWORD`):

| Нэвтрэх нэр | Үүрэг |
| --- | --- |
| B221910001 | Эрэгтэй оюутан |
| B221910002 | Эмэгтэй оюутан |
| staff01 | Ажилтан |

Байр: 1-р байр (эрэгтэй), 2-р байр (эмэгтэй), 3-р байр (холимог).

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
├── services/               Бизнес логик, SQL query
├── routes/                 /api/auth/*, /api/applications/*
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
| GET | /api/dormitories | Нэвтэрсэн | Хүйсэнд тохирох байрууд |
| POST | /api/applications | student | Хүсэлт илгээх (US-01) |
| GET | /api/applications/my | student | Өөрийн хүсэлтүүд |
| GET | /api/applications/:id | Эзэмшигч, staff | Хүсэлтийн дэлгэрэнгүй |

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