import { Controller, Post, Body } from '@nestjs/common';
import { AlertsService } from './alert.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post('create')
  async create(
    @Body() body: { searchTerm: string; priceThreshold: number; email: string },
  ) {
    return this.alertsService.createAlert(
      body.searchTerm,
      body.priceThreshold,
      body.email,
    );
  }
}
