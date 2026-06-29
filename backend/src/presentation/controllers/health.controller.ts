import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  index() {
    return { status: 'MRV API is running!', version: '1.0.0' };
  }

  @Get('api/health')
  health() {
    return { status: 'ok' };
  }

  @Get('api/hello')
  hello() {
    return { message: 'hello' };
  }

  @Get('api/debug/cors-test')
  corsTest() {
    return { status: 'ok', message: 'CORS test endpoint' };
  }
}
