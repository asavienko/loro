/**
 * RFC 9457 problem details for every error.
 *
 * Never leaks a stack trace, an internal identifier, or SQL text — an unknown error
 * becomes a bare INTERNAL. See docs/architecture/security-privacy.md#server-hardening
 *
 * The filter decides WHICH problem describes the exception; `errors.ts` owns what the
 * body looks like. Keeping those apart is what stops a fourth error case from inventing
 * a fourth spelling of the same JSON.
 */

import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import {
  LoroError,
  PROBLEM_MEDIA_TYPE,
  toHttpProblemDetails,
  toProblemDetails,
  type ProblemDetails,
} from './errors.js'

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('error')

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const problem = this.problemFor(exception, ctx.getRequest<Request>())
    const response = ctx.getResponse<Response>()
    if (/^\/v1\/auth\//i.test(ctx.getRequest<Request>().path))
      response.setHeader('Cache-Control', 'no-store')
    response.status(problem.status).type(PROBLEM_MEDIA_TYPE).json(problem)
  }

  private problemFor(exception: unknown, req: Request): ProblemDetails {
    if (exception instanceof LoroError) return toProblemDetails(exception)
    if (exception instanceof HttpException) {
      return toHttpProblemDetails(exception.getStatus(), exception.message)
    }
    // An error we did not model: log the detail, return none of it. `user_id` only —
    // never a payload.
    this.logger.error(
      /^\/v1\/auth\//i.test(req.path)
        ? `${req.method} /v1/auth/[redacted] — internal error`
        : `${req.method} ${req.url} — ${String(exception)}`,
    )
    return toProblemDetails(exception)
  }
}
