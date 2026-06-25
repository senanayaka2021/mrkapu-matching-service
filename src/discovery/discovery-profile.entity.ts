import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'discovery_profiles' })
export class DiscoveryProfile {
  @Prop({ required: true, unique: true, index: true })
  userId!: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  email?: string;

  @Prop()
  dob?: string;

  @Prop()
  age?: number;

  @Prop()
  province?: string;

  @Prop()
  city?: string;

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

  @Prop({ type: [String], default: [] })
  interests?: string[];

  @Prop({ type: [String], default: [] })
  hobbies?: string[];

  @Prop({ type: [String], default: [] })
  sports?: string[];

  @Prop({ type: [String], default: [] })
  favoritePlaces?: string[];

  @Prop({ type: [String], default: [] })
  favoriteColors?: string[];

  @Prop()
  specialThings?: string;

  @Prop()
  avatarUrl?: string;

  @Prop()
  role?: string;

  @Prop()
  provider?: string;

  @Prop({ type: [String], default: [] })
  serviceCategories?: string[];

  @Prop({ default: 0 })
  profileCompletion?: number;

  @Prop({ default: false })
  verifiedPhoneNumber?: boolean;

  @Prop({ default: false })
  verifiedEmail?: boolean;

  @Prop({ default: false })
  isProfileVerified?: boolean;

  @Prop({ default: false })
  isBot?: boolean;

  @Prop({ type: [String], default: [] })
  followingIds?: string[];

  @Prop({ type: [String], default: [] })
  followerIds?: string[];

  @Prop({ default: 0 })
  followersCount?: number;

  @Prop({ type: Object, default: {} })
  matchPreferences?: Record<string, unknown>;

  @Prop()
  sourceUpdatedAt?: Date;

  @Prop()
  sourceCreatedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export type DiscoveryProfileDocument = HydratedDocument<DiscoveryProfile>;

export const DiscoveryProfileSchema =
  SchemaFactory.createForClass(DiscoveryProfile);
