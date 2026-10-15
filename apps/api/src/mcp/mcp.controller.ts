import { Ticketmaster } from '@housefull/events';
import type { QlooClient } from '@housefull/qloo-client';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Controller, Delete, Get, HttpCode, Ip, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { dailyIpHash } from '../common/ip.js';
import { InjectQloo } from '../qloo/qloo.module.js';
import { CheckinsService } from '../runs/checkins.service.js';
import { DbGeoStore } from '../runs/geo-store.js';
import { RunsService } from '../runs/runs.service.js';
import { buildMcpServer } from './mcp.tools.js';

/** MCP over streamable HTTP, stateless: a fresh server + transport per request (works across Cloud Run instances). */
@Controller('mcp')
export class McpController {
  private readonly ticketmaster = new Ticketmaster({
    apiKey: process.env.TICKETMASTER_API_KEY || undefined,
  });

  constructor(
    @InjectQloo() private readonly qloo: QlooClient,
    private readonly geo: DbGeoStore,
    private readonly runs: RunsService,
    private readonly checkins: CheckinsService,
  ) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async handle(@Req() req: Request, @Res() res: Response, @Ip() ip: string) {
    const server = buildMcpServer({
      qloo: this.qloo,
      geo: this.geo,
      ticketmaster: this.ticketmaster,
      runs: this.runs,
      checkins: this.checkins,
      ipHash: dailyIpHash(ip),
      webUrl: (process.env.WEB_PUBLIC_URL || 'http://localhost:3100').split(',')[0] as string,
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  /** Stateless server: no server-initiated streams or sessions. */
  @Get()
  @HttpCode(405)
  get() {
    return { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null };
  }

  @Delete()
  @HttpCode(405)
  del() {
    return this.get();
  }
}
