# ReadHub — книжкові клуби

React-застосунок: каталог, власні клуби та заявки на приєднання.
Збережено наявні маршрути, форми й дизайн. Авторизація — Supabase Auth;
клуби, заявки та членство використовують Supabase PostgreSQL.

## Перший запуск із Supabase

Дотримуйтесь [інструкції налаштування Auth](docs/supabase-auth-setup.md).
Потім виконайте [інструкцію другого етапу](docs/supabase-clubs-setup.md).
Перевірте й самостійно застосуйте версійні міграції в тестовому Supabase у порядку 001–004.
Уже застосовані міграції повторювати не потрібно.
Створіть `.env.local` за `.env.example`: URL проєкту та publishable key.
Залиште підтвердження email увімкненим. Без конфігурації застосунок показує
пояснення, а не використовує стару локальну авторизацію.

Перший admin призначається вручну в Dashboard за UUID. Адміністративної RPC немає.
Ключі secret/service_role не можна додавати до React або змінних VITE_*.

## Запуск і перевірки

Node.js 24, npm.

    npm install
    npm run dev
    npm run lint
    npm run test:run
    npm run build
    npm run preview

У PowerShell із блокуванням npm.ps1 використовуйте npm.cmd.
Docker для розробки: `docker compose build`, `docker compose run --rm web npm install`,
`docker compose up`. Для production потрібний окремий хостинг збірки та SPA fallback.

## Дані

- Supabase Auth зберігає облікові записи й керує сеансом.
- profiles зберігає ім’я, шлях аватара та налаштування нагадувань.
- user_access зберігає роль user/admin та блокування; клієнт не має права їх змінювати.
- Нагадування не надсилаються автоматично.
- Старі `bookclub.users.v1` і `bookclub.session.v1` збережено, але production-вхід їх не читає.
- `bookclub.clubs.v1` та `bookclub.requests.v3` збережено, але production їх не читає.
- Початкові клуби й локальні записи не імпортуються. Новий каталог у БД спочатку порожній.
- Власник автоматично стає учасником; заявки мають pending/approved/rejected/cancelled.
- Скасування заявки й архівування клубу зберігають історію. Членство створює тільки сервер.
- Системні notifications записуються при поданні заявки та рішенні; окремого інтерфейсу ще немає.

Production та dev використовують Supabase незалежно від старого VITE_DATA_SOURCE.
Mock залишено для автоматичних тестів; відмова Supabase не підставляє локальні дані.
Старий localStorage залишається доступним власнику браузера через DevTools.

## Документація та тести

- [Supabase Auth: міграції, ручні дії, обмеження](docs/supabase-auth-setup.md).
- [Клуби, заявки, учасники: налаштування й перевірки](docs/supabase-clubs-setup.md).
- `supabase/tests/auth_rls.test.sql`, `club_lifecycle.test.sql` — pgTAP-тести для одноразової тестової БД.
- `src/services/supabaseAuthService.test.js`, `src/providers/AuthProvider.test.jsx` — новий Auth.
- `src/services/localAuthIsolation.test.js` — ізоляція локальних заявок.
- Старі навчальні Auth-сценарії збережено через test-only адаптер; production його не імпортує.
- `docs/component-architecture.md` і `docs/project-plan.md` містять історію попередніх етапів;
  частина описів локальної авторизації в них застаріла.
