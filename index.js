const fs = require("fs");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const imagePath = "/tmp/screenshot.jpg";
const baseUrl = "https://exercism.org";

const solutionRegex = /^\/tracks\/(?<track_slug>.+?)\/exercises\/(?<exercise_slug>.+?)\/solutions\/(?<user_handle>.+?)(?:-\d{10})?\.jpg$/;
const profileRegex = /^\/profiles\/(?<user_handle>.+?)(?:-\d{10})?\.jpg$/;

const crypto = require("crypto");

function rawPathToScreenshotData(rawPath) {
  if ((solutionMatch = solutionRegex.exec(rawPath))) {
    const { track_slug, exercise_slug, user_handle } = solutionMatch.groups;

    return {
      url: `${baseUrl}/images/solutions/${track_slug}/${exercise_slug}/${user_handle}`,
      imageSelector: "#image-content",
      waitForSelector: "#image-content .c-code-pane",
    };
  }

  if ((profileMatch = profileRegex.exec(rawPath))) {
    const { user_handle } = profileMatch.groups;

    return {
      url: `${baseUrl}/images/profiles/${user_handle}`,
      imageSelector: "#image-content",
      waitForSelector: "#image-content #contributions-chart",
    };
  }

  throw new Error(`Could not map raw path '${rawPath}' to image URL.`);
}

exports.handler = async (event) => {
  try {
    const { url, imageSelector, waitForSelector } = rawPathToScreenshotData(
      event.rawPath
    );

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
    const page = await browser.newPage();

    await page.goto(url);
    await page.waitForSelector(waitForSelector);

    const image = await page.$(imageSelector);
    await image.screenshot({
      path: imagePath,
      type: "jpeg",
      quality: 80,
    });
    await browser.close();

    const imageBuffer = fs.readFileSync(imagePath);
    const etag = crypto.createHash("md5").update(imageBuffer).digest("hex");

    // Try to extract the 10-digit timestamp from the URL
    // if it ends with -${timestamp}.jpg
    const match = event.rawPath.match(/-(\d{10})\.\w+$/);

    const isTimestamped = !!match;
    const cacheControl = isTimestamped
      ? "public, max-age=31536000, immutable" // New URL containing a timestamp that will never change
      : "public, max-age=86400"; // Legacy URL without a timestamp

    // Use extracted timestamp if available, else use current time
    const lastModified = isTimestamped
      ? new Date(parseInt(match[1], 10) * 1000).toUTCString()
      : new Date().toUTCString();

    return {
      statusCode: 200,
      body: fs.readFileSync(imagePath, { encoding: "base64" }),
      headers: { 
        "Content-Type": "image/jpg",
        "Cache-Control": cacheControl,
        "Last-Modified": lastModified,
        "Etag": `W/"${etag}"`
      },
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: err.message,
    };
  }
};
