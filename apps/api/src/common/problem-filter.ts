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
    if (exception instanceof LoroError && exception.status === 429) {
      const retry = exception.extra['retry_after']
      if (typeof retry === 'number' && Number.isFinite(retry) && retry > 0)
        response.setHeader('Retry-After', Math.ceil(retry))
    }
    response.status(problem.status).type(PROBLEM_MEDIA_TYPE).json(problem)
  }

  private problemFor(exception: unknown, req: Request): ProblemDetails {
    if (exception instanceof LoroError) return toProblemDetails(exception)
    if (exception instanceof HttpException) {
      return toHttpProblemDetails(exception.getStatus(), exception.message)
    }
    // An error we did not model: log the detail, return none of it. `user_id` only —
    // never a payload.
    // Drivers/providers may put SQL parameters or credentials in exception text.
    // Logs retain only the route and exception class, never the original message.
    this.logger.error(
      `${req.method} ${req.path} — ${exception instanceof Error ? exception.name : 'UnknownError'}`,
    )
    return toProblemDetails(exception)
  }
}
