# Книжкові клуби

Веб-застосунок для організації роботи книжкових клубів.
Поточний результат: початкова сторінка з каталогом клубів (локальні дані).

## Середовище
Node.js: v24.21.0
npm: 11.19.0
Git: 2.45.1.windows.1
Docker: 27.2.0
Docker Compose: v2.29.2-desktop.2
Основний варіант: A (Windows зі стандартними інсталяторами)

## Запуск
Нативно:
  npm install
  npm run dev
  → http://localhost:5173

Docker:
  docker compose build
  docker compose run --rm web npm install
  docker compose up
  → http://localhost:5173

Зупинення й видалення контейнера: docker compose down

## Збірка
npm run build
Або: docker compose run --rm web npm run build
Перегляд збірки: npm run preview → http://localhost:4173

## План
Див. docs/project-plan.md
Форми, голосування, зустрічі, маршрутизація — заплановано на наступні лабораторні.