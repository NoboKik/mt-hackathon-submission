/**
 * The JSON object in a model reply. Not every provider honours response_format, so this also
 * takes a ```json fence or prose around the object; anything else throws.
 */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1] ?? text
  try {
    return JSON.parse(fenced)
  } catch {
    const from = fenced.indexOf('{')
    const to = fenced.lastIndexOf('}')
    if (from === -1 || to < from) throw new Error('no JSON object in the reply')
    return JSON.parse(fenced.slice(from, to + 1))
  }
}
