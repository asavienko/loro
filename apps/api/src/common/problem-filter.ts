/**
 * RFC 9457 problem details for every error.
 *
 * Never leaks a stack trace, an internal identifier, or SQL text — an unknown error
 * becomes a bare INTERNAL. See docs/architecture/security-privacy.md#server-hardening
 */

import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { LoroError, toProblemDetails } from './errors.js'

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('error')

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    if (exception instanceof LoroError) {
      const problem = toProblemDetails(exception)
      res.status(problem.status).type('application/problem+json').json(problem)
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      res
        .status(status)
        .type('application/problem+json')
        .json({
          type: 'https://loro.app/errors/http',
          title: exception.message,
          status,
          code: status === 404 ? 'NOT_FOUND' : 'INTERNAL',
        })
      return
    }

    // Log the detail; return none of it. `user_id` only — never a payload.
    this.logger.error(`${req.method} ${req.url} — ${String(exception)}`)
    const problem = toProblemDetails(exception)
    res.status(problem.status).type('application/problem+json').json(problem)
  }
}
