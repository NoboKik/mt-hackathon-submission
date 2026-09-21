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
    replay: 'Пройти ещё раз',
  },
  nav: {
    scenarios: 'Сценарии',
    profile: 'Профиль',
    leaderboard: 'Рейтинг',
    signOut: 'Выйти',
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
    timeLeft: 'Осталось',
    seconds: 'с',
    timedOut: 'Время вышло — решение принято за вас.',
    continue: 'Дальше',
    toDebrief: 'Разбор',
    loading: 'Готовим сценарий…',
    // The countdown is announced to screen readers only at these points, not every tick.
    timerLabel: 'Таймер решения',
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
    replay: 'Пройти ещё раз',
    toCatalogue: 'К каталогу',
    unlocked: 'Новые достижения',
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
  // The methodologist's scenario graph.
  admin: {
    timeoutEdge: 'Таймаут',
  },
  // API error bodies. The UI shows these, so they are copy, not log lines.
  errors: {
    unauthorized: 'Войдите в систему, чтобы продолжить.',
    badRequest: 'Некорректный запрос.',
    badCredentials: 'Неверный email или пароль.',
    demoUserMissing: 'Демо-пользователь не найден. Запустите pnpm db:seed.',
    scenarioNotFound: 'Сценарий не найден.',
    sessionNotFound: 'Сессия не найдена.',
    staleStep: 'Этот шаг уже сделан. Обновите страницу.',
    sessionNotFinished: 'Сценарий ещё не завершён.',
    debriefUnavailable: 'Разбор для этой сессии недоступен.',
  },
} as const
