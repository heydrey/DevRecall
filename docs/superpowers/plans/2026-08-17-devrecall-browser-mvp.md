# План реализации браузерного MVP DevRecall

> **Для агентных исполнителей:** ОБЯЗАТЕЛЬНЫЙ ДОПОЛНИТЕЛЬНЫЙ НАВЫК: использовать `superpowers:subagent-driven-development` (рекомендуется) или `superpowers:executing-plans` для пошагового выполнения. Для отслеживания используются чекбоксы `- [ ]`.

**Цель:** Создать русскоязычную браузерную версию DevRecall, в которой уже можно проходить JavaScript-карточки, оценивать ответы и сохранять прогресс локально.

**Архитектура:** Vue-приложение получает контент через `CardRepository`, а прогресс через `ProgressRepository`. Алгоритм повторений и построение сессии реализуются чистыми TypeScript-функциями вне Vue, поэтому позднее локальное хранилище можно заменить API и Supabase без переписывания интерфейса.

**Технологии:** Vue 3, TypeScript strict, Vite, Vue Router, Pinia, Vitest, Vue Test Utils, Zod, markdown-it, DOMPurify, lucide-vue-next, обычный CSS.

**Спецификация:** `docs/superpowers/specs/2026-08-17-devrecall-mvp-design.md`

## Общие ограничения

- Весь пользовательский интерфейс, контент карточек, README и документация пишутся на русском.
- Технические идентификаторы, имена библиотек и команды остаются на английском.
- Первая версия работает в браузере и не содержит Telegram, Supabase или serverless API.
- Контент хранится отдельно от Vue-компонентов в JSON с неизменяемыми стабильными ID.
- HTML внутри Markdown запрещён, результат Markdown очищается DOMPurify.
- Review-алгоритм не зависит от Vue и может быть заменён на FSRS.
- Каждый законченный блок проходит `npm run typecheck`, `npm run test:run` и `npm run build`.

---

## Карта файлов

- `src/app/` — запуск приложения, router, Pinia и общий layout.
- `src/features/content/` — типы контента, JSON, Zod-схемы и статический repository.
- `src/features/study/` — типы прогресса, review-алгоритм, построение сессии, store и UI обучения.
- `src/features/progress/` — интерфейс хранилища и реализация на localStorage.
- `src/features/statistics/` — чистые расчёты и экран статистики.
- `src/shared/` — общие компоненты, Markdown и стили.
- `scripts/validate-cards.ts` — проверка карточек до сборки.
- `tests/` — настройка Vitest и сквозные component tests.

### Задача 1: Каркас приложения и тестовая среда

**Файлы:**
- Создать: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Создать: `src/main.ts`, `src/app/App.vue`, `src/app/router.ts`, `src/app/AppShell.vue`
- Создать: `src/shared/styles/tokens.css`, `src/shared/styles/base.css`
- Создать: `tests/setup.ts`, `src/app/AppShell.test.ts`

**Интерфейсы:**
- Создаёт routes `/`, `/topics`, `/favorites`, `/statistics`, `/settings`.
- Создаёт `AppShell`, который показывает `<RouterView>` и русскую нижнюю навигацию.

- [ ] **Шаг 1: Создать package manifest и установить зависимости**

```json
{
  "scripts": {
    "dev": "vite",
    "typecheck": "vue-tsc --build",
    "test:run": "vitest run",
    "build": "npm run typecheck && vite build"
  },
  "dependencies": {
    "dompurify": "latest",
    "lucide-vue-next": "latest",
    "markdown-it": "latest",
    "pinia": "latest",
    "vue": "latest",
    "vue-router": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@pinia/testing": "latest",
    "@types/markdown-it": "latest",
    "@vitejs/plugin-vue": "latest",
    "@vue/test-utils": "latest",
    "jsdom": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest",
    "vue-tsc": "latest"
  }
}
```

Выполнить: `npm install`

- [ ] **Шаг 2: Написать падающий smoke test layout**

```ts
it('показывает русскую навигацию', () => {
  const wrapper = mount(AppShell, { global: { plugins: [router] } })
  expect(wrapper.text()).toContain('Главная')
  expect(wrapper.text()).toContain('Темы')
  expect(wrapper.text()).toContain('Избранное')
  expect(wrapper.text()).toContain('Статистика')
})
```

- [ ] **Шаг 3: Запустить тест и подтвердить ожидаемое падение**

Выполнить: `npm run test:run -- src/app/AppShell.test.ts`

Ожидается: FAIL, потому что `AppShell.vue` ещё не реализован.

- [ ] **Шаг 4: Реализовать минимальный shell и routes-заглушки**

```vue
<template>
  <div class="app-shell">
    <main class="app-content"><RouterView /></main>
    <nav class="bottom-nav" aria-label="Основная навигация">
      <RouterLink to="/">Главная</RouterLink>
      <RouterLink to="/topics">Темы</RouterLink>
      <RouterLink to="/favorites">Избранное</RouterLink>
      <RouterLink to="/statistics">Статистика</RouterLink>
    </nav>
  </div>
</template>
```

- [ ] **Шаг 5: Проверить каркас и закоммитить**

Выполнить: `npm run test:run && npm run typecheck && npm run build`

Коммит: `feat: initialize Vue application shell`

### Задача 2: Модель контента, repository и 30 JavaScript-карточек

**Файлы:**
- Создать: `src/features/content/types.ts`, `src/features/content/schema.ts`
- Создать: `src/features/content/CardRepository.ts`, `src/features/content/StaticCardRepository.ts`
- Создать: `src/features/content/content/topics.json`
- Создать: `src/features/content/content/javascript/fundamentals.json`, `event-loop.json`, `promises.json`, `closures.json`
- Создать: `src/features/content/StaticCardRepository.test.ts`

**Интерфейсы:**
- Производит `Topic`, `Section`, `Card`, `CardLevel`.
- Производит `CardRepository.getTopics()`, `getCards()`, `getCardsByTopic(topicId)`, `getCardById(cardId)`.

- [ ] **Шаг 1: Написать тест repository**

```ts
it('возвращает JavaScript-карточки со стабильными ID', async () => {
  const repository = new StaticCardRepository()
  const cards = await repository.getCardsByTopic('javascript')
  expect(cards).toHaveLength(30)
  expect(new Set(cards.map(card => card.id)).size).toBe(30)
  expect(cards.every(card => card.question && card.answer)).toBe(true)
})
```

- [ ] **Шаг 2: Подтвердить падение теста**

Выполнить: `npm run test:run -- src/features/content/StaticCardRepository.test.ts`

Ожидается: FAIL с отсутствующим `StaticCardRepository`.

- [ ] **Шаг 3: Реализовать типы и Zod-схемы**

```ts
export type CardLevel = 'basic' | 'middle' | 'advanced'

export interface Card {
  id: string
  topicId: string
  sectionId: string
  question: string
  answer: string
  level: CardLevel
  tags: string[]
  enabled: boolean
}
```

- [ ] **Шаг 4: Реализовать repository и добавить 30 карточек**

Карточки распределить: основы — 8, Event Loop — 8, Promise/async — 8, замыкания — 6. Каждый вопрос проверяет одну мысль; ответы содержат короткое объяснение и код только там, где он помогает.

```ts
export interface CardRepository {
  getTopics(): Promise<Topic[]>
  getCards(): Promise<Card[]>
  getCardsByTopic(topicId: string): Promise<Card[]>
  getCardById(cardId: string): Promise<Card | null>
}
```

- [ ] **Шаг 5: Проверить и закоммитить**

Выполнить: `npm run test:run -- src/features/content/StaticCardRepository.test.ts`

Коммит: `feat: add JavaScript card repository`

### Задача 3: Валидатор контента

**Файлы:**
- Создать: `scripts/validate-cards.ts`, `scripts/validate-cards.test.ts`
- Изменить: `package.json`

**Интерфейсы:**
- Производит `validateContent(topics, cards): ValidationIssue[]`.
- Добавляет команды `validate:cards` и `prebuild`.

- [ ] **Шаг 1: Написать тесты ошибок контента**

```ts
it('обнаруживает повторяющиеся ID и неизвестный topicId', () => {
  const issues = validateContent(topics, [card, card, { ...card, id: 'x', topicId: 'missing' }])
  expect(issues.map(issue => issue.code)).toEqual(
    expect.arrayContaining(['duplicate-card-id', 'unknown-topic'])
  )
})
```

- [ ] **Шаг 2: Подтвердить падение, затем реализовать чистый validator**

Выполнить: `npm run test:run -- scripts/validate-cards.test.ts`

```ts
export interface ValidationIssue {
  code: 'duplicate-card-id' | 'unknown-topic' | 'unknown-section' | 'invalid-card'
  source: string
  message: string
}
```

- [ ] **Шаг 3: Подключить validator к build**

```json
{
  "scripts": {
    "validate:cards": "tsx scripts/validate-cards.ts",
    "prebuild": "npm run validate:cards"
  }
}
```

Добавить `tsx` в devDependencies.

- [ ] **Шаг 4: Проверить и закоммитить**

Выполнить: `npm run validate:cards && npm run test:run && npm run build`

Коммит: `feat: validate learning content`

### Задача 4: Review-алгоритм и построение сессии

**Файлы:**
- Создать: `src/features/study/types.ts`, `src/features/study/reviewAlgorithm.ts`, `src/features/study/sessionBuilder.ts`
- Создать: `src/features/study/reviewAlgorithm.test.ts`, `src/features/study/sessionBuilder.test.ts`

**Интерфейсы:**
- Производит `ReviewRating`, `CardProgress`, `ReviewOutcome`, `StudySession`.
- Производит `calculateReview(progress, rating, reviewedAt)` и `buildStudyQueue(input)`.

- [ ] **Шаг 1: Написать parameterized tests интервалов**

```ts
it.each([
  ['again', 1],
  ['hard', 3],
  ['good', 5],
  ['easy', 8],
] as const)('%s задаёт ожидаемый интервал', (rating, expectedDays) => {
  const outcome = calculateReview(progressWithTwoDayInterval, rating, now)
  expect(outcome.progress.currentIntervalDays).toBe(expectedDays)
})
```

- [ ] **Шаг 2: Написать тест очереди**

```ts
it('ставит due-карточки перед новыми и возвращает Again не сразу', () => {
  const queue = buildStudyQueue({ cards, progress, now, newLimit: 10, reviewLimit: 50 })
  expect(queue.cardIds.slice(0, 2)).toEqual(['due-1', 'due-2'])
  const updated = requeueAgain(queue, 'due-1', 5)
  expect(updated.cardIds.indexOf('due-1')).toBeGreaterThanOrEqual(5)
})
```

- [ ] **Шаг 3: Подтвердить падение и реализовать чистые функции**

Интервалы: Again = 1 день; Hard = `max(1, round(previous * 1.5))`; Good = `max(3, round(previous * 2.5))`; Easy = `max(7, round(previous * 4))`.

- [ ] **Шаг 4: Проверить и закоммитить**

Выполнить: `npm run test:run -- src/features/study`

Коммит: `feat: implement review algorithm and session queue`

### Задача 5: Локальное хранение прогресса

**Файлы:**
- Создать: `src/features/progress/ProgressRepository.ts`, `src/features/progress/LocalProgressRepository.ts`
- Создать: `src/features/progress/LocalProgressRepository.test.ts`

**Интерфейсы:**
- Производит `loadSnapshot()`, `saveReview(outcome)`, `toggleFavorite(cardId)`, `saveSettings(settings)`, `saveSession(session)`.
- Хранит одну версионированную запись `devrecall:v1`.

- [ ] **Шаг 1: Написать contract tests**

```ts
it('атомарно сохраняет прогресс и событие повторения', async () => {
  await repository.saveReview(outcome)
  const snapshot = await repository.loadSnapshot()
  expect(snapshot.progress[outcome.progress.cardId]).toEqual(outcome.progress)
  expect(snapshot.reviewEvents).toContainEqual(outcome.event)
})
```

- [ ] **Шаг 2: Добавить тест повреждённого JSON**

```ts
it('безопасно возвращает пустой snapshot при повреждённых данных', async () => {
  storage.setItem('devrecall:v1', '{broken')
  await expect(repository.loadSnapshot()).resolves.toEqual(createEmptySnapshot())
})
```

- [ ] **Шаг 3: Реализовать repository и проверить**

```ts
export interface ProgressRepository {
  loadSnapshot(): Promise<ProgressSnapshot>
  saveReview(outcome: ReviewOutcome): Promise<void>
  toggleFavorite(cardId: string): Promise<boolean>
  saveSettings(settings: UserSettings): Promise<void>
  saveSession(session: StudySession | null): Promise<void>
}
```

Коммит: `feat: persist learning progress locally`

### Задача 6: Главная, темы и навигация

**Файлы:**
- Создать: `src/features/home/HomeView.vue`, `src/features/content/TopicsView.vue`, `src/features/content/TopicView.vue`
- Создать: `src/features/favorites/FavoritesView.vue`, `src/features/statistics/StatisticsView.vue`, `src/features/settings/SettingsView.vue`
- Создать: `src/shared/components/ProgressRing.vue`, `src/shared/components/StatCard.vue`, `src/shared/components/EmptyState.vue`
- Изменить: `src/app/router.ts`, `src/app/AppShell.vue`, общие CSS-файлы
- Создать: `src/features/home/HomeView.test.ts`

**Интерфейсы:**
- Главная показывает due/new, серию, число изученных карточек и CTA.
- Topic route `/topics/:topicId` запускает обучение выбранной темы.

- [ ] **Шаг 1: Написать component test главной**

```ts
it('показывает сегодняшнюю учебную задачу', () => {
  const wrapper = mount(HomeView, { global: { plugins: [testingPinia] } })
  expect(wrapper.text()).toContain('Сегодня к повторению')
  expect(wrapper.get('[data-testid="start-study"]').text()).toContain('Начать обучение')
})
```

- [ ] **Шаг 2: Реализовать экраны и mobile-first стили**

Использовать touch targets не меньше 44 px, `max-width: 760px`, `env(safe-area-inset-bottom)`, светлую и тёмную темы через CSS custom properties.

- [ ] **Шаг 3: Проверить responsive layout и закоммитить**

Выполнить: `npm run test:run && npm run build`

Коммит: `feat: add mobile learning dashboard`

### Задача 7: Полный экран обучения

**Файлы:**
- Создать: `src/features/study/StudyView.vue`, `src/features/study/StudyCard.vue`, `src/features/study/RatingBar.vue`, `src/features/study/SessionResult.vue`
- Создать: `src/features/study/studyStore.ts`, `src/shared/markdown/renderMarkdown.ts`, `src/shared/markdown/MarkdownContent.vue`
- Создать: `src/features/study/StudyView.test.ts`, `src/shared/markdown/renderMarkdown.test.ts`
- Изменить: `src/app/router.ts`

**Интерфейсы:**
- Route `/study` скрывает нижнюю навигацию.
- `studyStore.start(mode)`, `revealAnswer()`, `rate(rating)`, `toggleFavorite()`, `finish()`.

- [ ] **Шаг 1: Написать test reveal/rating flow**

```ts
it('не показывает оценки до открытия ответа', async () => {
  const wrapper = mount(StudyView, { global: { plugins: [testingPinia] } })
  expect(wrapper.find('[data-testid="rating-bar"]').exists()).toBe(false)
  await wrapper.get('[data-testid="reveal-answer"]').trigger('click')
  expect(wrapper.find('[data-testid="rating-bar"]').exists()).toBe(true)
})
```

- [ ] **Шаг 2: Написать security test Markdown**

```ts
it('удаляет HTML и опасные ссылки', () => {
  const html = renderMarkdown('<script>alert(1)</script>[x](javascript:alert(1))')
  expect(html).not.toContain('<script')
  expect(html).not.toContain('javascript:')
})
```

- [ ] **Шаг 3: Реализовать store, UI и безопасный Markdown**

`markdown-it` настраивается с `html: false` и `linkify: true`, результат проходит через `DOMPurify.sanitize`, а блоки кода получают горизонтальную прокрутку.

- [ ] **Шаг 4: Реализовать экран результата и восстановление сессии**

Экран показывает количество Again/Hard/Good/Easy, новых и повторённых карточек и длительность. Незавершённая сессия сохраняется после каждого ответа.

- [ ] **Шаг 5: Проверить и закоммитить**

Выполнить: `npm run test:run -- src/features/study src/shared/markdown && npm run build`

Коммит: `feat: complete local study session`

### Задача 8: Избранное, статистика и настройки

**Файлы:**
- Изменить: `src/features/favorites/FavoritesView.vue`, `src/features/statistics/StatisticsView.vue`, `src/features/settings/SettingsView.vue`
- Создать: `src/features/statistics/calculateStatistics.ts`, `src/features/statistics/calculateStatistics.test.ts`
- Создать: `src/features/statistics/WeeklyActivity.vue`

**Интерфейсы:**
- Производит `calculateStatistics(events, progress, now, timeZone)`.
- Настройки: новых карточек 10/20/30/50/без ограничения, повторений 50/100/без ограничения, тема system/light/dark.

- [ ] **Шаг 1: Написать tests статистики и границы дня**

```ts
it('считает событие в локальном дне пользователя', () => {
  const stats = calculateStatistics(eventsAroundMidnight, progress, now, 'Europe/Moscow')
  expect(stats.today.reviewed).toBe(2)
  expect(stats.streakDays).toBe(1)
})
```

- [ ] **Шаг 2: Реализовать расчёты и экраны**

Недельная активность рисуется CSS-полосами без chart-библиотеки. Избранное поддерживает фильтр темы и запуск отдельной study-сессии.

- [ ] **Шаг 3: Проверить и закоммитить**

Выполнить: `npm run test:run && npm run typecheck && npm run build`

Коммит: `feat: add favorites statistics and settings`

### Задача 9: Документация и финальная проверка браузерного MVP

**Файлы:**
- Изменить: `README.md`
- Создать: `.gitignore`, `.env.example`

**Интерфейсы:**
- README описывает назначение, запуск, архитектуру, добавление тем и карточек, проверку контента и следующий Telegram-этап.

- [ ] **Шаг 1: Обновить README на русском**

Включить команды `npm install`, `npm run dev`, `npm run validate:cards`, `npm run test:run`, `npm run build` и точный JSON-пример карточки.

- [ ] **Шаг 2: Выполнить полный набор проверок**

Выполнить:

```powershell
npm run validate:cards
npm run test:run
npm run typecheck
npm run build
```

Ожидается: все команды завершаются с кодом 0.

- [ ] **Шаг 3: Визуально проверить приложение**

Проверить ширины 390 px и 1440 px: отсутствуют горизонтальный scroll страницы, перекрытие нижней навигацией и недоступные touch targets; код в ответах прокручивается внутри блока.

- [ ] **Шаг 4: Закоммитить готовый браузерный MVP**

Коммит: `docs: document browser MVP workflow`

После этого создать отдельный план для Supabase, Telegram Mini App, бота, deployment и синхронизации между устройствами.
