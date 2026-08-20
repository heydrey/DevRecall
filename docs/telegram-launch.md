# Запуск DevRecall в Telegram

Код Mini App и серверных функций уже находится в проекте. Для реального запуска нужны один Telegram-бот, проект Supabase и публикация на Vercel.

## 1. Supabase

1. Создайте проект на `supabase.com`.
2. Откройте SQL Editor и выполните файл `supabase/migrations/202608180001_telegram_sync_foundation.sql`.
3. В Project Settings → API возьмите `Project URL` и `service_role key`.

`service_role key` нельзя добавлять в переменные с префиксом `VITE_` и нельзя отправлять во фронтенд.

## 2. Telegram-бот

1. Откройте `@BotFather`.
2. Выполните `/newbot`, задайте имя и username.
3. Сохраните выданный bot token как серверный секрет `TELEGRAM_BOT_TOKEN`.

## 3. Vercel

Создайте проект из этого репозитория и добавьте Environment Variables:

- `TELEGRAM_BOT_TOKEN`;
- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS=86400`.

Build Command и Output Directory уже заданы в `vercel.json`. После публикации проверьте:

```text
https://ВАШ-ДОМЕН.vercel.app/api/health
```

## 4. Кнопка Mini App

В `@BotFather` откройте `/mybots` → бот → Bot Settings → Menu Button → Configure menu button. Вставьте HTTPS-адрес опубликованного приложения.

После этого один Telegram-пользователь получает один профиль. Telegram Desktop и iPhone синхронизируют историю ответов, FSRS-прогресс, избранное и настройки. При первом входе существующий локальный прогресс автоматически отправляется на сервер порциями; без сети обучение продолжает работать локально.
