import { type SurveyAnswer, SurveyAnswerSchema } from '@housefull/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodPipe } from '../common/zod.pipe.js';
import { SurveysService } from './surveys.service.js';

@Controller()
@UseGuards(ThrottlerGuard)
export class SurveysController {
  constructor(private readonly surveys: SurveysService) {}

  /** The post-show survey for a show (public: attendees have no account). */
  @Get('runs/:id/survey')
  info(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveys.info(id);
  }

  /** Results per audience; `null` until the show has a survey. */
  @Get('runs/:id/survey/results')
  async results(@Param('id', ParseUUIDPipe) id: string) {
    return { summary: (await this.surveys.summary(id)) ?? null };
  }

  // A whole venue can share one Wi-Fi address, so the per-IP limit is generous.
  @Post('surveys/:surveyId/responses')
  @Throttle({ default: { limit: 120, ttl: 60 * 60 * 1000 } })
  answer(
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @Body(new ZodPipe(SurveyAnswerSchema)) body: SurveyAnswer,
  ) {
    return this.surveys.answer(surveyId, body);
  }
}
