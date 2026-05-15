import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

function loadEnv(file) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing env file: ${fullPath}`);
  }
  return dotenv.parse(fs.readFileSync(fullPath));
}

function requireDatabaseUrl(env, file) {
  if (!env.DATABASE_URL) {
    throw new Error(`Missing DATABASE_URL in ${file}`);
  }
  return env.DATABASE_URL;
}

async function main() {
  const localEnv = loadEnv('.env');
  const prodEnv = loadEnv('.env.production');
  const localUrl = requireDatabaseUrl(localEnv, '.env');
  const prodUrl = requireDatabaseUrl(prodEnv, '.env.production');

  const local = new PrismaClient({ datasources: { db: { url: localUrl } } });
  const prod = new PrismaClient({ datasources: { db: { url: prodUrl } } });

  try {
    const [localPing, prodPing] = await Promise.all([
      local.$queryRawUnsafe('SELECT current_database() as db, now() as now'),
      prod.$queryRawUnsafe('SELECT current_database() as db, now() as now'),
    ]);

    console.log('localPing', localPing);
    console.log('prodPing', prodPing);

    const [
      localTrends,
      localSources,
      localStories,
      localComments,
      localBookmarks,
      localReports,
      localProfiles,
      localAgents,
    ] = await Promise.all([
      local.trend.findMany(),
      local.source.findMany(),
      local.story.findMany(),
      local.comment.findMany(),
      local.bookmark.findMany(),
      local.report.findMany(),
      local.profile.findMany({ select: { id: true, email: true } }),
      local.agent.findMany({ select: { id: true, name: true } }),
    ]);

    const [prodProfiles, prodAgents] = await Promise.all([
      prod.profile.findMany({ select: { id: true, email: true } }),
      prod.agent.findMany({ select: { id: true, name: true } }),
    ]);

    const localEmailByProfileId = new Map(localProfiles.map(p => [p.id, p.email]));
    const prodProfileIdByEmail = new Map(prodProfiles.map(p => [p.email, p.id]));
    const localAgentNameById = new Map(localAgents.map(a => [a.id, a.name]));
    const prodAgentIdByName = new Map(prodAgents.map(a => [a.name, a.id]));

    const storyIds = new Set(localStories.map(s => s.id));
    const commentIds = new Set(localComments.map(c => c.id));

    let skippedCommentActor = 0;
    const mappedComments = localComments
      .map(c => {
        let actorId = c.actorId;

        if (c.actorType === 'HUMAN') {
          const email = localEmailByProfileId.get(c.actorId);
          const prodProfileId = email ? prodProfileIdByEmail.get(email) : undefined;
          if (!prodProfileId) {
            skippedCommentActor++;
            return null;
          }
          actorId = prodProfileId;
        }

        if (c.actorType === 'AGENT') {
          const name = localAgentNameById.get(c.actorId);
          const prodAgentId = name ? prodAgentIdByName.get(name) : undefined;
          if (!prodAgentId) {
            skippedCommentActor++;
            return null;
          }
          actorId = prodAgentId;
        }

        return {
          id: c.id,
          storyId: c.storyId,
          actorType: c.actorType,
          actorId,
          parentCommentId: c.parentCommentId,
          authorType: c.authorType,
          body: c.body,
          stance: c.stance,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      })
      .filter(Boolean);

    const mappedCommentIds = new Set(mappedComments.map(c => c.id));
    const mappedCommentsSafe = mappedComments.filter(
      c => !c.parentCommentId || mappedCommentIds.has(c.parentCommentId)
    );

    let skippedBookmarks = 0;
    const mappedBookmarks = localBookmarks
      .map(b => {
        const email = localEmailByProfileId.get(b.profileId);
        const prodProfileId = email ? prodProfileIdByEmail.get(email) : undefined;
        if (!prodProfileId) {
          skippedBookmarks++;
          return null;
        }
        return {
          id: b.id,
          profileId: prodProfileId,
          storyId: b.storyId,
          createdAt: b.createdAt,
        };
      })
      .filter(Boolean);

    let skippedReports = 0;
    const mappedReports = localReports
      .map(r => {
        const email = localEmailByProfileId.get(r.reporterProfileId);
        const prodReporterId = email ? prodProfileIdByEmail.get(email) : undefined;
        if (!prodReporterId) {
          skippedReports++;
          return null;
        }

        if (r.targetType === 'STORY' && !storyIds.has(r.targetId)) {
          skippedReports++;
          return null;
        }
        if (r.targetType === 'COMMENT' && !commentIds.has(r.targetId)) {
          skippedReports++;
          return null;
        }

        return {
          id: r.id,
          reporterProfileId: prodReporterId,
          targetType: r.targetType,
          targetId: r.targetId,
          reason: r.reason,
          details: r.details,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      })
      .filter(Boolean);

    const backupDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `prod-story-graph-backup-${stamp}.json`);

    const prodBackup = {
      trends: await prod.trend.findMany(),
      sources: await prod.source.findMany(),
      stories: await prod.story.findMany(),
      comments: await prod.comment.findMany(),
      bookmarks: await prod.bookmark.findMany(),
      reports: await prod.report.findMany({
        where: { OR: [{ targetType: 'STORY' }, { targetType: 'COMMENT' }] },
      }),
    };
    fs.writeFileSync(backupFile, JSON.stringify(prodBackup, null, 2), 'utf8');

    await prod.$transaction(async tx => {
      await tx.report.deleteMany({
        where: { OR: [{ targetType: 'STORY' }, { targetType: 'COMMENT' }] },
      });
      await tx.bookmark.deleteMany({});
      await tx.comment.deleteMany({});
      await tx.story.deleteMany({});
      await tx.source.deleteMany({});
      await tx.trend.deleteMany({});

      if (localTrends.length) await tx.trend.createMany({ data: localTrends });
      if (localSources.length) await tx.source.createMany({ data: localSources });
      if (localStories.length) await tx.story.createMany({ data: localStories });
      if (mappedCommentsSafe.length) {
        await tx.comment.createMany({ data: mappedCommentsSafe });
      }
      if (mappedBookmarks.length) {
        await tx.bookmark.createMany({ data: mappedBookmarks, skipDuplicates: true });
      }
      if (mappedReports.length) {
        await tx.report.createMany({ data: mappedReports, skipDuplicates: true });
      }
    }, {
      maxWait: 30000,
      timeout: 180000,
    });

    const finalCounts = {
      trends: await prod.trend.count(),
      sources: await prod.source.count(),
      stories: await prod.story.count(),
      comments: await prod.comment.count(),
      bookmarks: await prod.bookmark.count(),
      reports_story_or_comment: await prod.report.count({
        where: { OR: [{ targetType: 'STORY' }, { targetType: 'COMMENT' }] },
      }),
    };

    console.log(
      JSON.stringify(
        {
          backupFile,
          imported: {
            trends: localTrends.length,
            sources: localSources.length,
            stories: localStories.length,
            comments: mappedCommentsSafe.length,
            bookmarks: mappedBookmarks.length,
            reports_story_or_comment: mappedReports.length,
          },
          skipped: {
            comment_actor_not_found_in_prod: skippedCommentActor,
            bookmark_profile_not_found_in_prod: skippedBookmarks,
            report_reporter_or_target_not_found_in_prod: skippedReports,
          },
          finalCounts,
        },
        null,
        2
      )
    );
  } finally {
    await local.$disconnect();
    await prod.$disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
