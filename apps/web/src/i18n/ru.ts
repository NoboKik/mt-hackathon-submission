import type { AchievementCode, Competency, LevelKey } from '@p400/shared'

// «2 раза», but «1 раз» and «5 раз»: only the «few» form differs.
const times = (n: number) =>
  `${n} ${new Intl.PluralRules('ru').select(n) === 'few' ? 'раза' : 'раз'}`

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
    analytics: 'Аналитика',
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
    begin: 'Начать',
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
    // «Зоны роста»: conclusions, not a table. Built from GET /api/me's `growth`.
    growth: {
      title: 'Зоны роста',
      weakest: (axis: string, points: number, others: number) =>
        `Слабее всего сейчас «${axis}»: ${points} при среднем ${others} по остальным компетенциям.`,
      offExpert: (category: string, percent: number) =>
        `В теме «${category}» с выбором наставника расходятся ${percent}\u00a0% ваших решений`,
      allExpert: 'Во всех темах ваши решения совпадают с выбором наставника',
      timeouts: (percent: number) =>
        percent > 0
          ? `; время на выбор истекло в ${percent}\u00a0% случаев.`
          : '; ни одного решения по таймауту.',
      // Choice texts carry their own «»; nested quotes are „“ in Russian typography.
      mistake: (text: string, title: string, count: number) => {
        const quoted = `«${text.replaceAll('«', '„').replaceAll('»', '“')}» в сценарии «${title}»`
        return count > 1
          ? `Самая частая ошибка — ${quoted} (${times(count)}).`
          : `Ошибка для разбора — ${quoted}.`
      },
      noDecisions: 'Выводы о решениях и таймаутах появятся после следующей поездки.',
      recommended: 'Рекомендуем',
      start: 'Пройти',
    },
    // GET /api/me's `standing`: the leaderboard's all-time total against the company and crew.
    standing: {
      title: 'Сравнение с коллегами',
      percentile: 'Относительно компании',
      better: (percent: number) => `лучше ${percent}\u00a0%`,
      betterHint: 'проводников по баллам рейтинга',
      alone: 'Сравнить пока не с кем.',
      crew: 'Против бригады',
      crewHint: (average: number, size: number) =>
        `ваши баллы против среднего ${average} по бригаде (${size}\u00a0чел.)`,
      noCrew: 'Бригада не назначена.',
    },
    readiness: {
      title: 'Готовность к бизнес/первому классу',
      ready: 'Готов к переводу',
      notReady: 'Пока не готов',
      criteria: {
        service: 'Премиальный сервис, баллов',
        conflict: 'Урегулирование конфликтов, баллов',
        communication: 'Коммуникация, баллов',
        serviceBest: 'Лучший результат в сервисном сценарии',
      },
    },
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
  analytics: {
    title: 'Аналитика бригады',
    subtitle: 'По завершённым прогонам сценариев из каталога.',
    depot: 'Депо',
    crew: 'Бригада',
    allDepots: 'Все депо',
    allCrews: 'Все бригады',
    conductors: 'Проводников',
    runs: 'Прогонов',
    competencies: 'Компетенции, баллов на проводника',
    // «Зона роста: Медицинская помощь — 1,2 на проводника, в среднем по остальным 4,5.
    // Чаще всего ошибаются в «…»: провалы 3, таймауты 2.»
    weakestLead: 'Зона роста',
    worstLead: 'Чаще всего ошибаются в',
    perConductor: 'на проводника',
    againstAvg: 'в среднем по остальным',
    nodes: 'Где ошибаются чаще всего',
    nodesHint:
      'Таймауты и провалы на узле выбора; провал — последнее решение перед неудачным финалом.',
    timeouts: 'Таймауты',
    fails: 'Провалы',
    visits: 'решений',
    noRuns: 'В этой выборке ещё нет завершённых прогонов.',
    readiness: 'Готовность к бизнес/первому классу',
    readinessHint: 'Пороги по сервису, конфликтам и коммуникации плюс успех в сервисном сценарии.',
    readinessSummary: (ready: number, total: number) => `Готовы к переводу: ${ready} из ${total}.`,
    ready: 'Готов',
    noPeople: 'В этой выборке нет сотрудников.',
    noNodes:
      'Нет таймаутов и провалов с записанным путём: сид хранит только итоги, узлы появятся после живых прогонов.',
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
    staleStep: 'Этот шаг уже засчитан. Начните сценарий заново.',
    sessionNotFinished: 'Сценарий ещё не завершён.',
    debriefUnavailable: 'Разбор для этой сессии недоступен.',
    integrationOff: 'Интеграционный API на этом сервере выключен.',
    passwordRequired: 'Для нового сотрудника нужен начальный пароль.',
    emailTaken: 'Этот email уже занят другим сотрудником.',
    analyticsForbidden:
      'Аналитика бригад доступна начальникам поездов и методистам. Свой прогресс и «Зоны роста» — в профиле.',
  },
} as const
