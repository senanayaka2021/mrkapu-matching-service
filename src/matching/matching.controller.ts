import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { UpdateMatchPreferencesDto } from './dto/update-match-preferences.dto';
import { MatchingService } from './matching.service';

@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get('users/:userId/preferences')
  getPreferences(@Param('userId') userId: string) {
    return this.matchingService.getPreferences(userId);
  }

  @Patch('users/:userId/preferences')
  updatePreferences(
    @Param('userId') userId: string,
    @Body() dto: UpdateMatchPreferencesDto,
  ) {
    return this.matchingService.updatePreferences(userId, dto);
  }

  @Get('users/:userId/matches')
  getMatches(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = Number.parseInt(limit || '20', 10);
    const parsedOffset = Number.parseInt(offset || '0', 10);

    return this.matchingService.getMatches(
      userId,
      Number.isNaN(parsedLimit) ? 20 : parsedLimit,
      Number.isNaN(parsedOffset) ? 0 : parsedOffset,
    );
  }
}
