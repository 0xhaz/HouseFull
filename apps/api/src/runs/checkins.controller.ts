import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { CheckinsService } from './checkins.service.js';

const SegmentResultSchema = z.object({
  segmentId: z.string().regex(/^s\d+$/),
  clicks: z.number().int().nonnegative().optional(),
  sales: z.number().int().nonnegative().optional(),
  spendUsd: z.number().nonnegative().optional(),
});
const CheckinSchema = z.union([
  z.object({
    bySegment: z.array(SegmentResultSchema).min(1).max(20),
    source: z.enum(['manual', 'sample']).optional(),
  }),
  z.object({ csv: z.string().min(1).max(500_000) }),
]);
const ReplanSchema = z.object({ force: z.boolean().optional() });

/** F9b: results in, re-plan out. Every version is kept. */
@Controller('runs/:id')
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Get('checkins')
  scoreboard(@Param('id', ParseUUIDPipe) id: string) {
    return this.checkins.scoreboard(id);
  }

  /** Manual entry `{ bySegment }` or a Meta Ads Manager export `{ csv }`. */
  @Post('checkins')
  add(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(CheckinSchema)) body: z.infer<typeof CheckinSchema>,
  ) {
    return this.checkins.add(id, body);
  }

  @Post('replan')
  replan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ReplanSchema)) body: z.infer<typeof ReplanSchema>,
  ) {
    return this.checkins.replan(id, body.force ?? false);
  }

  @Get('versions')
  versions(@Param('id', ParseUUIDPipe) id: string) {
    return this.checkins.versions(id);
  }

  @Get('versions/:version')
  version(@Param('id', ParseUUIDPipe) id: string, @Param('version', ParseIntPipe) version: number) {
    return this.checkins.version(id, version);
  }

  /** F6: Meta/TikTok ad sets per segment as CSV (default) or JSON. */
  @Get('export/ads')
  @Header('Cache-Control', 'no-store')
  async ads(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('platform') platform: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const p = platform ?? 'meta';
    if (p !== 'meta' && p !== 'tiktok')
      throw new BadRequestException('platform must be meta or tiktok');
    const { exports, csv, version } = await this.checkins.adExport(id, p);
    if (format === 'json') return res.json(exports);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="housefull-${p}-ads-v${version}.csv"`,
    );
    res.send(csv);
  }

  /** F5: one street-team route as GPX (Maps apps, Strava, Gaia…). */
  @Get('street-team.gpx')
  async gpx(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('segment') segment: string | undefined,
    @Res() res: Response,
  ) {
    const { gpx, name } = await this.checkins.streetTeamGpx(id, segment);
    res.setHeader('Content-Type', 'application/gpx+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.gpx"`);
    res.send(gpx);
  }
}
