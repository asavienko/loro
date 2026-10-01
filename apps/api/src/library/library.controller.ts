import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js'
import { OptionalAuthGuard, readerOf, type ReaderRequest } from './library.guard.js'
import { LibraryService } from './library.service.js'
import { PushService } from './push.js'

/** Reading: anyone, with more for the signed-in reader (their own and saved items). */
@Controller('library')
@UseGuards(OptionalAuthGuard)
export class LibraryReadController {
  constructor(@Inject(LibraryService) private readonly library: LibraryService) {}

  /** The languages the app offers, which a course teaches and which the app speaks (plan 108). */
  @Get('languages')
  @Header('Cache-Control', 'no-store')
  languages() {
    return this.library.languages()
  }

  @Get('pack')
  @Header('Cache-Control', 'no-store')
  pack(@Req() request: ReaderRequest, @Query('target') target: unknown) {
    return this.library.pack(readerOf(request), target)
  }

  @Get('community')
  @Header('Cache-Control', 'no-store')
  community(@Req() request: ReaderRequest, @Query() query: Record<string, unknown>) {
    return this.library.community(readerOf(request), query)
  }

  @Get('sets/:id')
  @Header('Cache-Control', 'no-store')
  set(@Req() request: ReaderRequest, @Param('id') id: string) {
    return this.library.set(readerOf(request), id)
  }

  @Get('sets/:id/songs')
  @Header('Cache-Control', 'no-store')
  songsOfSet(@Req() request: ReaderRequest, @Param('id') id: string) {
    return this.library.songsOfSet(readerOf(request), id)
  }

  @Get('sets/:id/more')
  @Header('Cache-Control', 'no-store')
  moreSetsByMaker(@Req() request: ReaderRequest, @Param('id') id: string) {
    return this.library.moreSetsByMaker(readerOf(request), id)
  }

  @Get('albums/:id/more')
  @Header('Cache-Control', 'no-store')
  moreAlbumsByMaker(@Req() request: ReaderRequest, @Param('id') id: string) {
    return this.library.moreAlbumsByMaker(readerOf(request), id)
  }

  @Get('albums/:id')
  @Header('Cache-Control', 'no-store')
  album(@Req() request: ReaderRequest, @Param('id') id: string) {
    return this.library.album(readerOf(request), id)
  }

  @Get('shared/:code')
  @Header('Cache-Control', 'no-store')
  shared(@Req() request: ReaderRequest, @Param('code') code: string) {
    return this.library.shared(readerOf(request), code)
  }

  @Get('songs/:id')
  @Header('Cache-Control', 'no-store')
  song(@Req() request: ReaderRequest, @Param('id') id: string) {
    return this.library.song(readerOf(request), id)
  }

  /** Audio with byte ranges, so a browser can seek and a native player can stream. */
  @Get('songs/:id/audio')
  async audio(
    @Req() request: ReaderRequest,
    @Param('id') id: string,
    @Query('exp') exp: unknown,
    @Query('sig') sig: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const { bytes, contentType } = await this.library.songAudio(readerOf(request), id, { exp, sig })
    response.setHeader('Content-Type', contentType)
    response.setHeader('Accept-Ranges', 'bytes')
    response.setHeader('Cache-Control', 'private, max-age=3600')
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '')
    if (!range || (range[1] === '' && range[2] === '')) {
      response.setHeader('Content-Length', String(bytes.byteLength))
      response.end(bytes)
      return
    }
    const size = bytes.byteLength
    const start = range[1] === '' ? Math.max(0, size - Number(range[2])) : Number(range[1])
    const end = range[1] !== '' && range[2] !== '' ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start >= size || start > end) {
      response.status(416).setHeader('Content-Range', `bytes */${size}`)
      response.end()
      return
    }
    response.status(206)
    response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
    response.setHeader('Content-Length', String(end - start + 1))
    response.end(bytes.subarray(start, end + 1))
  }

  @Get('covers/:file')
  async cover(@Param('file') file: string, @Res() response: Response): Promise<void> {
    if (file.endsWith('.json')) {
      // Where a cover being drawn stands (plan 111): asked again until it is ready.
      const state = await this.library.coverState(file)
      response.setHeader('Cache-Control', 'no-store')
      response.json(state)
      return
    }
    const svg = await this.library.cover(file)
    response.setHeader('Content-Type', 'image/svg+xml')
    // Covers are immutable: a new cover gets a new id, and its SVG is written once, when it is ready.
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    // An illustration travels inside as a data: image; nothing else may load.
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    )
    response.end(svg)
  }
}

/** Making, changing and sharing: the signed-in learner's own things. */
@Controller('library')
@UseGuards(AuthGuard)
export class LibraryWriteController {
  constructor(
    @Inject(LibraryService) private readonly library: LibraryService,
    @Inject(PushService) private readonly push: PushService,
  ) {}

  /** A device's push token, so the learner hears when a song is ready (plan 113). */
  @Post('push-tokens')
  @HttpCode(200)
  registerPushToken(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.push.register(request.principal.userId, body)
  }

  @Delete('push-tokens/:token')
  @HttpCode(204)
  async forgetPushToken(
    @Req() request: AuthenticatedRequest,
    @Param('token') token: string,
  ): Promise<void> {
    await this.push.forget(request.principal.userId, token)
  }

  @Get('usage')
  @Header('Cache-Control', 'no-store')
  usage(@Req() request: AuthenticatedRequest) {
    return this.library.usage(request.principal.userId)
  }

  /** Deletes everything the learner keeps in the library (their account's sign-in stays). */
  @Post('me/delete')
  @HttpCode(200)
  deleteEverything(@Req() request: AuthenticatedRequest) {
    return this.library.deleteEverything(request.principal.userId)
  }

  /** Deletes the account itself, with everything in it; its sessions end with it. */
  @Post('me/delete-account')
  @HttpCode(200)
  deleteAccount(@Req() request: AuthenticatedRequest) {
    return this.library.deleteAccount(request.principal.userId)
  }

  @Get('profile')
  @Header('Cache-Control', 'no-store')
  profile(@Req() request: AuthenticatedRequest) {
    return this.library.profile(request.principal.userId)
  }

  @Post('profile')
  @HttpCode(200)
  setProfile(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.setProfile(request.principal.userId, body)
  }

  @Post('sets')
  @HttpCode(201)
  createSet(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.createSet(request.principal.userId, body)
  }

  @Post('sets/:id')
  @HttpCode(200)
  updateSet(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.library.updateSet(request.principal.userId, id, body)
  }

  /** New words for a phrase the learner holds in a set (plan 108). */
  @Post('sets/:id/phrases/:phraseId')
  @HttpCode(200)
  editPhrase(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('phraseId') phraseId: string,
    @Body() body: unknown,
  ) {
    return this.library.editPhrase(request.principal.userId, id, phraseId, body)
  }

  /** A phrase added on its own: into a set, or the learner's "My phrases" set (plan 108). */
  @Post('phrases')
  @HttpCode(201)
  addPhrase(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.addPhrase(request.principal.userId, body)
  }

  @Delete('phrases/:id')
  @HttpCode(204)
  async deletePhrase(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.library.deletePhrase(request.principal.userId, id)
  }

  @Delete('sets/:id')
  @HttpCode(204)
  async deleteSet(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.library.deleteSet(request.principal.userId, id)
  }

  @Post('albums')
  @HttpCode(201)
  createAlbum(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.createAlbum(request.principal.userId, body)
  }

  @Post('albums/:id')
  @HttpCode(200)
  updateAlbum(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.library.updateAlbum(request.principal.userId, id, body)
  }

  @Delete('albums/:id')
  @HttpCode(204)
  async deleteAlbum(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.library.deleteAlbum(request.principal.userId, id)
  }

  @Post('saves')
  @HttpCode(200)
  save(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.save(request.principal.userId, body)
  }

  @Delete('saves/:kind/:id')
  @HttpCode(204)
  async unsave(
    @Req() request: AuthenticatedRequest,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.library.unsave(request.principal.userId, kind, id)
  }

  @Post('reports')
  @HttpCode(200)
  report(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.report(request.principal.userId, body)
  }

  /** A deck written in the background (plan 111); the app polls `GET decks/:id`. */
  @Post('decks')
  @HttpCode(202)
  startDeck(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.startDeck(request.principal.userId, body)
  }

  @Get('decks/:id')
  @Header('Cache-Control', 'no-store')
  deck(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.library.deck(request.principal.userId, id)
  }

  /** A deck written while the request waits, for app builds from before `decks` (plan 111). */
  @Post('generate/phrases')
  @HttpCode(200)
  generatePhrases(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.generatePhrases(request.principal.userId, body)
  }

  @Post('generate/notes')
  @HttpCode(200)
  generateNotes(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.generateNotes(request.principal.userId, body)
  }

  /** Another mnemonic or grammar note for a phrase, unlike the ones the learner already read. */
  @Post('generate/note')
  @HttpCode(200)
  rewriteNote(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.rewriteNote(request.principal.userId, body)
  }

  @Post('generate/cover')
  @HttpCode(201)
  generateCover(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.generateCover(request.principal.userId, body)
  }

  /** The covers the learner drew for an item, and the one it wears, to choose from again. */
  @Get('covers/:kind/:id')
  @Header('Cache-Control', 'no-store')
  coverHistory(
    @Req() request: AuthenticatedRequest,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    return this.library.coverHistory(request.principal.userId, kind, id)
  }

  /** An earlier cover put back on the item it was drawn for, without drawing. */
  @Post('covers/:id/wear')
  @HttpCode(200)
  wearCover(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.library.wearCover(request.principal.userId, id, body)
  }

  /** Lyrics written first (plan 113), in the background; the app polls `GET lyrics/:id`. */
  @Post('lyrics')
  @HttpCode(202)
  startLyrics(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.startLyrics(request.principal.userId, body)
  }

  @Get('lyrics/:id')
  @Header('Cache-Control', 'no-store')
  lyrics(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.library.lyrics(request.principal.userId, id)
  }

  /** The draft written again: anew, or changed as the learner asks. */
  @Post('lyrics/:id/rewrite')
  @HttpCode(202)
  rewriteLyrics(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.library.rewriteLyrics(request.principal.userId, id, body)
  }

  /** A song: from the learner's approved lyrics (`lyricsId`, plan 113), or written here. */
  @Post('generate/song')
  @HttpCode(202)
  generateSong(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.library.generateSong(request.principal.userId, body)
  }

  /** A failed song, made again for another of the day's songs. */
  @Post('songs/:id/retry')
  @HttpCode(202)
  retrySong(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.library.retrySong(request.principal.userId, id, body)
  }

  @Delete('songs/:id')
  @HttpCode(204)
  async deleteSong(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.library.deleteSong(request.principal.userId, id)
  }
}
