/** Build-time tooling only. Not exported to app consumers. F-04. */
import { z } from 'zod'
import type { Operation, Payload } from '../api/operation.js'
import { currentOperations } from '../api/current.js'
import { targetOperations, targetComponents } from '../api/target.js'
import { draftOperations, draftComponents } from '../api/draft.js'

type JsonObject = Record<string, unknown>
export function buildOpenApi(kind: 'current' | 'target') {
  const operations: readonly Operation[] =
    kind === 'current' ? currentOperations : [...targetOperations, ...draftOperations]
  const schemas: Record<string, JsonObject> = {}
  const seen = new Map<z.ZodType, Partial<Record<'input' | 'output', string>>>()
  function reference(schema: z.ZodType, name: string, io: 'input' | 'output') {
    const prior = seen.get(schema)?.[io]
    if (prior) return { $ref: `#/components/schemas/${prior}` }
    const converted = z.toJSONSchema(schema, {
      target: 'draft-2020-12',
      io,
      unrepresentable: 'throw',
    })
    // The OpenAPI document owns the dialect. Components inherit it.
    delete converted.$schema
    schemas[name] = converted
    seen.set(schema, { ...seen.get(schema), [io]: name })
    return { $ref: `#/components/schemas/${name}` }
  }
  function media(payload: Payload, name: string, io: 'input' | 'output') {
    return {
      schema: reference(payload.schema, name, io),
      ...(payload.examples
        ? {
            examples: Object.fromEntries(payload.examples.map((e) => [e.name, { value: e.value }])),
          }
        : {}),
    }
  }
  const paths: Record<string, Record<string, JsonObject>> = {}
  for (const op of operations) {
    const parameters = (['query', 'path', 'header'] as const).flatMap((location) => {
      const definitions =
        location === 'query' ? op.query : location === 'path' ? op.pathParams : op.headers
      return Object.entries(definitions ?? {}).map(([name, schema]) => ({
        name,
        in: location,
        required: location === 'path' || !schema.safeParse(undefined).success,
        schema: reference(schema, `${op.id}_${location}_${name.replace(/-/g, '_')}`, 'input'),
      }))
    })
    const responses: Record<string, JsonObject> = {}
    for (const [status, response] of Object.entries(op.responses)) {
      const mediaType = response.mediaType ?? 'application/json'
      responses[status] = {
        description:
          response.description ??
          (Number(status) < 400 ? op.summary : 'RFC 9457 problem; code selects recovery.'),
        ...(Number(status) === 204 || Number(status) === 304
          ? {}
          : {
              content: {
                [mediaType]: media(response, `${op.id}_${status}`, 'output'),
                ...(response.alternate
                  ? {
                      [response.alternate.mediaType]: media(
                        response.alternate,
                        `${op.id}_${status}_events`,
                        'output',
                      ),
                    }
                  : {}),
              },
            }),
        ...(response.headers
          ? {
              headers: Object.fromEntries(
                Object.entries(response.headers).map(([name, schema]) => [
                  name,
                  {
                    schema: reference(
                      schema,
                      `${op.id}_${status}_${name.replace(/-/g, '_')}`,
                      'output',
                    ),
                  },
                ]),
              ),
            }
          : {}),
      }
    }
    const security =
      op.auth === 'none'
        ? []
        : op.auth === 'staff'
          ? [{ staffBearer: [] }]
          : op.auth === 'provider-signature'
            ? []
            : [{ bearerAuth: [] }]
    const operation: JsonObject = {
      operationId: op.id,
      summary: op.summary,
      description: op.behavior,
      tags: [op.path.split('/')[1]],
      security,
      parameters,
      responses,
      'x-loro-auth-boundary': op.auth,
      'x-loro-status': op.status,
      'x-loro-owner-plan': op.owner,
      'x-loro-requirements': op.requirements,
      ...(op.gates ? { 'x-loro-gates': op.gates } : {}),
      ...(op.unresolved ? { 'x-loro-unresolved': op.unresolved } : {}),
      ...(op.maxBodyBytes ? { 'x-loro-max-body-bytes': op.maxBodyBytes } : {}),
      ...(op.request
        ? {
            requestBody: {
              required: true,
              ...(op.request.description ? { description: op.request.description } : {}),
              content: { 'application/json': media(op.request, `${op.id}_request`, 'input') },
            },
          }
        : {}),
    }
    const path = paths[op.path] ?? {}
    if (path[op.method]) throw new Error(`Duplicate operation ${op.method} ${op.path}`)
    path[op.method] = operation
    paths[op.path] = path
  }
  if (kind === 'target') {
    for (const [name, schema] of Object.entries(targetComponents)) reference(schema, name, 'output')
    for (const [name, draft] of Object.entries(draftComponents)) {
      const ref = reference(draft.schema, name, 'input')
      const key = ref.$ref.split('/').at(-1)
      if (key)
        schemas[key] = {
          ...schemas[key],
          'x-loro-status': 'draft',
          'x-loro-gates': draft.gates,
          'x-loro-unresolved': draft.unresolved,
        }
    }
  }
  return {
    openapi: '3.1.0',
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: {
      title: `Loro ${kind} API`,
      version: '1.0.0',
      description:
        kind === 'current'
          ? 'Observed development API. No authentication, tenant isolation or durable storage. Not for multi-user deployment.'
          : 'Planned API, not implemented. Draft operations/components are non-release contracts with explicit gates. Runtime refinements are documented in api-contracts.md.',
    },
    servers: [{ url: kind === 'current' ? 'http://localhost:3000/v1' : 'https://api.loro.app/v1' }],
    paths,
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        staffBearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Verified staff authorization required, not merely any bearer token.',
        },
      },
    },
  }
}
export function serializeOpenApi(kind: 'current' | 'target') {
  return `${JSON.stringify(buildOpenApi(kind), null, 2)}\n`
}
