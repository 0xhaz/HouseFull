import { CODE_PATTERN } from '@housefull/feedback';
import { TrackingLinkSchema } from '@housefull/shared';
import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { LinksService, type NewLink } from './links.service.js';

const CreateLinksSchema = z.object({
  links: z
    .array(TrackingLinkSchema.omit({ code: true, runId: true }))
    .min(1)
    .max(50),
});

@Controller()
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Post('runs/:id/links')
  create(
    @Param('id', ParseUUIDPipe) runId: string,
    @Body(new ZodPipe(CreateLinksSchema)) body: { links: NewLink[] },
  ) {
    return this.links.create(runId, body.links);
  }

  /** Public redirect. 302 so browsers don't cache it and every click is counted. */
  @Get('r/:code')
  async redirect(
    @Param('code') code: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res() res: Response,
  ) {
    if (!CODE_PATTERN.test(code)) throw new NotFoundException();
    const target = await this.links.resolve(code, { ip, userAgent: userAgent ?? '' });
    if (!target) throw new NotFoundException();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.redirect(302, target);
  }
}
