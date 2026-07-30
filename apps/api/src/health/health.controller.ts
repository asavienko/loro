import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import type { Response } from 'express'
import { config } from '../common/config.js'
import { mergeAvailable } from '../sync/merge.js'

interface HealthResponse {
  status: string
  version: string
}

interface ReadinessResponse {
  status: string
  checks: Record<string, string>
}

/** What a passing check reports. Anything else makes the whole probe degraded. */
const OK = 'ok'

@Controller('health')
export class HealthController {
  /** Liveness. */
  @Get()
  health(): HealthResponse {
    return { status: OK, version: config.appVersion() }
  }

  /**
   * Readiness — gates the blue-green cutover.
   *
   * `merge` is checked, not assumed. The WASM is a build artifact copied into the
   * image, so "the file didn't make it" is a real and quiet failure mode: the process
   * starts fine and only sync breaks. A 503 here keeps that build from taking traffic.
   */
  @Get('ready')
  ready(@Res({ passthrough: true }) res: Response): ReadinessResponse {
    const checks: Record<string, string> = {
      // Postgres and Redis land with persistence; this reports what it actually
      // knows rather than claiming green for absent dependencies.
      content: OK,
      merge: mergeAvailable() ? OK : 'unavailable',
    }
    const ok = Object.values(checks).every((v) => v === OK)
    if (!ok) res.status(HttpStatus.SERVICE_UNAVAILABLE)
    return { status: ok ? OK : 'degraded', checks }
  }
}
