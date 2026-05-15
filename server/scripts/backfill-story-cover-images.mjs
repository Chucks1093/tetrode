import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

function parseArgs(argv) {
  const args = { envFile: '.env', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env' && argv[i + 1]) {
      args.envFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}

function loadEnv(file) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing env file: ${fullPath}`);
  }
  return dotenv.parse(fs.readFileSync(fullPath));
}

function sanitizeImageAltText(value) {
  const cleaned = String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[\[\]]/g, '')
    .trim();
  if (!cleaned) return 'Story cover image';
  return cleaned.slice(0, 180);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findImageTag(markdown, imageUrl) {
  const pattern = new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegExp(imageUrl)}\\)`);
  return markdown.match(pattern);
}

function hasImageTag(markdown, imageUrl) {
  return !!findImageTag(markdown, imageUrl);
}

function normalizePublisher(publisher) {
  return String(publisher ?? '').trim() || 'Source';
}

function looksGenericTitle(title) {
  const value = String(title ?? '').trim().toLowerCase();
  if (!value) return true;
  return (
    value === 'reference' ||
    value.startsWith('reference from ') ||
    value === 'home' ||
    value === 'blog' ||
    value === 'news' ||
    value === 'rss feed' ||
    value === 'subscribe to rss'
  );
}

function pickBestAlt(story, sourceCandidates) {
  const byRank = [...sourceCandidates].sort((a, b) => a.rank - b.rank);
  for (const source of byRank) {
    if (!looksGenericTitle(source.title)) {
      return sanitizeImageAltText(source.title);
    }
  }

  for (const source of byRank) {
    if (source.title && source.title.trim().length > 0) {
      return sanitizeImageAltText(source.title);
    }
  }

  if (story.title && story.title.trim().length > 0) {
    return sanitizeImageAltText(story.title);
  }

  if (byRank[0]) {
    return sanitizeImageAltText(`${normalizePublisher(byRank[0].publisher)} source image`);
  }

  return 'Story cover image';
}

function prependImage(markdown, imageUrl, altText) {
  const body = String(markdown ?? '').trim();
  const imageLine = `![${sanitizeImageAltText(altText)}](${imageUrl})`;
  if (!body) return `${imageLine}\n`;
  return `${imageLine}\n\n${body}`;
}

async function applyBackfill(prisma, dryRun) {
  const stories = await prisma.story.findMany({
    where: { imageUrl: { not: null } },
    select: {
      id: true,
      trendId: true,
      title: true,
      bodyMarkdown: true,
      imageUrl: true,
    },
  });

  if (stories.length === 0) {
    return {
      storiesWithImage: 0,
      updatedMissingImageMarkdown: 0,
      updatedAltOnly: 0,
      alreadyCorrect: 0,
      dryRun,
      sampleUpdatedStoryIds: [],
    };
  }

  const trendIds = [...new Set(stories.map(story => story.trendId))];
  const sources = await prisma.source.findMany({
    where: {
      trendId: { in: trendIds },
      imageUrl: { not: null },
    },
    select: {
      trendId: true,
      rank: true,
      imageUrl: true,
      title: true,
      publisher: true,
    },
  });

  const sourceByTrendAndImage = new Map();
  for (const source of sources) {
    const key = `${source.trendId}::${source.imageUrl}`;
    if (!sourceByTrendAndImage.has(key)) sourceByTrendAndImage.set(key, []);
    sourceByTrendAndImage.get(key).push(source);
  }

  const updates = [];
  let alreadyCorrect = 0;
  let updatedAltOnly = 0;
  let updatedMissingImageMarkdown = 0;

  for (const story of stories) {
    const imageUrl = story.imageUrl;
    if (!imageUrl) continue;

    const key = `${story.trendId}::${imageUrl}`;
    const sourceCandidates = sourceByTrendAndImage.get(key) ?? [];
    const expectedAlt = pickBestAlt(story, sourceCandidates);
    const body = String(story.bodyMarkdown ?? '');

    if (hasImageTag(body, imageUrl)) {
      const match = findImageTag(body, imageUrl);
      const currentAlt = sanitizeImageAltText(match?.[1] ?? '');
      if (currentAlt && currentAlt === expectedAlt) {
        alreadyCorrect += 1;
        continue;
      }

      const escapedUrl = escapeRegExp(imageUrl);
      const updatedBody = body.replace(
        new RegExp(`!\\[[^\\]]*\\]\\(${escapedUrl}\\)`),
        `![${expectedAlt}](${imageUrl})`
      );

      if (updatedBody !== body) {
        updates.push({ id: story.id, bodyMarkdown: updatedBody });
        updatedAltOnly += 1;
      } else {
        alreadyCorrect += 1;
      }
      continue;
    }

    updates.push({
      id: story.id,
      bodyMarkdown: prependImage(body, imageUrl, expectedAlt),
    });
    updatedMissingImageMarkdown += 1;
  }

  if (!dryRun && updates.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      await prisma.$transaction(
        chunk.map(update =>
          prisma.story.update({
            where: { id: update.id },
            data: { bodyMarkdown: update.bodyMarkdown },
          })
        )
      );
    }
  }

  return {
    storiesWithImage: stories.length,
    updatedMissingImageMarkdown,
    updatedAltOnly,
    alreadyCorrect,
    dryRun,
    sampleUpdatedStoryIds: updates.slice(0, 10).map(row => row.id),
  };
}

async function main() {
  const { envFile, dryRun } = parseArgs(process.argv.slice(2));
  const env = loadEnv(envFile);
  if (!env.DATABASE_URL) {
    throw new Error(`Missing DATABASE_URL in ${envFile}`);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

  try {
    const ping = await prisma.$queryRawUnsafe('SELECT current_database() as db, now() as now');
    const result = await applyBackfill(prisma, dryRun);

    console.log(
      JSON.stringify(
        {
          envFile,
          ping,
          ...result,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
