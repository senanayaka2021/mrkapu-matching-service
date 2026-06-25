import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

// `mrkapu-bot-service` persists bot accounts into the default `users` collection.
// Matching pulls these so bot profiles can appear in the matching feed.
@Schema({ collection: 'users', timestamps: true })
export class BotUser {
  @Prop({ sparse: true })
  email?: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  phoneNumber?: string;

  @Prop()
  dob?: string;

  @Prop()
  age?: number;

  @Prop()
  city?: string;

  @Prop()
  province?: string;

  @Prop()
  location?: string;

  @Prop()
  religion?: string;

  @Prop()
  caste?: string;

  @Prop()
  education?: string;

  @Prop()
  occupation?: string;

  @Prop()
  job?: string;

  @Prop()
  monthlyIncomeRange?: string;

  @Prop()
  maritalStatus?: string;

  @Prop()
  avatarUrl?: string;

  @Prop()
  role?: string;

  @Prop()
  provider?: string;

  @Prop({ type: [String], default: [] })
  interests?: string[];

  @Prop({ type: [String], default: [] })
  hobbies?: string[];

  @Prop({ type: [String], default: [] })
  sports?: string[];

  @Prop({ type: [String], default: [] })
  favoritePlaces?: string[];

  @Prop({ type: [String], default: [] })
  serviceCategories?: string[];

  @Prop({ type: [String], default: [] })
  followingIds?: string[];

  @Prop({ default: false })
  verifiedPhoneNumber?: boolean;

  @Prop({ default: false })
  verifiedEmail?: boolean;

  @Prop({ default: false })
  isProfileVerified?: boolean;

  @Prop({ default: false })
  isBot?: boolean;

  @Prop({ default: 0 })
  profileCompletion?: number;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  matchPreferences?: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

export type BotUserDocument = HydratedDocument<BotUser>;

export const BotUserSchema = SchemaFactory.createForClass(BotUser);

