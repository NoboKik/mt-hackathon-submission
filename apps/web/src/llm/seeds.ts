import type { Competency } from '@p400/shared'

export type IncidentSeed = {
  key: string
  category: Competency
  incident: string
  passenger: string
  circumstance: string
}

const INCIDENT_ROWS: [string, Competency, string][] = [
  ['seat-dispute', 'conflict', 'спор из-за места: у двух пассажиров один и тот же билет'],
  ['drunk-passenger', 'conflict', 'пассажир в состоянии опьянения шумит и задевает соседей'],
  ['filming-staff', 'conflict', 'пассажир снимает проводника на телефон и грозит жалобой'],
  ['bistro-group', 'conflict', 'шумная компания надолго заняла весь вагон-бистро'],
  ['faint', 'medical', 'пассажир потерял сознание в проходе'],
  ['allergy', 'medical', 'аллергическая реакция после перекуса из бистро'],
  ['heart-attack', 'medical', 'подозрение на сердечный приступ: боль в груди, одышка'],
  ['unattended-bag', 'safety', 'бесхозная сумка в тамбуре'],
  ['toilet-smoking', 'safety', 'пассажир курит в туалете'],
  ['vape-alarm', 'safety', 'сработала пожарная сигнализация из-за вейпа'],
  ['lost-child', 'safety', 'ребёнок потерялся в составе, родители в панике'],
  ['no-catering', 'service', 'питание для первого класса не загрузили на станции отправления'],
  ['broken-ac', 'service', 'в вагоне сломался кондиционер, становится душно'],
  ['pet-no-documents', 'service', 'пассажир с животным без ветеринарных документов'],
  ['no-ticket', 'service', 'пассажир без билета уверяет, что купил его онлайн'],
  ['wheelchair-station', 'service', 'пассажиру на коляске нужна помощь при высадке на станции'],
  ['emergency-braking', 'communication', 'экстренное торможение, нужно объявление для вагона'],
  ['missed-connection', 'communication', 'задержка поезда, пассажиры опаздывают на пересадку'],
  ['unplanned-stop', 'communication', 'внеплановая остановка в поле без объяснения причин'],
  ['platform-change', 'communication', 'диспетчер сообщил о смене платформы прибытия'],
]

export const INCIDENTS: readonly { key: string; category: Competency; text: string }[] =
  INCIDENT_ROWS.map(([key, category, text]) => ({ key, category, text }))

// biome-ignore format: keep each list on one line
export const PASSENGERS: readonly string[] = 'пенсионерка, едущая к внукам|бизнесмен на созвоне|мама с маленьким ребёнком|иностранец без русского|подросток, путешествующий один|человек с нарушением слуха|беременная женщина|группа футбольных болельщиков|блогер, ведущий прямой эфир|пожилой мужчина с тростью|студентка с большим чемоданом|постоянный пассажир бизнес-класса'.split('|')

// biome-ignore format: keep each list on one line
export const CIRCUMSTANCES: readonly string[] = 'полный вагон|ночной рейс|подъезжаем к станции|задержка 40 минут|в вагоне один проводник|связь с диспетчером пропадает в тоннеле|поезд идёт на скорости 400 км/ч|конец долгой смены|праздничный рейс перед Новым годом|в соседнем вагоне уже идёт другой инцидент'.split('|')

const pick = <T>(list: readonly T[], rnd: () => number) => list[Math.floor(rnd() * list.length)]

/**
 * used = incident keys of scenarios already generated (one entry per scenario; repeats allowed).
 * Picks the least-used incident (restricted to `category` when given), ties broken by rnd;
 * passenger and circumstance are random via rnd.
 */
export function pickSeed(
  used: readonly string[],
  rnd: () => number = Math.random,
  category?: Competency,
): IncidentSeed {
  const pool = INCIDENTS.filter((i) => !category || i.category === category)
  const count = (key: string) => used.filter((u) => u === key).length
  const min = Math.min(...pool.map((i) => count(i.key)))
  const inc = pick(
    pool.filter((i) => count(i.key) === min),
    rnd,
  )
  return {
    key: inc.key,
    category: inc.category,
    incident: inc.text,
    passenger: pick(PASSENGERS, rnd),
    circumstance: pick(CIRCUMSTANCES, rnd),
  }
}
