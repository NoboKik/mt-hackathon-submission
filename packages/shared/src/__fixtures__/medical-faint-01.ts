import type { Scenario } from '../schema'

// Valid reference scenario for the validator tests: 7 nodes, 3 endings, expert path c1 → c4 → c7.
// Tests structuredClone it and break one thing at a time.
export const medicalFaint01 = {
  id: 'medical-faint-01',
  title: 'Пассажиру плохо в вагоне бизнес-класса',
  category: 'medical',
  difficulty: 2,
  estimatedMinutes: 5,
  intro:
    'Рейс ВСМ Москва — Санкт-Петербург, вагон бизнес-класса. Поезд идёт 380 км/ч, до ближайшей остановки 40 минут. Медик поезда — в штабном вагоне, диспетчер на связи по рации.',
  start: 'n1',
  initial: { loyalty: 70, safety: 70 },
  failThresholds: { loyalty: 20, safety: 20 },
  nodes: {
    n1: {
      type: 'choice',
      speaker: 'narrator',
      text: 'Женщина у окна побледнела и медленно сползает по креслу. Сосед машет вам рукой.',
      image: 'cabin-business.jpg',
      timerSec: 15,
      onTimeout: 'n1_timeout',
      choices: [
        {
          id: 'c1',
          text: 'Подойти, спросить, что случилось, и проверить сознание',
          effects: { loyalty: 5, safety: 10 },
          competencies: { medical: 2, communication: 1 },
          next: 'n2',
        },
        {
          id: 'c2',
          text: 'Сразу объявить по громкой связи: есть ли в поезде врач?',
          effects: { loyalty: -5, safety: 5 },
          competencies: { communication: 1 },
          next: 'n3',
        },
        {
          id: 'c3',
          text: 'Успокоить соседей и оставить как есть: наверное, просто укачало',
          effects: { loyalty: 10, safety: -10 },
          competencies: { service: 1, medical: -1 },
          next: 'n2',
        },
      ],
    },
    n1_timeout: {
      type: 'consequence',
      text: 'Вы замешкались. Сосед начинает паниковать и зовёт на помощь на весь вагон.',
      effects: { loyalty: -15, safety: -10 },
      next: 'n2',
    },
    n2: {
      type: 'choice',
      speaker: 'passenger',
      text: 'Пассажирка в сознании, но отвечает вяло, на лбу холодный пот. «С утра ничего не ела… душно».',
      timerSec: 15,
      onTimeout: 'end_fail',
      choices: [
        {
          id: 'c4',
          text: 'Уложить в кресле, не поднимать и вызвать медика поезда по рации',
          effects: { loyalty: 5, safety: 10 },
          competencies: { medical: 2, communication: 1 },
          next: 'n3',
        },
        {
          id: 'c5',
          text: 'Помочь встать и отвести в тамбур: там прохладнее',
          effects: { loyalty: 5, safety: -20 },
          competencies: { medical: -2 },
          next: 'end_fail',
        },
        {
          id: 'c6',
          text: 'Принести сладкий чай и понаблюдать, никого не вызывая',
          effects: { loyalty: 10, safety: -5 },
          competencies: { service: 1, medical: -1 },
          next: 'end_partial',
        },
      ],
    },
    n3: {
      type: 'choice',
      speaker: 'narrator',
      text: 'Медик идёт из штабного вагона, будет через три минуты. Вокруг собираются пассажиры, кто-то снимает на телефон.',
      timerSec: 12,
      onTimeout: 'end_fail',
      choices: [
        {
          id: 'c7',
          text: 'Попросить всех вернуться на места, освободить проход и доложить диспетчеру',
          effects: { loyalty: 5, safety: 10 },
          competencies: { communication: 2, safety: 1 },
          next: 'end_good',
        },
        {
          id: 'c8',
          text: 'Объявить по громкой связи о медицинской ситуации в вагоне',
          effects: { loyalty: -10, safety: 5 },
          competencies: { communication: 1 },
          next: 'end_partial',
        },
        {
          id: 'c9',
          text: 'Уйти встречать медика, оставив пассажирку с соседями',
          effects: { loyalty: -5, safety: -15 },
          competencies: { medical: -1 },
          next: 'end_fail',
        },
      ],
    },
    end_good: {
      type: 'end',
      outcome: 'success',
      text: 'Медик принял пассажирку: давление низкое, но состояние стабильное. Вагон спокоен, диспетчер в курсе.',
      debrief: {
        expertPath: ['c1', 'c4', 'c7'],
        lesson:
          'Сначала оценка состояния, затем вызов медика через рацию, затем порядок в вагоне и доклад диспетчеру.',
        regulation: 'Инструкция по оказанию первой помощи, п. 3.2',
      },
    },
    end_partial: {
      type: 'end',
      outcome: 'partial',
      text: 'Пассажирке стало лучше, но вагон встревожен, а порядок действий нарушен.',
      debrief: {
        expertPath: ['c1', 'c4', 'c7'],
        lesson:
          'Медика вызывают всегда, даже если пассажиру стало лучше. Громкая связь — для ситуаций, касающихся всего поезда, а не одного пассажира.',
        regulation: 'Инструкция по оказанию первой помощи, п. 3.2',
      },
    },
    end_fail: {
      type: 'end',
      outcome: 'fail',
      text: 'Пассажирка потеряла сознание. Диспетчеру пришлось вызывать скорую к ближайшей станции.',
      debrief: {
        expertPath: ['c1', 'c4', 'c7'],
        lesson:
          'Пассажира с предобморочным состоянием не поднимают и не оставляют одного. Каждая минута промедления работает против вас.',
        regulation: 'Инструкция по оказанию первой помощи, п. 3.2',
      },
    },
  },
} satisfies Scenario
