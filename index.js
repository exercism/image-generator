const fs = require("fs");
const crypto = require("crypto");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const satoriRenderer = require("./satori_renderer");
const profileRenderer = require("./profile_renderer");

const imagePath = "/tmp/screenshot.jpg";
const baseUrl = "https://exercism.org";

// The satori renderer reads its payload over the internal ALB, so it never
// leaves the VPC. The Chrome path still uses the public site: it's
// screenshotting a rendered page, not reading a payload.
const internalBaseUrl = process.env.INTERNAL_BASE_URL || "https://internal.exercism.org";

// Writing through to S3 makes the cost of generating an image a function of how
// many exist rather than how many times they're requested - CDN edge caches are
// per-PoP and evict the long tail, which is most of these.
const bucket = process.env.IMAGE_BUCKET || "exercism-v3-assets";
const keyPrefix = process.env.IMAGE_KEY_PREFIX || "generated-images";

const s3 = new S3Client({});

// Both must stay under the Lambda's 20s timeout; puppeteer's own defaults are
// 30s, so a hung render burned the full 20s at 2GB rather than failing fast.
const navigationTimeout = parseInt(process.env.NAVIGATION_TIMEOUT_MS || "6000", 10);
const selectorTimeout = parseInt(process.env.SELECTOR_TIMEOUT_MS || "6000", 10);

const legacyMaxAge = 86400;

// Off by default so the browserless output can be eyeballed against the Chrome
// path before it's enabled.
const satoriEnabled = process.env.RENDERER === "satori";

const solutionRegex = /^\/tracks\/(?<track_slug>.+?)\/exercises\/(?<exercise_slug>.+?)\/solutions\/(?<user_handle>.+?)(?:-\d{10})?\.jpg$/;
const profileRegex = /^\/profiles\/(?<user_handle>.+?)(?:-\d{10})?\.jpg$/;

function rawPathToScreenshotData(rawPath) {
  const solutionMatch = solutionRegex.exec(rawPath);
  if (solutionMatch) {
    const { track_slug, exercise_slug, user_handle } = solutionMatch.groups;

    return {
      kind: "solution",
      url: `${baseUrl}/images/solutions/${track_slug}/${exercise_slug}/${user_handle}`,
      dataUrl: `${internalBaseUrl}/spi/solution_image_data/${track_slug}/${exercise_slug}/${user_handle}`,
      imageSelector: "#image-content",
      waitForSelector: "#image-content .c-code-pane",
    };
  }

  const profileMatch = profileRegex.exec(rawPath);
  if (profileMatch) {
    const { user_handle } = profileMatch.groups;

    return {
      kind: "profile",
      url: `${baseUrl}/images/profiles/${user_handle}`,
      dataUrl: `${internalBaseUrl}/spi/profile_image_data/${user_handle}`,
      imageSelector: "#image-content",
      waitForSelector: "#image-content #contributions-chart",
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

async function generateImage({ url, imageSelector, waitForSelector }) {
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
    defaultViewport: { ...chromium.defaultViewport, deviceScaleFactor: 2 },
    args: [
      ...chromium.args,
      "--hide-scrollbars",
      "--disable-web-security",
      "--high-dpi-support=1",
    ],
  });

  // Closed on the way out, or a failed render leaks it into the next warm
  // invocation.
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(navigationTimeout);

    await page.goto(url);
    await page.waitForSelector(waitForSelector, { timeout: selectorTimeout });

    const image = await page.$(imageSelector);
    await image.screenshot({
      path: imagePath,
      type: "jpeg",
      quality: 80,
    });

    return { body: fs.readFileSync(imagePath), contentType: "image/jpg" };
  } finally {
    await browser.close();
  }
}

const satoriRenderers = {
  solution: satoriRenderer.generate,
  profile: profileRenderer.generate,
};

function rendererFor(screenshotData) {
  if (satoriEnabled) return satoriRenderers[screenshotData.kind] || generateImage;

  return generateImage;
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
