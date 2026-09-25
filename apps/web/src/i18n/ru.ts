import type { AchievementCode, Competency, LevelKey } from '@p400/shared'

/**
 * All user-facing copy lives here. Components must not hard-code Russian strings.
 */
export const ru = {
  app: {
    name: 'Проводник 400',
    tagline: 'Тренажёр нештатных ситуаций для проводников ВСМ',
  },
  home: {
    subtitle:
      'Короткие сценарии реальных инцидентов: решения под таймером, две шкалы, разбор от наставника.',
    status: 'Каркас проекта готов. Экраны и сценарии — в следующих задачах.',
    catalogue: 'Каталог сценариев',
    empty: 'Сценарии ещё не загружены. Запустите pnpm db:seed.',
    minutes: 'мин',
    best: 'Лучший результат',
    notPlayed: 'Не пройден',
    attempts: 'Попыток',
    start: 'Начать',
    graph: 'Граф сценария',
    replay: 'Пройти ещё раз',
    difficulty: 'Сложность',
    difficultyLevels: ['', 'Базовый', 'Средний', 'Сложный'] as const,
  },
  nav: {
    scenarios: 'Сценарии',
    profile: 'Профиль',
    leaderboard: 'Рейтинг',
    signOut: 'Выйти',
    // Controls on the floating shell. `theme` is one label for both directions on purpose:
    // the button's icon says which way it goes, and a label that flips mid-interaction is
    // read out twice by a screen reader.
    menu: 'Меню',
    close: 'Закрыть',
    theme: 'Сменить тему',
    exitPlay: 'Выйти из сценария',
  },
  auth: {
    title: 'Вход в тренажёр',
    subtitle: 'Учебная среда ВСМ-400. Войдите, чтобы продолжить обучение.',
    email: 'Электронная почта',
    password: 'Пароль',
    signIn: 'Войти',
    demo: 'Демо-вход',
    demoHint: 'Демо-вход открывает профиль проводника с готовой историей поездок.',
  },
  player: {
    loyalty: 'Лояльность пассажира',
    safety: 'Рейтинг безопасности',
    // The in-play HUD is ~150px wide per meter on a 375px phone, where the full labels
    // truncate to "ЛОЯЛЬНОСТЬ ПА…" / "РЕЙТИНГ БЕЗОПА…". Unambiguous on their own, and the
    // full label still reaches assistive tech through the meter's aria-label.
    loyaltyShort: 'Лояльность',
    safetyShort: 'Безопасность',
    timeLeft: 'Осталось',
    seconds: 'с',
    timedOut: 'Время вышло — решение принято за вас.',
    continue: 'Дальше',
    toDebrief: 'Разбор',
    loading: 'Готовим сценарий…',
    // The countdown is announced to screen readers only at these points, not every tick.
    timerLabel: 'Таймер решения',
    // Beside each HUD meter: the value below which the run ends.
    failAt: 'порог',
  },
  // Scenario JSON carries speaker keys; the narrator is never shown.
  speakers: {
    passenger: 'Пассажир',
    conductor: 'Проводник',
    dispatcher: 'Диспетчер',
    medic: 'Медик',
  },
  outcomes: {
    success: 'Успех',
    partial: 'Частично',
    fail: 'Провал',
  },
  debrief: {
    title: 'Разбор',
    yourPath: 'Ваш путь',
    expertPath: 'Путь наставника',
    lesson: 'Что важно',
    regulation: 'Регламент',
    score: 'Баллы',
    scoreParts: {
      base: 'За результат',
      timeBonus: 'За скорость',
      competencyBonus: 'За компетенции',
    },
    competencies: 'Компетенции',
    timeoutStep: 'Время вышло',
    onExpert: 'Совпало с наставником',
    better: 'Лучше',
    stepEffects: 'Что изменил этот шаг',
    replay: 'Пройти ещё раз',
    toCatalogue: 'К каталогу',
    unlocked: 'Новые достижения',
  },
  profile: {
    title: 'Профиль',
    xp: 'Опыт',
    toNextLevel: 'До следующего уровня',
    maxLevel: 'Высший уровень',
    scenariosFinished: 'Сценариев пройдено',
    attempts: 'Всего попыток',
    radar: 'Компетенции',
    badges: 'Достижения',
    locked: 'Не получено',
    history: 'История поездок',
    historyEmpty: 'Пока ни одного завершённого сценария.',
    expertRun: 'Путь наставника',
    progress: 'Прогресс уровня',
  },
  leaderboard: {
    title: 'Рейтинг проводников',
    scopes: { crew: 'Бригада', depot: 'Депо', company: 'Компания' },
    scope: 'Охват рейтинга',
    period: 'Период',
    week: 'Неделя',
    all: 'За всё время',
    allDepots: 'Все депо',
    rank: 'Место',
    conductor: 'Проводник',
    depot: 'Депо',
    total: 'Баллы',
    scenarios: 'Сценариев',
    you: 'Вы',
    empty: 'Пока никто не прошёл ни одного сценария.',
    updated: 'Обновлено',
  },
  admin: {
    timeoutEdge: 'Таймаут',
    // v1.1 conditional branches: the label parts, joined into «лояльность < 40 и выбрано «…»».
    branchEdge: 'Условие',
    fallbackEdge: 'иначе',
    branchMeter: { loyalty: 'лояльность', safety: 'безопасность' },
    branchChose: 'выбрано',
    branchAnd: ' и ',
    title: 'Граф сценария',
    subtitle: 'Методистский вид: все ветки, эффекты и компетенции.',
    nodes: 'Узлы',
    edges: 'Переходы',
    start: 'Старт',
    nodeTypes: {
      choice: 'Выбор',
      consequence: 'Последствие',
      end: 'Финал',
    },
    initial: 'Старт шкал',
    thresholds: 'Порог провала',
    notFound: 'Сценарий не найден.',
  },
  common: {
    loading: 'Загрузка…',
    retry: 'Повторить',
    error: 'Что-то пошло не так.',
  },
  engine: {
    // The engine returns the threshold ending with an empty text; the server fills it from here.
    thresholdFail: {
      loyalty: 'Пассажиры потеряли доверие — сценарий прерван.',
      safety: 'Ситуация вышла из-под контроля — сценарий прерван.',
    },
  },
  // The five competency axes on the profile radar, in COMPETENCIES order.
  competencies: {
    conflict: 'Урегулирование конфликтов',
    medical: 'Медицинская помощь',
    safety: 'Безопасность и регламент',
    service: 'Премиальный сервис',
    communication: 'Коммуникация',
  } satisfies Record<Competency, string>,
  // Ranks, shared by the overall level and the per-competency ones. Cosmetic, but GET /me returns
  // the key, so the words have to live somewhere that is not a component.
  levels: {
    trainee: 'Стажёр',
    conductor: 'Проводник',
    senior: 'Старший',
    mentor: 'Наставник',
  } satisfies Record<LevelKey, string>,
  // Badge copy, keyed by the codes in packages/shared/src/achievements.ts — the conditions live
  // there, the words live here, and there is no catalogue table holding a third copy. The
  // `satisfies` is the guard: a new code with no Russian for it fails typecheck.
  // Icons are deliberately absent: mapping a code to a lucide name is the frontend's business.
  achievements: {
    'first-run': {
      title: 'Первый рейс',
      description: 'Завершите первый сценарий — с любым результатом.',
    },
    'cool-head': {
      title: 'Хладнокровие',
      description: 'Пять завершённых сценариев, и ни одного просроченного таймера.',
    },
    'first-aid': {
      title: 'Первая помощь',
      description: 'Медицинский сценарий пройден на «успех», без просроченных таймеров.',
    },
    diplomat: {
      title: 'Дипломат',
      description: 'Конфликт улажен: лояльность и безопасность не ниже 80.',
    },
    'night-shift': {
      title: 'Ночная смена',
      description: 'Три сценария завершены в течение одного часа.',
    },
    flawless: {
      title: 'Без единой ошибки',
      description: 'Пройден путь эксперта: все решения из разбора.',
    },
    balance: {
      title: 'Равновесие',
      description: 'Сценарий завершён без провала, обе шкалы не ниже 80.',
    },
    steady: {
      title: 'Регулярность',
      description: 'Тренировки в три разных дня.',
    },
    'full-route': {
      title: 'Полный маршрут',
      description: 'Пройдены все сценарии из каталога.',
    },
    'honour-student': {
      title: 'Отличник',
      description: 'Не менее 115 очков за один сценарий.',
    },
  } satisfies Record<AchievementCode, { title: string; description: string }>,
  // API error bodies. The UI shows these, so they are copy, not log lines.
  // Auto mode: an endless stream of LLM-drafted scenarios, served from a pre-filled pool.
  auto: {
    title: 'Автоматический режим',
    cta: 'Автоматический режим',
    hint: 'Бесконечная практика: новые сценарии, которые готовит ИИ. В рейтинге не учитываются.',
    generating: 'Готовим новый сценарий…',
    generatingHint: 'Это занимает до минуты. Страница обновится сама.',
    gaveUp: 'Сценарий не успел подготовиться. Попробуйте ещё раз через пару минут.',
    draftChip: 'ИИ-черновик',
    next: 'Следующий сценарий',
  },
  // The daily card on the home screen. MSK days: the streak burns at the conductor's midnight.
  daily: {
    eyebrow: 'Сценарий дня',
    done: 'Пройден сегодня',
    start: 'Пройти сценарий дня',
    again: 'Пройти ещё раз',
    streak: 'Серия',
    days: 'дн.',
    streakAtRisk: 'Сгорит сегодня в 23:59 — пройдите любой сценарий',
    streakKept: 'Сегодня серия продлена',
    streakNone: 'Проходите сценарий каждый день, чтобы собрать серию',
  },
  // The bell. Functions, because each line carries a title or a count.
  notifications: {
    title: 'Уведомления',
    unread: (n: number) => `Уведомления, непрочитанных: ${n}`,
    empty: 'Новых уведомлений нет.',
    streak: (days: number) => `Серия ${days} дн. сгорит сегодня в 23:59`,
    daily: (title: string) => `Сценарий дня ещё не пройден: «${title}»`,
    weekly: (title: string, days: number) =>
      `Недельные очки за «${title}» обнулятся через ${days} дн. Пройдите его снова`,
    badge: (title: string) => `Новый значок: «${title}»`,
    newScenario: (title: string) => `Новый сценарий: «${title}»`,
  },
  errors: {
    llmNotConfigured: 'Автоматический режим не настроен: на сервере не задан доступ к модели.',
    llmDailyLimit:
      'Лимит новых сценариев на сегодня исчерпан. Загляните завтра или пройдите сценарии из каталога.',
    unauthorized: 'Войдите в систему, чтобы продолжить.',
    badRequest: 'Некорректный запрос.',
    badCredentials: 'Неверный email или пароль.',
    tooManyLogins: 'Слишком много попыток входа. Подождите минуту и попробуйте снова.',
    demoInviteRequired: 'Демо-доступ открывается по ссылке-приглашению.',
    demoUserMissing: 'Демо-доступ на этом сервере не настроен.',
    scenarioNotFound: 'Сценарий не найден.',
    sessionNotFound: 'Сессия не найдена.',
    staleStep: 'Этот шаг уже сделан. Обновите страницу.',
    sessionNotFinished: 'Сценарий ещё не завершён.',
    debriefUnavailable: 'Разбор для этой сессии недоступен.',
  },
} as const
