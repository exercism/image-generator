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

const imagePath = "/tmp/screenshot.jpg";
const baseUrl = "https://exercism.org";

// The satori renderer fetches its data over the internal ALB rather than the
// public site, so it never leaves the VPC and doesn't depend on this lambda's
// NAT address being allowlisted in Cloudflare. The Chrome path still uses the
// public site: it's screenshotting a rendered page, not reading a payload.
const internalBaseUrl = process.env.INTERNAL_BASE_URL || "https://internal.exercism.org";

// Generating an image costs a few seconds of headless Chrome at 2GB, so we only
// ever want to pay for it once per distinct URL. CDN edge caches can't give us
// that on their own: they're per-PoP, they evict the long tail (most images are
// fetched a handful of times ever), and a flood of distinct URLs misses them
// entirely. Writing through to S3 makes the cost a function of how many images
// exist rather than how many times they're requested.
const bucket = process.env.IMAGE_BUCKET || "exercism-v3-assets";
const keyPrefix = process.env.IMAGE_KEY_PREFIX || "generated-images";

const s3 = new S3Client({});

// These must stay comfortably under the Lambda's 20s timeout. puppeteer
// defaults both to 30s, which is longer, so before this a render that hung
// burned the full 20s at 2GB rather than failing fast.
const navigationTimeout = parseInt(process.env.NAVIGATION_TIMEOUT_MS || "6000", 10);
const selectorTimeout = parseInt(process.env.SELECTOR_TIMEOUT_MS || "6000", 10);

const legacyMaxAge = 86400;

// Solutions can be drawn without a browser, which is far cheaper. Off by
// default so it can be enabled once its output has been eyeballed against the
// Chrome path; profiles have no satori renderer yet and always use Chrome.
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

    // Legacy URLs point at content that can change, so a stored copy is only
    // good for as long as we'd have let a CDN hold onto it.
    if (!isTimestamped) {
      const age = (Date.now() - object.LastModified.getTime()) / 1000;
      if (age > legacyMaxAge) return null;
    }

    return {
      body: Buffer.from(await object.Body.transformToByteArray()),
      // Stored per object, so images cached before the renderer changed keep
      // being served as whatever they were written as.
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

  // Now that a render can fail rather than take the whole container down with
  // it, the browser has to be closed on the way out or it leaks into the next
  // warm invocation.
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

function rendererFor(screenshotData) {
  if (satoriEnabled && screenshotData.kind === "solution") return satoriRenderer.generate;

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
