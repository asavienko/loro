/** Independent JSON Schema compiler catches generator errors, not just Zod self-consistency. */
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import Ajv2020Module from 'ajv/dist/2020.js'
import type { ValidateFunction } from 'ajv'

const Ajv2020 = (Ajv2020Module as unknown as { default?: unknown }).default ?? Ajv2020Module
interface Compiler {
  compile(schema: object): ValidateFunction
}
type Constructor = new (opts: { strict: boolean; validateFormats: boolean }) => Compiler

for (const kind of ['current', 'target'] as const) {
  it(`compiles every generated ${kind} OpenAPI component with an independent validator`, () => {
    const doc: unknown = JSON.parse(
      readFileSync(
        new URL(`../../../docs/architecture/openapi.${kind}.json`, import.meta.url),
        'utf8',
      ),
    )
    if (
      typeof doc !== 'object' ||
      doc === null ||
      !('components' in doc) ||
      typeof doc.components !== 'object' ||
      doc.components === null ||
      !('schemas' in doc.components) ||
      typeof doc.components.schemas !== 'object' ||
      doc.components.schemas === null
    )
      throw new Error('Invalid OpenAPI components')
    const names = Object.keys(doc.components.schemas)
    expect(names.length).toBeGreaterThan(10)
    const compiler = new (Ajv2020 as Constructor)({ strict: false, validateFormats: false })
    // Reference the real component paths; malformed or dangling references fail compilation.
    expect(() =>
      compiler.compile({
        components: doc.components,
        anyOf: names.map((name) => ({ $ref: `#/components/schemas/${name}` })),
      }),
    ).not.toThrow()
  })
}
