# Telegram Sync API

Контракт реализован серверными функциями в каталоге `api`. На Vercel фронтенд использует API того же домена, поэтому `VITE_API_BASE_URL` можно оставить пустым. Для отдельного API укажите его публичный HTTPS-адрес.

## Security rules

- The frontend sends raw `Telegram.WebApp.initData`; it never authenticates with `initDataUnsafe`.
- The backend validates the Telegram HMAC signature and rejects stale init data before reading or writing user data.
- `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, and database credentials are server-only variables. They must never use the `VITE_` prefix.
- Sync payloads are schema-validated and size-limited. Recommended maximum: 500 mutations or 512 KB per request.
- Review mutation UUIDs are idempotency keys and are inserted once.

## POST /api/auth/telegram

Header:

```http
Authorization: tma <raw Telegram init data>
```

Success response:

```json
{
  "user": {
    "id": "internal-user-uuid",
    "telegramId": "123456789",
    "displayName": "Александр",
    "photoUrl": "https://...",
    "mode": "telegram"
  },
  "serverTime": "2026-08-18T12:00:00.000Z"
}
```

## POST /api/sync

Header uses the same verified Telegram authorization value.

Request:

```json
{
  "deviceId": "client-device-uuid",
  "cursor": "1542",
  "mutations": [
    {
      "id": "review-event-uuid",
      "type": "review.recorded",
      "createdAt": "2026-08-18T11:58:00.000Z",
      "cardId": "js-event-loop-001",
      "rating": "good",
      "reviewedAt": "2026-08-18T11:58:00.000Z"
    }
  ]
}
```

Response:

```json
{
  "acknowledgedMutationIds": ["review-event-uuid"],
  "cursor": "1548",
  "user": {
    "id": "internal-user-uuid",
    "telegramId": "123456789",
    "displayName": "Александр",
    "mode": "telegram"
  },
  "changedProgress": {
    "js-event-loop-001": {
      "cardId": "js-event-loop-001",
      "status": "review",
      "repetitions": 4,
      "correctCount": 3,
      "wrongCount": 1,
      "currentIntervalDays": 12,
      "favorite": false,
      "fsrs": {}
    }
  },
  "serverTime": "2026-08-18T12:00:00.000Z"
}
```

The server transaction performs these operations:

1. Resolve the verified Telegram user and device.
2. Insert unseen review-event UUIDs and apply absolute favorite/settings mutations.
3. Order review events by `reviewedAt` with UUID as a deterministic tie-breaker.
4. Recalculate canonical FSRS state for affected cards.
5. Append sync-change cursor records.
6. Return acknowledgements and changes after the supplied cursor.

The client removes only acknowledged outbox IDs. A timeout or malformed response removes nothing.

## GET /api/health

Returns deployment health without user or secret data:

```json
{ "status": "ok", "time": "2026-08-18T12:00:00.000Z" }
```

## Error responses

- `401` — Telegram signature invalid, missing, or expired.
- `409` — mutation conflicts with an immutable previously accepted event.
- `422` — request or mutation validation failed.
- `429` — user or device rate limit exceeded.
- `500` — unexpected server failure; the client keeps the full outbox for retry.
