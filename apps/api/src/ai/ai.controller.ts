import { Body, Controller, Get, Inject, Post } from '@nestjs/common'
import { AiService, type Scene } from './ai.service.js'

interface SceneRequest {
  theme?: string
  level?: string
}

@Controller('ai')
export class AiController {
  // Explicit @Inject: the dev runner is esbuild-based and does not emit
  // `design:paramtypes`, so type-only constructor injection resolves to undefined.
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  @Post('scene')
  scene(@Body() body: SceneRequest): {
    scene_id: string
    cached: boolean
    fallback: boolean
    scene: Scene
  } {
    const theme = body.theme ?? 'Café'
    const { scene, cached, fallback } = this.ai.scene(theme)

    // Nothing invalid ever reaches a learner.
    const check = this.ai.validate(scene)
    if (!check.ok) {
      const safe = this.ai.scene('Café')
      return { scene_id: 'fallback', cached: false, fallback: true, scene: safe.scene }
    }

    return { scene_id: `scn_${theme.toLowerCase()}`, cached, fallback, scene }
  }

  @Get('themes')
  themes(): { themes: string[]; provider: string } {
    return { themes: this.ai.themes(), provider: process.env['AI_PROVIDER'] ?? 'stub' }
  }
}
