import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DiscoveryPost,
  DiscoveryPostSchema,
} from '../discovery/discovery-post.entity';
import {
  DiscoveryProfile,
  DiscoveryProfileSchema,
} from '../discovery/discovery-profile.entity';
import { BotUser, BotUserSchema } from '../user/bot-user.entity';
import { User, UserSchema } from '../user/user.entity';
import {
  WallViewEvent,
  WallViewEventSchema,
} from '../wall/wall-view-event.entity';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: BotUser.name, schema: BotUserSchema },
      { name: DiscoveryProfile.name, schema: DiscoveryProfileSchema },
      { name: DiscoveryPost.name, schema: DiscoveryPostSchema },
      { name: WallViewEvent.name, schema: WallViewEventSchema },
    ]),
  ],
  controllers: [MatchingController],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
