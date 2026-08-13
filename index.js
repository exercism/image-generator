const crypto = require("crypto");
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const satoriRenderer = require("./satori_renderer");
const profileRenderer = require("./profile_renderer");

// Payloads are read over the internal ALB, so a render never leaves the VPC.
const internalBaseUrl = process.env.INTERNAL_BASE_URL || "https://internal.exercism.org";

// Writing through to S3 makes the cost of generating an image a function of how
// many exist rather than how many times they're requested - CDN edge caches are
// per-PoP and evict the long tail, which is most of these.
const bucket = process.env.IMAGE_BUCKET || "exercism-v3-assets";
const keyPrefix = process.env.IMAGE_KEY_PREFIX || "generated-images";

const s3 = new S3Client({});

const legacyMaxAge = 86400;

const solutionRegex = /^\/tracks\/(?<track_slug>.+?)\/exercises\/(?<exercise_slug>.+?)\/solutions\/(?<user_handle>.+?)(?:-\d{10})?\.jpg$/;
const profileRegex = /^\/profiles\/(?<user_handle>.+?)(?:-\d{10})?\.jpg$/;

function rawPathToScreenshotData(rawPath) {
  const solutionMatch = solutionRegex.exec(rawPath);
  if (solutionMatch) {
    const { track_slug, exercise_slug, user_handle } = solutionMatch.groups;

    return {
      kind: "solution",
      dataUrl: `${internalBaseUrl}/spi/solution_image_data/${track_slug}/${exercise_slug}/${user_handle}`,
    };
  }

  const profileMatch = profileRegex.exec(rawPath);
  if (profileMatch) {
    const { user_handle } = profileMatch.groups;

    return {
      kind: "profile",
      dataUrl: `${internalBaseUrl}/spi/profile_image_data/${user_handle}`,
    };
  }

  throw new Error(`Could not map raw path '${rawPath}' to image URL.`);
}

// URLs ending in -${timestamp}.jpg address a version that will never change, so
// they can be cached forever. Legacy URLs without one address mutable content.
function cacheMetadata(rawPath) {
  const match = rawPath.match(/-(\d{10})\.\w+$/);
  const isTimestamped = !!match;

  return {
    isTimestamped,
    cacheControl: isTimestamped
      ? "public, max-age=31536000, immutable"
      : `public, max-age=${legacyMaxAge}`,
    lastModified: isTimestamped
      ? new Date(parseInt(match[1], 10) * 1000).toUTCString()
      : new Date().toUTCString(),
  };
}

function s3Key(rawPath) {
  return `${keyPrefix}${rawPath}`;
}

function imageResponse({ body, contentType }, { cacheControl, lastModified }) {
  const etag = crypto.createHash("md5").update(body).digest("hex");

  return {
    statusCode: 200,
    body: body.toString("base64"),
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "Last-Modified": lastModified,
      "Etag": `W/"${etag}"`,
    },
    isBase64Encoded: true,
  };
}

// A cache problem should never stop us serving an image, so every failure here
// falls through to generating one.
async function fetchFromS3(key, { isTimestamped }) {
  try {
    const object = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );

    // Legacy URLs point at mutable content, so a stored copy is only good for
    // as long as we'd have let a CDN hold onto it.
    if (!isTimestamped) {
      const age = (Date.now() - object.LastModified.getTime()) / 1000;
      if (age > legacyMaxAge) return null;
    }

    return {
      body: Buffer.from(await object.Body.transformToByteArray()),
      // Per object, so images cached before the renderer changed keep serving.
      contentType: object.ContentType || "image/jpg",
    };
  } catch (err) {
    if (err.name !== "NoSuchKey" && err.name !== "NotFound") {
      console.error(`Failed reading ${key} from S3: ${err.message}`);
    }
    return null;
  }
}

async function writeToS3(key, { body, contentType }, cacheControl) {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      })
    );
  } catch (err) {
    console.error(`Failed writing ${key} to S3: ${err.message}`);
  }
}

const renderers = {
  solution: satoriRenderer.generate,
  profile: profileRenderer.generate,
};

function rendererFor({ kind }) {
  const renderer = renderers[kind];
  if (!renderer) throw new Error(`No renderer for image kind '${kind}'.`);

  return renderer;
}

exports.handler = async (event) => {
  try {
    const screenshotData = rawPathToScreenshotData(event.rawPath);
    const metadata = cacheMetadata(event.rawPath);
    const key = s3Key(event.rawPath);

    const cached = await fetchFromS3(key, metadata);
    if (cached) return imageResponse(cached, metadata);

    const image = await rendererFor(screenshotData)(screenshotData);
    await writeToS3(key, image, metadata.cacheControl);

    return imageResponse(image, metadata);
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      body: err.message,
    };
  }
};
