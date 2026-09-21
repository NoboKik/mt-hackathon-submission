# Проводник 400

«Проводник 400» — тренажёр с элементами геймификации для проводников ВСМ: короткие (3–7 минут)
сценарии нештатных ситуаций с ветвящимися диалогами, выбором на время и двумя шкалами —
лояльностью пассажира и рейтингом безопасности. После каждого сценария — разбор с эталонным
путём, а очки, компетенции, достижения и рейтинг среди коллег складываются в профиль сотрудника.

## Попробовать

```
https://mt-hackathon.nobokik.dev/login?invite=<код-приглашения>
```

`<код-приглашения>` — заглушка, действующий код будет передан вместе с заявкой. Кнопка
«Демо-вход» на этой странице входит под учётной записью демо-проводника.

## Запустить локально

Нужен только Docker с Compose v2.

```bash
git clone https://github.com/NoboKik/mt-hackathon.git
cd mt-hackathon
cp infra/.env.example infra/.env
docker compose -f infra/docker-compose.yml up --build
```

Затем откройте `http://localhost`.

- При каждом запуске сервис `migrate` применяет миграции и обновляет сценарии из
  `content/scenarios`; демо-данные он добавляет только в пустую базу.
- С пустым `DEMO_INVITE` демо-вход открыт без кода.

Все переменные окружения с пояснениями — в `infra/.env.example`. Главные:

- `POSTGRES_PASSWORD`, `SITE_ADDRESS` — обязательны на сервере, без них `infra/deploy.sh` не
  запустится;
- `AUTH_SECRET` — можно не задавать: ключ подписи сессий генерируется при первом запуске и
  хранится в томе `secrets`;
- `SEED_DEMO` — `1`: при первом запуске добавить демо-проводника и 30 коллег для рейтинга;
  `0`: чистая установка без демо-данных;
- `DEMO_INVITE` — код приглашения для демо-входа (пусто — вход открыт);
- `LLM_DAILY_LIMIT` — лимит генераций сценариев в автоматическом режиме за 24 часа
  (по умолчанию 100, `0` — генерация выключена).

## Архитектура

```
  Browser ──https──► DNS: Cloudflare, grey cloud ─► clo.ru VPS
                                                      │ :443 (only public ports: 80, 443)
                                        ┌─────────────┼──── Docker Compose ─────────────┐
                                        │  caddy  ── TLS (Let's Encrypt), reverse proxy │
                                        │    │                                          │
                                        │  web :3000 ── Next.js: pages, /api, engine,   │
                                        │    │          auto-mode pool top-up           │
                                        │  postgres ── all state, volume `pgdata`       │
                                        │  migrate ── one-shot: migrations, first seed  │
                                        └────┼──────────────────────────────────────────┘
                                             └──outbound, auto mode only──► LLM endpoint
```

- **Browser / DNS** — A-запись в Cloudflare без проксирования (серое облако) ведёт прямо на
  сервер в России: проксируемые Cloudflare сайты в России замедляются.
- **caddy** — единственный сервис с открытыми портами 80/443; сам получает сертификат
  Let's Encrypt для `SITE_ADDRESS` и проксирует запросы в `web`.
- **web** — Next.js: страницы, API (`app/api/*`), игровой движок, подсчёт очков и пополнение пула
  сценариев автоматического режима. Сервер — единственный источник истины для очков и шкал.
- **postgres** — PostgreSQL 16, всё состояние приложения, том `pgdata`; порт открыт только на
  `127.0.0.1`.
- **migrate** — одноразовый сервис: миграции и первичное заполнение базы, только если она пуста.
- **LLM endpoint** — любой OpenAI-совместимый `/chat/completions`; нужен только автоматическому
  режиму, остальное приложение работает без него.

## Развёртывание у заказчика

Тот же `infra/docker-compose.yml` разворачивается внутри сети ВСМ-400. Языковая модель работает
на собственном GPU-сервере заказчика через vLLM или Ollama с открытой моделью и доступна по
внутреннему адресу (`LLM_BASE_URL`): данные не покидают периметр, система полностью работает
без выхода в интернет. Для такой установки `SEED_DEMO=0`: демо-данных нет, учётные записи
сотрудников заводятся командой `pnpm user:add` (см. «Учётные записи»). В планах — корпоративный SSO и выгрузка результатов в LMS.

## Разработка

Нужны Node.js и pnpm. Для разработки скопируйте `apps/web/.env.example` в `apps/web/.env` и
поднимите только базу:

```bash
cp apps/web/.env.example apps/web/.env
docker compose -f infra/docker-compose.yml up -d postgres
```

```bash
pnpm install            # зависимости монорепозитория
pnpm dev                # Next.js в режиме разработки, http://localhost:3000
pnpm validate:content   # проверка JSON-сценариев из content/scenarios по Zod-схеме
pnpm test               # тесты (Vitest)
pnpm build              # сборка всех пакетов
pnpm db:migrate         # миграции Drizzle
pnpm db:seed            # полное перезаполнение базы демо-данными (удаляет пользователей и сессии)
pnpm user:add           # создать учётную запись или сбросить пароль (см. «Учётные записи»)
```

Не запускайте `pnpm dev` одновременно с `docker compose up`: оба занимают порты 3000/80.

## Сервер (однократная настройка)

Выполняется вручную один раз, все команды — от `root`.

1. clo.ru: Debian 13, от 1 vCPU / 2 GB RAM (`deploy.sh` добавит swap), диск от 10 GB, внешний IP.
2. Cloudflare → `nobokik.dev` → DNS: запись **A** `mt-hackathon` → IP сервера,
   **Proxy status: DNS only (серое облако)**.
3. На сервере: Docker из официального apt-репозитория Docker
   (docs.docker.com/engine/install/debian), брандмауэр и клон в `/opt/p400`:

   ```bash
   apt-get install -y git ufw
   ufw allow 22,80,443/tcp
   ufw enable
   ssh-keygen -t ed25519 -N '' -f ~/.ssh/github_deploy && cat ~/.ssh/github_deploy.pub
   printf 'Host github.com\n  IdentityFile ~/.ssh/github_deploy\n' >> ~/.ssh/config
   git clone git@github.com:NoboKik/mt-hackathon.git /opt/p400
   cd /opt/p400
   ```

4. Создать и заполнить `infra/.env` (как минимум `POSTGRES_PASSWORD`,
   `SITE_ADDRESS=mt-hackathon.nobokik.dev`, `DEMO_INVITE`):

   ```bash
   cp infra/.env.example infra/.env
   chmod 600 infra/.env
   ```

5. Первый запуск — сборка образа, миграции, заполнение базы, Caddy получает сертификат:

   ```bash
   ./infra/deploy.sh
   ```

6. Ночной бэкап: `crontab -e` и строка

   ```bash
   0 3 * * * /opt/p400/infra/deploy.sh backup >> /root/backup.log 2>&1
   ```

## Обслуживание

```bash
infra/deploy.sh              # обновление: git pull, сборка, перезапуск (первый запуск — та же команда)
infra/deploy.sh reset-demo   # перед каждым показом: полное перезаполнение, стирает прохождения посетителей
infra/deploy.sh backup       # pg_dump в infra/backups/, хранится 7 дней
```

`deploy.sh` без swap на сервере сам добавляет 2 GB `/swapfile`: сборке Next.js может не хватить 4 GB памяти.

### Учётные записи

Регистрации и админ-панели нет: учётные записи заводит оператор. Пароль генерируется и
печатается один раз.

```bash
docker compose -f infra/docker-compose.yml run --rm migrate pnpm user:add --email i.petrov@vsm400.ru --name "Иван Петров" --depot "Депо Москва-Октябрьская"
docker compose -f infra/docker-compose.yml run --rm migrate pnpm user:add --email i.petrov@vsm400.ru --reset
```

`deploy.sh reset-demo` удаляет и эти учётные записи; с `SEED_DEMO=0` он никого не удаляет.

При DDoS-атаке: включить в Cloudflare проксирование (оранжевое облако) для `mt-hackathon` и
выставить SSL/TLS в режим Full (strict).
