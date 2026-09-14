# Проверка карточек — 14 сентября 2026

## Объём и хранение

Карточки загружаются через StaticCardRepository из JSON в `src/features/content/content`, а не из Supabase. В БД хранится пользовательский прогресс. Миграции и правки пользовательских данных для этого обновления не нужны.

| Категория | Проверено | Изменено |
| --- | ---: | ---: |
| JavaScript | 63 | 29 |
| Vue | 50 | 25 |
| PHP | 50 | 24 |
| Laravel | 50 | 29 |
| Всего | 213 | 107 |

В изменённых карточках уточнены вопросы и/или ответы. Сохранены ID, порядок в файлах, категории, разделы, уровни, теги и доступность. Остальные категории не изменялись. Корректные карточки не переписывались ради количества.

## Основные исправления

- JavaScript: восемь типов данных, передача значения ссылки на объект, порядок и уникальность Set, ограничения structuredClone, поведение Promise.all/any, проверка response.ok, конкурентная и последовательная загрузка. Практические задачи получили код решения, объяснение и ограничения.
- Vue: различия deep watch для reactive-объекта и getter; особенности Vue 3.4/3.5; defineModel; реактивная деструктуризация props; отмена запросов в watcher; экспериментальный статус Suspense. Vue 2/Vue.set отмечены как наследие старых проектов. Уточнены Pinia, области состояния и Vuex.
- PHP: понятные примеры базового ООП; readonly и изменения PHP 8.3/8.4; property hooks в интерфейсах; вариантность типов; strict_types; клонирование; счётчики ссылок и циклический мусор; OPcache; PSR/PER.
- Laravel: Eloquent и Query Builder; N+1 и eager loading; условия фонового выполнения очереди; транзакции и внешние эффекты; гонки при проверке идемпотентности; ограничения singleton; CSRF в Laravel 13; исключения и HTTP-статусы; Sanctum/Passport; soft delete; withCount; scopes; массовое присваивание; cursor/chunk; upsert и afterCommit.

Ответы используют простое объяснение, небольшой пример и существенные нюансы. Примеры с API, БД и компонентами предполагают соответствующее окружение — это не отдельные готовые приложения.

## Источники

Проверка выполнена по официальной документации; версия указана в карточке, когда поведение зависит от неё. Актуальность не означает, что исторические вопросы удалены: они явно обозначены как наследие старых проектов.

### JavaScript

- [MDN: Promise.all](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
- [MDN: Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN: функции и передача аргументов](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions)
- [MDN: structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)

### Vue

- [Watchers и очистка эффектов](https://vuejs.org/guide/essentials/watchers.html)
- [Props и реактивная деструктуризация](https://vuejs.org/guide/components/props.html)
- [Component v-model и defineModel](https://vuejs.org/guide/components/v-model.html)
- [Suspense](https://vuejs.org/guide/built-ins/suspense.html)
- [Реактивность](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [Окончание поддержки Vue 2](https://v2.vuejs.org/eol/)

### PHP

- [Объявления типов](https://www.php.net/manual/en/language.types.declarations.php)
- [Свойства и readonly](https://www.php.net/manual/en/language.oop5.properties.php)
- [Интерфейсы](https://www.php.net/manual/en/language.oop5.interfaces.php)
- [Ковариантность и контравариантность](https://www.php.net/manual/en/language.oop5.variance.php)
- [Объекты и ссылки](https://www.php.net/manual/en/language.oop5.references.php)
- [Подсчёт ссылок](https://www.php.net/manual/en/features.gc.refcounting-basics.php)
- [Клонирование](https://www.php.net/manual/en/language.oop5.cloning.php)
- [PER Coding Style](https://www.php-fig.org/per/coding-style/)

### Laravel 13

- [Релизы](https://laravel.com/docs/13.x/releases)
- [Eloquent](https://laravel.com/docs/13.x/eloquent)
- [Связи и withCount](https://laravel.com/docs/13.x/eloquent-relationships)
- [Очереди](https://laravel.com/docs/13.x/queues)
- [Обработка ошибок](https://laravel.com/docs/13.x/errors)
- [CSRF](https://laravel.com/docs/13.x/csrf)
- [Контейнер](https://laravel.com/docs/13.x/container)
- [Пагинация](https://laravel.com/docs/13.x/pagination)

## Проверки и кэш ИИ

- JSON разбирается; количество карточек и метаданные совпадают с исходными.
- В проверенных категориях нет повторяющихся ID и формулировок вопросов.
- Синтаксис 81 JavaScript-фрагмента проверен парсером TypeScript. Vue-фрагменты проверены как шаблоны или SFC по их формату; отдельный CSS-фрагмент не выдавался за полный компонент.
- Production build и проверка типов прошли. Осталось предупреждение Vite о размере общего JS-файла.
- Автоматические тесты не запускались по просьбе пользователя. Все примеры не исполнялись в PHP/Laravel и реальных внешних API; синтаксическая проверка не заменяет проверку поведения в конкретном проекте.
- Кэш ИИ теперь сверяет исходный вопрос и ответ. Старые записи без этих полей не используются; новое объяснение запрашивается только при нажатии кнопки. Переключение между уже полученными режимами для неизменной карточки сохраняет кэширование. Прогресс обучения это не затрагивает.
