/**
 * Sync — docs/architecture/sync-protocol.md
 *
 * Routes only. The arbitration is in `SyncService`, which needs no HTTP to test, and the
 * merge itself is in `loro-core`: THE SERVER RUNS THE SAME MERGE AS THE CLIENT. Two
 * implementations of a conflict rule diverge, and the divergence shows up months later
 * as a learner losing a rating (ADR-0002).
 */

import { Body, Controller, Inject, Post } from '@nestjs/common'
import {
  SyncService,
  type PullBody,
  type PullResponse,
  type PushBody,
  type PushResponse,
  type StatusResponse,
} from './sync.service.js'

@Controller('sync')
export class SyncController {
  // Explicit @Inject: the dev runner is esbuild-based and does not emit
  // `design:paramtypes`, so type-only constructor injection resolves to undefined.
  constructor(@Inject(SyncService) private readonly sync: SyncService) {}

  @Post('push')
  push(@Body() body: PushBody): Promise<PushResponse> {
    return this.sync.push(body)
  }

  @Post('pull')
  pull(@Body() body: PullBody): Promise<PullResponse> {
    return this.sync.pull(body)
  }

  /** Diagnostic: is the shared Rust merge actually loaded? */
  @Post('status')
  status(): Promise<StatusResponse> {
    return this.sync.status()
  }
}
