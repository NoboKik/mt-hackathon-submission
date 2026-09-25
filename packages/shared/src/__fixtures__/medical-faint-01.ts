import { requireScenario } from '../content'
import type { Scenario } from '../schema'

// The reference scenario for every test that needs a real one: 9 nodes, 3 endings, expert path
// c1 → c4 → c7, one loyalty branch at n3_loud. Read from content/scenarios/ rather than copied
// here: two copies drift. Tests structuredClone it and
// break one thing at a time.
// Node-only (it reads the file): never import this from app code, only from tests.
export const medicalFaint01: Scenario = requireScenario('medical-faint-01')
