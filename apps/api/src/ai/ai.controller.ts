import type { LanguagePair } from '@loro/core'
import { PendingAccountIsolation } from '../common/account-isolation.js'
import { LoroError } from '../common/errors.js'
import { Body, Controller, Get, Inject, Post } from '@nestjs/common'
import { AiService } from './ai.service.js'
import type { Scene } from './scene.js'

interface SceneRequest extends Partial<LanguagePair> {
  theme?: string
  level?: string
}

interface SceneResponse {
  scene_id: string
  cached: boolean
  fallback: boolean
  scene: Scene
}

interface ThemesResponse {
  themes: string[]
  provider: string
}

@PendingAccountIsolation()
@Controller('ai')
export class AiController {
  // Explicit @Inject: the dev runner is esbuild-based and does not emit
  // `design:paramtypes`, so type-only constructor injection resolves to undefined.
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  /**
   * The service guarantees the scene is valid and picks the default theme, so all that
   * is left here is the wire naming — `scene_id` rather than `id`.
   */
  @Post('scene')
  async scene(@Body() body: SceneRequest): Promise<SceneResponse> {
    if ((body.nativeLanguage ?? 'en') !== 'en' || (body.targetLocale ?? 'es-ES') !== 'es-ES') {
      throw new LoroError(
        'VALIDATION_FAILED',
        'AI scenes currently support English to Spanish only',
      )
    }
    const { id, cached, fallback, scene } = await this.ai.scene(body.theme)
    return { scene_id: id, cached, fallback, scene }
  }

  @Get('themes')
  themes(): ThemesResponse {
    return { themes: this.ai.themes(), provider: this.ai.providerName }
  }
}
