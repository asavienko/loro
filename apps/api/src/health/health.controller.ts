import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import type { Response } from 'express'
import { mergeAvailable } from '../sync/merge.js'

@Controller('health')
export class HealthController {
  /** Liveness. */
  @Get()
  health(): { status: string; version: string } {
    return { status: 'ok', version: process.env['npm_package_version'] ?? '0.0.0' }
  }

  /**
   * Readiness — gates the blue-green cutover.
   *
   * `merge` is checked, not assumed. The WASM is a build artifact copied into the
   * image, so "the file didn't make it" is a real and quiet failure mode: the process
   * starts fine and only sync breaks. A 503 here keeps that build from taking traffic.
   */
  @Get('ready')
  ready(@Res({ passthrough: true }) res: Response): {
    status: string
    checks: Record<string, string>
  } {
    const checks: Record<string, string> = {
      // Postgres and Redis land with persistence; this reports what it actually
      // knows rather than claiming green for absent dependencies.
      content: 'ok',
      merge: mergeAvailable() ? 'ok' : 'unavailable',
    }
    const ok = Object.values(checks).every((v) => v === 'ok')
    if (!ok) res.status(HttpStatus.SERVICE_UNAVAILABLE)
    return { status: ok ? 'ok' : 'degraded', checks }
  }
}
