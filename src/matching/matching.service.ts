import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DiscoveryPost,
  DiscoveryPostDocument,
} from '../discovery/discovery-post.entity';
import {
  DiscoveryProfile,
  DiscoveryProfileDocument,
} from '../discovery/discovery-profile.entity';
import { BotUser, BotUserDocument } from '../user/bot-user.entity';
import { User, UserDocument } from '../user/user.entity';
import {
  WallViewEvent,
  WallViewEventDocument,
} from '../wall/wall-view-event.entity';
import { UpdateMatchPreferencesDto } from './dto/update-match-preferences.dto';

type MatchPreferencesPayload = {
  ageRange?: {
    min?: number;
    max?: number;
  };
  preferredProvinces?: string[];
  preferredCities?: string[];
  preferredReligions?: string[];
  preferredCastes?: string[];
  preferredEducationKeywords?: string[];
  preferredOccupationKeywords?: string[];
  preferredInterests?: string[];
  preferredHobbies?: string[];
  preferredMaritalStatuses?: string[];
  dealBreakers?: string[];
  updatedAt?: Date;
};

type MatchCandidate = {
  user: ReturnType<MatchingService['toCandidatePublic']>;
  score: number;
  breakdown: {
    profileScore: number;
    behaviorScore: number;
    trustScore: number;
  };
  reasons: string[];
};

type BehaviorProfile = {
  topTagScores: Map<string, number>;
  topAuthorScores: Map<string, number>;
  followingIds: Set<string>;
};

type WeightedComponent = {
  weight: number;
  score: number | null;
};

@Injectable()
export class MatchingService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(BotUser.name)
    private readonly botUserModel: Model<BotUserDocument>,
    @InjectModel(DiscoveryProfile.name)
    private readonly discoveryProfileModel: Model<DiscoveryProfileDocument>,
    @InjectModel(DiscoveryPost.name)
    private readonly discoveryPostModel: Model<DiscoveryPostDocument>,
    @InjectModel(WallViewEvent.name)
    private readonly wallViewEventModel: Model<WallViewEventDocument>,
  ) {}

  async getPreferences(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('_id matchPreferences')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.serializePreferences(user.matchPreferences);
  }

  async updatePreferences(userId: string, dto: UpdateMatchPreferencesDto) {
    const normalized = this.normalizePreferences(dto);
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          matchPreferences: {
            ...normalized,
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .select('_id matchPreferences')
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    await this.discoveryProfileModel
      .findOneAndUpdate(
        { userId },
        {
          matchPreferences: updated.matchPreferences || {},
          sourceUpdatedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    return this.serializePreferences(updated.matchPreferences);
  }

  async getMatches(userId: string, limit = 20, offset = 0) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);

    const viewer =
      (await this.loadViewerProfile(userId)) || this.buildAnonymousViewer(userId);

    const [discoveryCandidates, authUsers, botUsers] = await Promise.all([
      this.discoveryProfileModel
        .find({ userId: { $ne: userId } })
        .limit(800)
        .lean()
        .exec(),
      this.userModel
        .find({ _id: { $ne: userId } })
        .limit(800)
        .lean()
        .exec(),
      this.botUserModel
        .find({ _id: { $ne: userId } })
        .limit(800)
        .lean()
        .exec(),
    ]);

    const mergedCandidates = [
      ...discoveryCandidates,
      ...authUsers.map((user) => this.userToDiscoveryProfile(user)),
      ...botUsers.map((user) => this.userToDiscoveryProfile(user)),
    ];

    const candidatesByUserId = new Map<string, DiscoveryProfile>();
    for (const candidate of mergedCandidates) {
      const id = this.userId(candidate);
      if (!id || id === userId) continue;
      candidatesByUserId.set(id, candidate);
    }

    const candidates = Array.from(candidatesByUserId.values());

    const candidateIds = candidates.map((candidate) => this.userId(candidate));
    const [behaviorProfile, candidateTopTags] = await Promise.all([
      this.buildBehaviorProfile(userId, viewer.followingIds || []),
      this.buildCandidateTopTags(candidateIds),
    ]);

    const matches = candidates
      .map((candidate) =>
        this.scoreCandidate(
          viewer,
          candidate,
          behaviorProfile,
          candidateTopTags.get(this.userId(candidate)) || [],
        ),
      )
      .filter((match): match is MatchCandidate => Boolean(match))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return (
          new Date(right.user.updatedAt || 0).getTime() -
          new Date(left.user.updatedAt || 0).getTime()
        );
      });

    return {
      total: matches.length,
      offset: safeOffset,
      limit: safeLimit,
      preferences: this.serializePreferences(viewer.matchPreferences),
      matches: matches.slice(safeOffset, safeOffset + safeLimit),
    };
  }

  private buildAnonymousViewer(userId: string): DiscoveryProfile {
    return {
      userId,
      interests: [],
      hobbies: [],
      sports: [],
      favoritePlaces: [],
      serviceCategories: [],
      followingIds: [],
      followerIds: [],
      followersCount: 0,
      profileCompletion: 0,
      verifiedPhoneNumber: false,
      verifiedEmail: false,
      isProfileVerified: false,
      isBot: false,
      matchPreferences: {},
    };
  }

  private async loadViewerProfile(userId: string): Promise<DiscoveryProfile | null> {
    const discoveryProfile = await this.discoveryProfileModel
      .findOne({ userId })
      .lean()
      .exec();

    if (discoveryProfile) {
      return discoveryProfile;
    }

    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) {
      return null;
    }

    return this.userToDiscoveryProfile(user);
  }

  private scoreCandidate(
    viewer: DiscoveryProfile,
    candidate: DiscoveryProfile,
    behaviorProfile: BehaviorProfile,
    candidateTags: string[],
  ): MatchCandidate | null {
    const profileReasons: string[] = [];
    const behaviorReasons: string[] = [];
    const profileScore = this.computeProfileScore(
      viewer,
      candidate,
      profileReasons,
    );
    const behaviorScore = this.computeBehaviorScore(
      candidate,
      behaviorProfile,
      candidateTags,
      behaviorReasons,
    );
    const trustScore = this.computeTrustScore(candidate);
    const finalScore = Math.round(
      profileScore * 0.65 + behaviorScore * 0.25 + trustScore * 0.1,
    );

    if (finalScore <= 0) {
      return null;
    }

    const reasons = [...profileReasons, ...behaviorReasons];
    if (trustScore >= 85) {
      reasons.push(
        candidate.isProfileVerified
          ? 'Verified and complete profile'
          : 'Well-completed profile',
      );
    }

    return {
      user: this.toCandidatePublic(candidate),
      score: Math.min(99, Math.max(1, finalScore)),
      breakdown: {
        profileScore,
        behaviorScore,
        trustScore,
      },
      reasons: reasons.slice(0, 4),
    };
  }

  private computeProfileScore(
    viewer: DiscoveryProfile,
    candidate: DiscoveryProfile,
    reasons: string[],
  ) {
    const preferences = this.coercePreferences(viewer.matchPreferences);
    const components: WeightedComponent[] = [];

    const ageScore = this.computeAgeScore(viewer, candidate, preferences);
    components.push({ weight: 16, score: ageScore });
    if (ageScore !== null && ageScore >= 0.95 && candidate.age != null) {
      reasons.push(`Age fits well (${candidate.age})`);
    }

    const locationScore = this.computeLocationScore(
      viewer,
      candidate,
      preferences,
    );
    components.push({ weight: 14, score: locationScore });
    if (locationScore !== null && locationScore >= 0.95) {
      reasons.push('Lives in your preferred area');
    } else if (locationScore !== null && locationScore >= 0.75) {
      reasons.push('Lives near you');
    }

    const religionScore = this.computePreferenceListScore(
      candidate.religion,
      preferences.preferredReligions,
      viewer.religion,
    );
    components.push({ weight: 12, score: religionScore });
    if (
      religionScore !== null &&
      religionScore >= 0.95 &&
      candidate.religion
    ) {
      reasons.push(`Religion match: ${candidate.religion}`);
    }

    const casteScore = this.computePreferenceListScore(
      candidate.caste,
      preferences.preferredCastes,
      viewer.caste,
    );
    components.push({ weight: 6, score: casteScore });

    const educationScore = this.computeKeywordScore(
      candidate.education,
      preferences.preferredEducationKeywords,
      viewer.education,
    );
    components.push({ weight: 10, score: educationScore });
    if (
      educationScore !== null &&
      educationScore >= 0.95 &&
      candidate.education
    ) {
      reasons.push(`Education fit: ${candidate.education}`);
    }

    const occupationScore = this.computeKeywordScore(
      candidate.occupation || candidate.job,
      preferences.preferredOccupationKeywords,
      viewer.occupation || viewer.job,
    );
    components.push({ weight: 10, score: occupationScore });
    if (
      occupationScore !== null &&
      occupationScore >= 0.95 &&
      (candidate.occupation || candidate.job)
    ) {
      reasons.push(`Career fit: ${candidate.occupation || candidate.job}`);
    }

    const interestPool =
      (preferences.preferredInterests || []).length > 0
        ? preferences.preferredInterests || []
        : viewer.interests || [];
    const interestScore = this.computeListOverlapScore(
      candidate.interests || [],
      interestPool,
    );
    components.push({ weight: 16, score: interestScore });
    if (interestScore !== null && interestScore >= 0.34) {
      reasons.push(
        `Shared interests: ${this.sharedValues(
          candidate.interests || [],
          interestPool,
        )
          .slice(0, 2)
          .join(', ')}`,
      );
    }

    const hobbyPool =
      (preferences.preferredHobbies || []).length > 0
        ? preferences.preferredHobbies || []
        : [...(viewer.hobbies || []), ...(viewer.sports || [])];
    const hobbyScore = this.computeListOverlapScore(
      [...(candidate.hobbies || []), ...(candidate.sports || [])],
      hobbyPool,
    );
    components.push({ weight: 8, score: hobbyScore });

    const maritalScore = this.computePreferenceListScore(
      candidate.maritalStatus,
      preferences.preferredMaritalStatuses,
      viewer.maritalStatus,
    );
    components.push({ weight: 6, score: maritalScore });

    const lifestyleScore = this.computeListOverlapScore(
      candidate.favoritePlaces || [],
      viewer.favoritePlaces || [],
    );
    components.push({ weight: 4, score: lifestyleScore });

    return this.weightedAverage(components);
  }

  private computeBehaviorScore(
    candidate: DiscoveryProfile,
    behaviorProfile: BehaviorProfile,
    candidateTags: string[],
    reasons: string[],
  ) {
    const components: WeightedComponent[] = [];
    const viewerTagTotal = Array.from(behaviorProfile.topTagScores.values())
      .reduce((sum, value) => sum + value, 0);
    const candidateTagSet = new Set(
      candidateTags
        .map((tag) => this.normalizeToken(tag))
        .filter((tag): tag is string => Boolean(tag)),
    );

    let overlappingTagWeight = 0;
    for (const [tag, score] of behaviorProfile.topTagScores.entries()) {
      if (candidateTagSet.has(tag)) {
        overlappingTagWeight += score;
      }
    }

    const tagScore =
      viewerTagTotal > 0
        ? Math.min(1, overlappingTagWeight / viewerTagTotal)
        : null;
    components.push({ weight: 70, score: tagScore });

    if (tagScore !== null && tagScore >= 0.18) {
      const topSharedTags = Array.from(behaviorProfile.topTagScores.keys())
        .filter((tag) => candidateTagSet.has(tag));
      if (topSharedTags.length) {
        reasons.push(`Wall topic overlap: ${topSharedTags.slice(0, 2).join(', ')}`);
      }
    }

    const candidateId = this.userId(candidate);
    let authorAffinity: number | null = null;

    if (behaviorProfile.followingIds.has(candidateId)) {
      authorAffinity = 1;
      reasons.push('You already follow this profile');
    } else if (behaviorProfile.topAuthorScores.size > 0) {
      const bestScore = Math.max(...behaviorProfile.topAuthorScores.values());
      const authorScore = behaviorProfile.topAuthorScores.get(candidateId) || 0;
      authorAffinity = bestScore > 0 ? Math.min(1, authorScore / bestScore) : 0;
      if (authorAffinity >= 0.35) {
        reasons.push('You engage with this person’s wall posts');
      }
    }

    components.push({ weight: 30, score: authorAffinity });
    return this.weightedAverage(components);
  }

  private computeTrustScore(candidate: DiscoveryProfile) {
    const completion = Math.max(
      0,
      Math.min(100, Number(candidate.profileCompletion || 0)),
    );
    let score = completion * 0.7;

    if (candidate.verifiedEmail) score += 10;
    if (candidate.verifiedPhoneNumber) score += 10;
    if (candidate.isProfileVerified) score += 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private async buildBehaviorProfile(
    viewerId: string,
    followingIds: string[],
  ): Promise<BehaviorProfile> {
    const events = await this.wallViewEventModel
      .find({ viewerId })
      .sort({ lastViewedAt: -1 })
      .limit(300)
      .lean()
      .exec();

    const topTagScores = new Map<string, number>();
    const topAuthorScores = new Map<string, number>();

    for (const event of events) {
      const score =
        Number(event.viewsCount || 0) +
        Number(event.tagTapCount || 0) * 3 +
        Number(event.profileOpenCount || 0) * 4 +
        Number(event.commentOpenCount || 0) * 2 +
        Number(event.mediaOpenCount || 0) * 2 +
        Number(event.totalDwellMs || 0) / 5000;

      const authorId = String(event.authorId || '').trim();
      if (authorId) {
        topAuthorScores.set(
          authorId,
          (topAuthorScores.get(authorId) || 0) + score,
        );
      }

      for (const rawTag of Array.isArray(event.tags) ? event.tags : []) {
        const tag = this.normalizeToken(rawTag);
        if (!tag) continue;
        topTagScores.set(tag, (topTagScores.get(tag) || 0) + score);
      }
    }

    return {
      topTagScores: this.topEntries(topTagScores, 12),
      topAuthorScores: this.topEntries(topAuthorScores, 10),
      followingIds: new Set(
        (followingIds || [])
          .map((id) => `${id}`.trim())
          .filter((id) => id.length > 0),
      ),
    };
  }

  private async buildCandidateTopTags(candidateIds: string[]) {
    if (!candidateIds.length) {
      return new Map<string, string[]>();
    }

    const rows = await this.discoveryPostModel
      .aggregate([
        {
          $match: {
            userId: { $in: candidateIds },
            tags: { $exists: true, $ne: [] },
          },
        },
        { $unwind: '$tags' },
        {
          $group: {
            _id: {
              userId: '$userId',
              tag: '$tags',
            },
            count: { $sum: 1 },
            latest: { $max: '$createdAt' },
          },
        },
        { $sort: { count: -1, latest: -1 } },
        {
          $group: {
            _id: '$_id.userId',
            tags: { $push: '$_id.tag' },
          },
        },
      ])
      .exec();

    const result = new Map<string, string[]>();
    for (const row of rows) {
      result.set(
        String(row._id),
        (row.tags || []).slice(0, 8).map((tag: unknown) => `${tag}`.trim()),
      );
    }

    return result;
  }

  private toCandidatePublic(candidate: DiscoveryProfile) {
    const name =
      [candidate.firstName, candidate.lastName]
        .filter((part) => part && part.trim().length > 0)
        .join(' ') || 'MrKapu Member';

    return {
      id: this.userId(candidate),
      name,
      age: this.resolveAge(candidate),
      location:
        [candidate.city, candidate.province].filter(Boolean).join(', ') ||
        candidate.location ||
        'Sri Lanka',
      province: candidate.province,
      city: candidate.city,
      education: candidate.education,
      occupation: candidate.occupation || candidate.job,
      religion: candidate.religion,
      image: candidate.avatarUrl,
      interests: (candidate.interests || []).slice(0, 6),
      profileCompletion: Number(candidate.profileCompletion || 0),
      verifiedPhoneNumber: candidate.verifiedPhoneNumber === true,
      verifiedEmail: candidate.verifiedEmail === true,
      isProfileVerified: candidate.isProfileVerified === true,
      updatedAt: candidate.updatedAt,
    };
  }

  private userToDiscoveryProfile(user: User | BotUser): DiscoveryProfile {
    const matchPreferences =
      user.matchPreferences &&
      typeof user.matchPreferences === 'object' &&
      !Array.isArray(user.matchPreferences)
        ? (user.matchPreferences as Record<string, unknown>)
        : {};

    return {
      userId: String((user as { _id?: unknown })._id || ''),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      dob: user.dob,
      age: user.age,
      province: user.province,
      city: user.city,
      location: user.location,
      religion: user.religion,
      caste: user.caste,
      education: user.education,
      occupation: user.occupation,
      job: user.job,
      monthlyIncomeRange: user.monthlyIncomeRange,
      maritalStatus: user.maritalStatus,
      interests: user.interests || [],
      hobbies: user.hobbies || [],
      sports: user.sports || [],
      favoritePlaces: user.favoritePlaces || [],
      avatarUrl: user.avatarUrl,
      role: user.role,
      provider: user.provider,
      serviceCategories: user.serviceCategories || [],
      profileCompletion: user.profileCompletion || 0,
      verifiedPhoneNumber: user.verifiedPhoneNumber === true,
      verifiedEmail: user.verifiedEmail === true,
      isProfileVerified: user.isProfileVerified === true,
      isBot: user.isBot === true,
      followingIds: user.followingIds || [],
      followerIds: [],
      followersCount: 0,
      matchPreferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private serializePreferences(preferences?: MatchPreferencesPayload | null) {
    return {
      minAge: preferences?.ageRange?.min ?? null,
      maxAge: preferences?.ageRange?.max ?? null,
      preferredProvinces: preferences?.preferredProvinces || [],
      preferredCities: preferences?.preferredCities || [],
      preferredReligions: preferences?.preferredReligions || [],
      preferredCastes: preferences?.preferredCastes || [],
      preferredEducationKeywords: preferences?.preferredEducationKeywords || [],
      preferredOccupationKeywords:
        preferences?.preferredOccupationKeywords || [],
      preferredInterests: preferences?.preferredInterests || [],
      preferredHobbies: preferences?.preferredHobbies || [],
      preferredMaritalStatuses: preferences?.preferredMaritalStatuses || [],
      dealBreakers: preferences?.dealBreakers || [],
      updatedAt: preferences?.updatedAt || null,
    };
  }

  private normalizePreferences(dto: UpdateMatchPreferencesDto) {
    const minAge = this.safeNumber(dto.minAge);
    const maxAge = this.safeNumber(dto.maxAge);

    return {
      ageRange:
        minAge != null || maxAge != null
          ? {
              min: minAge ?? undefined,
              max: maxAge ?? undefined,
            }
          : {},
      preferredProvinces: this.normalizeTextList(dto.preferredProvinces),
      preferredCities: this.normalizeTextList(dto.preferredCities),
      preferredReligions: this.normalizeTextList(dto.preferredReligions),
      preferredCastes: this.normalizeTextList(dto.preferredCastes),
      preferredEducationKeywords: this.normalizeTextList(
        dto.preferredEducationKeywords,
      ),
      preferredOccupationKeywords: this.normalizeTextList(
        dto.preferredOccupationKeywords,
      ),
      preferredInterests: this.normalizeTextList(dto.preferredInterests),
      preferredHobbies: this.normalizeTextList(dto.preferredHobbies),
      preferredMaritalStatuses: this.normalizeTextList(
        dto.preferredMaritalStatuses,
      ),
      dealBreakers: this.normalizeTextList(dto.dealBreakers),
    };
  }

  private computeAgeScore(
    viewer: DiscoveryProfile,
    candidate: DiscoveryProfile,
    preferences: MatchPreferencesPayload,
  ) {
    const candidateAge = this.resolveAge(candidate);
    if (candidateAge == null) {
      return null;
    }

    const minAge = preferences.ageRange?.min;
    const maxAge = preferences.ageRange?.max;
    if (minAge != null || maxAge != null) {
      if (minAge != null && candidateAge < minAge) return 0;
      if (maxAge != null && candidateAge > maxAge) return 0;
      return 1;
    }

    const viewerAge = this.resolveAge(viewer);
    if (viewerAge == null) {
      return null;
    }

    const diff = Math.abs(viewerAge - candidateAge);
    if (diff <= 2) return 1;
    if (diff <= 5) return 0.82;
    if (diff <= 8) return 0.62;
    if (diff <= 12) return 0.4;
    return 0.18;
  }

  private computeLocationScore(
    viewer: DiscoveryProfile,
    candidate: DiscoveryProfile,
    preferences: MatchPreferencesPayload,
  ) {
    const candidateCity = this.normalizeToken(candidate.city);
    const candidateProvince = this.normalizeToken(candidate.province);
    const preferredCities = new Set(
      this.normalizeTextList(preferences.preferredCities).map((value) =>
        this.normalizeToken(value),
      ),
    );
    const preferredProvinces = new Set(
      this.normalizeTextList(preferences.preferredProvinces).map((value) =>
        this.normalizeToken(value),
      ),
    );

    if (preferredCities.size || preferredProvinces.size) {
      if (candidateCity && preferredCities.has(candidateCity)) return 1;
      if (candidateProvince && preferredProvinces.has(candidateProvince)) {
        return 0.82;
      }
      return 0;
    }

    const viewerCity = this.normalizeToken(viewer.city);
    const viewerProvince = this.normalizeToken(viewer.province);
    if (viewerCity && candidateCity && viewerCity === candidateCity) return 1;
    if (
      viewerProvince &&
      candidateProvince &&
      viewerProvince === candidateProvince
    ) {
      return 0.8;
    }

    if (viewer.location && candidate.location) {
      const viewerLocation = this.normalizeToken(viewer.location);
      const candidateLocation = this.normalizeToken(candidate.location);
      if (
        viewerLocation &&
        candidateLocation &&
        viewerLocation === candidateLocation
      ) {
        return 0.6;
      }
    }

    return null;
  }

  private computePreferenceListScore(
    candidateValue?: string,
    preferredValues?: string[],
    fallbackViewerValue?: string,
  ) {
    const normalizedCandidate = this.normalizeToken(candidateValue);
    const normalizedPreferences = this.normalizeTextList(preferredValues).map(
      (value) => this.normalizeToken(value),
    );

    if (normalizedPreferences.length) {
      if (!normalizedCandidate) return 0;
      return normalizedPreferences.includes(normalizedCandidate) ? 1 : 0;
    }

    const normalizedViewer = this.normalizeToken(fallbackViewerValue);
    if (!normalizedCandidate || !normalizedViewer) {
      return null;
    }

    return normalizedCandidate === normalizedViewer ? 1 : 0.15;
  }

  private computeKeywordScore(
    candidateValue?: string,
    preferredKeywords?: string[],
    fallbackViewerValue?: string,
  ) {
    const candidateText = this.normalizeSearchableText(candidateValue);
    const keywords = this.normalizeTextList(preferredKeywords);

    if (keywords.length) {
      if (!candidateText) return 0;
      return keywords.some((keyword) => candidateText.includes(keyword))
        ? 1
        : 0;
    }

    const viewerText = this.normalizeSearchableText(fallbackViewerValue);
    if (!candidateText || !viewerText) return null;

    return candidateText === viewerText
      ? 1
      : candidateText.includes(viewerText) || viewerText.includes(candidateText)
        ? 0.72
        : 0.18;
  }

  private computeListOverlapScore(
    candidateValues: string[],
    viewerValues: string[],
  ) {
    const left = new Set(this.normalizeTextList(candidateValues));
    const right = new Set(this.normalizeTextList(viewerValues));

    if (!left.size || !right.size) {
      return null;
    }

    let overlap = 0;
    for (const value of left) {
      if (right.has(value)) {
        overlap += 1;
      }
    }

    if (!overlap) return 0;

    const denominator = Math.max(2, Math.min(left.size, right.size));
    return Math.min(1, overlap / denominator);
  }

  private sharedValues(left: string[], right: string[]) {
    const rightSet = new Set(this.normalizeTextList(right));
    return this.normalizeTextList(left).filter((value) => rightSet.has(value));
  }

  private weightedAverage(components: WeightedComponent[]) {
    let weightSum = 0;
    let scoreSum = 0;

    for (const component of components) {
      if (component.score == null) continue;
      weightSum += component.weight;
      scoreSum += component.score * component.weight;
    }

    if (!weightSum) {
      return 35;
    }

    return Math.round((scoreSum / weightSum) * 100);
  }

  private resolveAge(user: { age?: number; dob?: string }) {
    if (typeof user.age === 'number' && Number.isFinite(user.age)) {
      return user.age;
    }

    if (!user.dob) {
      return undefined;
    }

    const dob = new Date(user.dob);
    if (Number.isNaN(dob.getTime())) {
      return undefined;
    }

    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && now.getDate() < dob.getDate())
    ) {
      age -= 1;
    }

    return age > 0 ? age : undefined;
  }

  private normalizeTextList(values?: string[]) {
    return Array.from(
      new Set(
        (values || [])
          .map((value) => this.normalizeSearchableText(value))
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }

  private normalizeSearchableText(value?: string) {
    const normalized = `${value || ''}`.trim().toLowerCase();
    return normalized.length ? normalized : null;
  }

  private normalizeToken(value?: string) {
    const normalized = this.normalizeSearchableText(value);
    return normalized ? normalized.replace(/\s+/g, ' ') : null;
  }

  private topEntries(source: Map<string, number>, limit: number) {
    return new Map(
      Array.from(source.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, limit),
    );
  }

  private safeNumber(value?: number) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private userId(user: { userId?: string; _id?: unknown }) {
    return String(user.userId || user._id || '').trim();
  }

  private coercePreferences(
    preferences?: Record<string, unknown> | MatchPreferencesPayload | null,
  ): MatchPreferencesPayload {
    if (!preferences || typeof preferences !== 'object') {
      return {};
    }

    return preferences as MatchPreferencesPayload;
  }
}
