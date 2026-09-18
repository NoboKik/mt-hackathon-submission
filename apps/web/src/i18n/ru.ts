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
  },
  engine: {
    // The engine returns the threshold ending with an empty text; the server fills it from here.
    thresholdFail: {
      loyalty: 'Пассажиры потеряли доверие — сценарий прерван.',
      safety: 'Ситуация вышла из-под контроля — сценарий прерван.',
    },
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
