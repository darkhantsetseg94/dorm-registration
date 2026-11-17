/**
 * Системийн тогтмол утгууд. Frontend эдгээрийг GET /api/meta-аар авдаг тул
 * жагсаалтыг зөвхөн энд өөрчилнө.
 */

const STATUS_LABELS = {
  PENDING: 'Хүлээгдэж буй',
  APPROVED: 'Зөвшөөрсөн',
  REJECTED: 'Татгалзсан',
  CANCELLED: 'Цуцалсан',
};

const EVENT_LABELS = {
  SUBMITTED: 'Хүсэлт илгээсэн',
  UPDATED: 'Хүсэлтийг зассан',
  CANCELLED: 'Хүсэлтийг цуцалсан',
  APPROVED: 'Хүсэлтийг зөвшөөрсөн',
  REJECTED: 'Хүсэлтээс татгалзсан',
  ROOM_ASSIGNED: 'Өрөө хуваарилсан',
  ROOM_REMOVED: 'Өрөөний хуваарилалтыг цуцалсан',
  REOPENED: 'Шийдвэрийг буцааж, дахин хянахаар болсон',
};

const GENDER_LABELS = { male: 'Эрэгтэй', female: 'Эмэгтэй' };
const DORM_GENDER_LABELS = { male: 'Эрэгтэй', female: 'Эмэгтэй', mixed: 'Холимог' };
const ROLE_LABELS = { student: 'Оюутан', staff: 'Ажилтан' };
const AUDIENCE_LABELS = { all: 'Бүх хэрэглэгч', student: 'Оюутнууд', staff: 'Ажилтнууд' };

// 21 аймаг + нийслэл
const PROVINCES = [
  'Улаанбаатар', 'Архангай', 'Баян-Өлгий', 'Баянхонгор', 'Булган', 'Говь-Алтай', 'Говьсүмбэр',
  'Дархан-Уул', 'Дорноговь', 'Дорнод', 'Дундговь', 'Завхан', 'Орхон', 'Өвөрхангай', 'Өмнөговь',
  'Сүхбаатар', 'Сэлэнгэ', 'Төв', 'Увс', 'Ховд', 'Хөвсгөл', 'Хэнтий',
];

// Байранд хамрагдахад давуу эрх олгох нөхцөл
const PRIORITY_TAGS = {
  rural: 'Орон нутгаас ирсэн',
  orphan: 'Өнчин',
  disability: 'Хөгжлийн бэрхшээлтэй',
  low_income: 'Амьжиргааны түвшин доогуур өрх',
  many_children: 'Олон хүүхэдтэй өрх',
  excellence: 'Сурлагын өндөр амжилттай',
};

const RELATIONS = ['Эцэг', 'Эх', 'Ах', 'Эгч', 'Дүү', 'Өвөө', 'Эмээ', 'Асран хамгаалагч', 'Хамаатан', 'Бусад'];

const COURSE_LABELS = { 1: '1-р курс', 2: '2-р курс', 3: '3-р курс', 4: '4-р курс', 5: '5-р курс', 6: 'Магистр' };

module.exports = {
  STATUS_LABELS,
  EVENT_LABELS,
  GENDER_LABELS,
  DORM_GENDER_LABELS,
  ROLE_LABELS,
  AUDIENCE_LABELS,
  PROVINCES,
  PRIORITY_TAGS,
  RELATIONS,
  COURSE_LABELS,
};
