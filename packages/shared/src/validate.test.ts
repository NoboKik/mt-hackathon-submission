import { describe, expect, test } from 'vitest'
import { medicalFaint01 } from './__fixtures__/medical-faint-01'
import { validateScenario } from './validate'

type Fixture = typeof medicalFaint01
// Loose view for mutations the fixture's type rightly forbids (deleting nodes, unknown keys).
type Loose = Record<string, unknown> & { nodes: Record<string, unknown> }

const end = (outcome: string) => ({
  type: 'end',
  outcome,
  text: 'Конец',
  debrief: { expertPath: ['c1'], lesson: 'Урок', regulation: 'Регламент' },
})

// Clone the fixture, apply one mutation, validate, return the errors (empty if valid).
function errorsAfter(mutate: (s: Fixture & Loose) => void, fileId = 'medical-faint-01') {
  const s = structuredClone(medicalFaint01) as Fixture & Loose
  mutate(s)
  const r = validateScenario(s, fileId)
  return r.ok ? [] : r.errors
}

const expectError = (errors: string[], text: string) =>
  expect(errors).toContainEqual(expect.stringContaining(text))

test('fixture is valid', () => {
  const r = validateScenario(medicalFaint01, 'medical-faint-01')
  expect(r).toEqual({ ok: true, scenario: medicalFaint01 })
  expect(validateScenario(medicalFaint01).ok).toBe(true)
})

describe('schema', () => {
  test('rejects an unknown top-level key with a (root) path', () => {
    expectError(
      errorsAfter((s) => {
        s.titel = 'опечатка'
      }),
      '(root): ',
    )
  })

  test('rejects an unknown key on a choice', () => {
    expectError(
      errorsAfter((s) => {
        Object.assign(s.nodes.n1.choices[0] ?? {}, { score: 10 })
      }),
      'nodes.n1.choices.0: ',
    )
  })

  test('rejects more than 2 competencies on a choice', () => {
    expectError(
      errorsAfter((s) => {
        Object.assign(s.nodes.n1.choices[0] ?? {}, {
          competencies: { medical: 1, communication: 1, safety: 1 },
        })
      }),
      'nodes.n1.choices.0.competencies: at most 2 competencies',
    )
  })

  test('rejects a competency delta of 3', () => {
    expectError(
      errorsAfter((s) => {
        Object.assign(s.nodes.n1.choices[0] ?? {}, { competencies: { medical: 3 } })
      }),
      'nodes.n1.choices.0.competencies.medical: ',
    )
  })

  test('rejects an unknown competency key', () => {
    expectError(
      errorsAfter((s) => {
        Object.assign(s.nodes.n1.choices[0] ?? {}, { competencies: { empathy: 1 } })
      }),
      'nodes.n1.choices.0.competencies',
    )
  })

  test('rejects timerSec 9', () => {
    expectError(
      errorsAfter((s) => {
        s.nodes.n1.timerSec = 9
      }),
      'nodes.n1.timerSec: ',
    )
  })

  test.each(['loyalty', 'safety'] as const)('rejects failThresholds.%s not below initial', (m) => {
    expectError(
      errorsAfter((s) => {
        s.failThresholds[m] = s.initial[m]
      }),
      `failThresholds.${m}: must be below initial.${m} (70)`,
    )
  })

  test('rejects a non-kebab-case id', () => {
    expectError(
      errorsAfter((s) => {
        s.id = 'Medical_Faint'
      }, 'Medical_Faint'),
      'id: must be kebab-case',
    )
  })

  test('survives garbage input without throwing', () => {
    for (const input of [null, 42, 'сценарий', [], {}, { failThresholds: 5 }]) {
      const r = validateScenario(input)
      expect(r.ok).toBe(false)
    }
  })
})

describe('graph checks', () => {
  test('1. start must exist', () => {
    expectError(
      errorsAfter((s) => {
        s.start = 'n0'
      }),
      'start: node "n0" does not exist',
    )
  })

  test.each([
    ['a choice next', (s: Fixture) => Object.assign(s.nodes.n2.choices[0] ?? {}, { next: 'n9' })],
    ['an onTimeout', (s: Fixture) => Object.assign(s.nodes.n2, { onTimeout: 'n9' })],
    ['a consequence next', (s: Fixture) => Object.assign(s.nodes.n1_timeout, { next: 'n9' })],
  ])('2. %s must point to an existing node', (_, mutate) => {
    expectError(errorsAfter(mutate), 'links to missing node "n9"')
  })

  test('3. id must match the file name', () => {
    expectError(
      errorsAfter(() => {}, 'medical-faint-02'),
      'id: "medical-faint-01" does not match file name "medical-faint-02"',
    )
  })

  test('4. at most 12 nodes', () => {
    const errors = errorsAfter((s) => {
      for (let i = 0; i < 6; i++) s.nodes[`extra${i}`] = { ...s.nodes.n1_timeout, next: 'end_good' }
    })
    expectError(errors, 'nodes: 13 nodes, expected 6–12')
  })

  test('4. at least 6 nodes', () => {
    const errors = errorsAfter((s) => {
      delete s.nodes.n3
      delete s.nodes.n1_timeout
    })
    expectError(errors, 'nodes: 5 nodes, expected 6–12')
  })

  test('5. at most 4 end nodes', () => {
    const errors = errorsAfter((s) => {
      s.nodes.end_extra1 = end('fail')
      s.nodes.end_extra2 = end('fail')
    })
    expectError(errors, 'nodes: 5 end nodes, expected 2–4')
  })

  test('5. at least 2 end nodes', () => {
    const errors = errorsAfter((s) => {
      s.nodes.end_partial = { ...s.nodes.n1_timeout, next: 'end_fail' }
      s.nodes.end_good = { ...s.nodes.n1_timeout, next: 'end_fail' }
    })
    expectError(errors, 'nodes: 1 end nodes, expected 2–4')
  })

  test('6. choice ids are unique across the scenario', () => {
    expectError(
      errorsAfter((s) => {
        Object.assign(s.nodes.n3.choices[1] ?? {}, { id: 'c1' })
      }),
      'node "n3": choice id "c1" is already used',
    )
  })

  test('7. expertPath ids must be existing choices', () => {
    expectError(
      errorsAfter((s) => {
        s.nodes.end_good.debrief.expertPath = ['c1', 'c4', 'c77']
      }),
      'node "end_good": expertPath choice "c77" does not exist',
    )
  })

  test('8. every node is reachable from start', () => {
    expectError(
      errorsAfter((s) => {
        s.nodes.orphan = { ...s.nodes.n1_timeout, next: 'end_good' }
      }),
      'node "orphan": unreachable from start',
    )
  })

  test('8. an end reachable only through onTimeout counts as reachable', () => {
    expect(
      errorsAfter((s) => {
        s.nodes.end_timeout = end('fail')
        s.nodes.n3.onTimeout = 'end_timeout'
      }),
    ).toEqual([])
  })

  test('9. no cycles', () => {
    expectError(
      errorsAfter((s) => {
        Object.assign(s.nodes.n3.choices[1] ?? {}, { next: 'n1' })
      }),
      'node "n3": link to "n1" closes a cycle',
    )
  })

  test('9. a self-loop is a cycle', () => {
    expectError(
      errorsAfter((s) => {
        Object.assign(s.nodes.n2.choices[0] ?? {}, { next: 'n2' })
      }),
      'node "n2": link to "n2" closes a cycle',
    )
  })

  test('9. a cycle closed only by an onTimeout link is a cycle', () => {
    // n2 → n3 --timeout--> n1_timeout → n2; DFS from n1 meets it at n1_timeout.
    expect(
      errorsAfter((s) => {
        s.nodes.n3.onTimeout = 'n1_timeout'
      }),
    ).toEqual(['node "n1_timeout": link to "n2" closes a cycle'])
  })

  test('10. at least one loyalty-vs-safety trade-off', () => {
    const errors = errorsAfter((s) => {
      for (const id of ['n1', 'n2', 'n3'] as const) {
        for (const c of s.nodes[id].choices) c.effects = { loyalty: 5, safety: 5 }
      }
    })
    expect(errors).toEqual([
      'nodes: no choice trades loyalty against safety (opposite-sign effects)',
    ])
  })

  test('collects every graph error instead of stopping at the first', () => {
    const errors = errorsAfter((s) => {
      s.start = 'n0'
      s.nodes.n1_timeout.next = 'n9'
    }, 'other-id')
    expect(errors).toHaveLength(3)
  })
})
