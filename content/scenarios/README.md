# Scenario slots

One JSON file per scenario, named `<id>.json` — the file name **is** the `id`, and
`pnpm validate:content` fails the build if they differ. The schema is frozen at `schema-v1`
(see [`packages/shared/src/schema.ts`](../../packages/shared/src/schema.ts)).

Target for the 25 Sept checkpoint: **8 scenarios** — all eight written (22 Sept 2026).
`medical-faint-01.json` is the worked example — copy it and rewrite.

## Slots

| # | File | Title | Category | Difficulty | Core tension |
| --- | --- | --- | --- | --- | --- |
| 1 | `medical-faint-01.json` ✅ | Пассажиру плохо в вагоне бизнес-класса | `medical` | 2 | Speed of assessment vs panic control |
| 2 | `conflict-seat-01.json` ✅ | Конфликт из-за места у окна | `conflict` | 1 | Fairness vs premium expectations |
| 3 | `service-meal-01.json` ✅ | Не загружено питание для первого класса | `service` | 1 | Service recovery within compensation policy |
| 4 | `safety-smoking-01.json` ✅ | Курение в туалете | `safety` | 1 | Enforcement vs conflict |
| 5 | `conflict-drunk-01.json` ✅ | Нетрезвый пассажир мешает соседям | `conflict` | 2 | Loyalty of the others vs escalation |
| 6 | `communication-delay-01.json` ✅ | Задержка на 40 минут | `communication` | 2 | Information cadence, compensation, tone |
| 7 | `safety-bag-01.json` ✅ | Бесхозная сумка в тамбуре | `safety` | 3 | Protocol vs not alarming the car |
| 8 | `medical-allergy-01.json` ✅ | Аллергическая реакция после обеда | `medical` | 3 | The passenger's own auto-injector, a doctor via the начальник поезда, allergen policy |

`conflict-seat-01` is how `diplomat` (Дипломат) unlocks: its expert path ends at 85/85.

The spread is deliberate: all five categories are covered, difficulty lands on 3×1, 3×2, 2×3, and
the profile radar only fills in if choices spend competency points across all five axes.

## What the validator enforces

`pnpm validate:content` rejects a file that breaks any of these, so check before committing:

- `id` matches the file name; kebab-case, lowercase letters, digits and `-`.
- 6–12 nodes, 2–4 `end` nodes, every node reachable from `start`, no cycles.
- `category` is one of `conflict` `medical` `safety` `service` `communication`.
- `difficulty` 1–3, `estimatedMinutes` 3–7.
- `failThresholds` strictly below `initial` for both meters.
- Choice nodes: 2–4 choices, `timerSec` 10–20, an `onTimeout` node that exists.
- Choice ids unique across the whole file; every `next` and `onTimeout` points at a real node.
- At most 2 competencies per choice, each delta between -2 and 2.
- **At least one choice with opposite-sign effects** — `effects.loyalty * effects.safety < 0`.
  That trade-off is the whole pedagogy; a scenario without one does not pass.
- Every `debrief.expertPath` id is a real choice id somewhere in the file.

## Writing notes

- Dialogue is read under a countdown. Two sentences per node, not five.
- `timerSec` 10–20: generous timers teach, punitive ones only measure reading speed.
- The timeout branch is a real branch and usually the worst one — write it, do not phone it in.
- **Context** to stay inside (checked 22 Sept 2026 against the public RZD «Регламент организации
  обслуживания пассажиров высокоскоростного поезда „Сапсан“», распоряжение № 2642/р от 27.11.2019 —
  the closest published analogue; ВСМ-400's own standards are not public). Москва — Санкт-Петербург,
  2 ч 15 мин, business and first class, no stop for long stretches, sealed windows, no smoking
  anywhere on board, тамбур included.
  - **Crew**: начальник поезда (leads the crew; the conductor reports every incident and conflict
    to them), бортинженер, проводники, стюарды of the catering company (they serve the meals),
    and two инспекторы ПТБ (transport security). Police (сотрудники полиции) ride only on some
    trains; otherwise the начальник поезда has them meet the train at the next station.
  - **No medic on board.** On a medical case the conductor tells the начальник поезда the
    passenger's state; the начальник pages a doctor among the passengers over the PA,
    calls an ambulance to the nearest station **through the машинист**, and organises first aid. Every car has an
    аптечка первой помощи; there is no documented AED. A conductor may help a passenger take
    medicine the passenger's own doctor prescribed (their own auto-injector, inhaler) — nothing
    from the crew's stock.
  - **Chain of communication**: conductor → начальник поезда → машинист → the outside world
    (dispatcher, ambulance, police). The documented route to an ambulance or police runs through
    the начальник поезда and the машинист; the conductor does not radio the dispatcher.
  - **Violators** (smoking, disorder, a drunk passenger): report to the начальник поезда, the
    инспекторы ПТБ and police on board; no action of your own against the person unless they
    directly endanger others. Only police remove a passenger from the train.
  - **Service recovery**: when the carrier is at fault (a seat downgrade, a missing service), the
    начальник поезда may give the passenger food from the bistro menu. The conductor offers it via
    the начальник поезда, never on their own authority.
- `debrief.lesson` says what an experienced conductor does and why; `debrief.regulation` names
  the rule. That pair is what makes this training rather than a quiz with graphics.
