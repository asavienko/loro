// Remotion's render settings for the landing page's video (see README.md).
import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(95)
Config.setOverwriteOutput(true)
Config.setPixelFormat('yuv420p')
