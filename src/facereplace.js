const BbPromise = require('bluebird');
const path = require('path');
const fs = require('fs');

const gm = require('gm').subClass({
  imageMagick: true
});

const logger = require('./logger');
const constants = require('./constants');
const rekognition = require('./rekognition');
const s3 = require('./s3');
const imagemanipulator = require('./imagemanipulator');

const BUCKET_NAME = constants.BUCKET_NAME;
const ALLOWED_EXTENSIONS = constants.ALLOWED_EXTENSIONS;
const PROCESSED_DIR_NAME = constants.PROCESSED_DIR_NAME;

const unlinkAsync = BbPromise.promisify(fs.unlink);

const getImagesFromEvent = (event) => event.Records.reduce((accum, r) => {
  if (r.s3.bucket.name === BUCKET_NAME) {
    const key = r.s3.object.key;
    const extension = path.extname(key).toLowerCase();
    if (ALLOWED_EXTENSIONS.indexOf(extension) !== -1) {
      accum.push(key);
    }
  }
  return accum;
}, []);

const getEmotion = (faceDetails) => {
  if (!faceDetails.Emotions) return 'unknown'

  const emotion = faceDetails.Emotions.reduce((mostLikely, e) => {
    if (mostLikely.Confidence < e.Confidence) {
      mostLikely = e;
    }
    return mostLikely;
  });

  switch (emotion.Type) {
    case 'HAPPY':
    case 'SAD':
    case 'ANGRY':
    case 'CONFUSED':
    case 'DISGUSTED':
    case 'SURPRISED':
    case 'CALM':
    return emotion.Type.toLowerCase();
    case 'UNKNOWN':
    default:
    return 'unknown';
  }
}

const overlayEmoji = BbPromise.coroutine(function* (image, imageHeight, imageWidth, face, tmpEmojis) {
  const boundingBox = face.BoundingBox;
  const faceWidth = parseInt(boundingBox.Width * imageWidth, 10) + 10;
  const faceHeight = parseInt(boundingBox.Height * imageHeight, 10) + 10;
  const emotion = getEmotion(face);
  const imagePath = path.join(__dirname, 'emojis', emotion + '.png');
  const emojiPath = yield imagemanipulator.resize(imagePath, faceWidth, faceHeight);

  tmpEmojis.push(emojiPath);

  const xy = `+${boundingBox.Left * imageWidth}+${boundingBox.Top * imageHeight}`

  logger.log('Composing image', { emojiPath, xy });
  return image.in('-page', xy, emojiPath);
});

const overlayFacesWithEmoji = BbPromise.coroutine(function* (imagePath, imageData, faceDetails) {
  const tmpEmojis = [];

  try {
    const image = gm(imageData);

    const sizeResult = yield imagemanipulator.getSize(image, true);
    const tempImagePath = yield imagemanipulator.toDisk(image, imagePath);

    tmpEmojis.push(tempImagePath);

    const height = sizeResult.height;
    const width = sizeResult.width;

    const composedImage = yield BbPromise.reduce(faceDetails, (i, face) =>
    overlayEmoji(i, height, width, face, tmpEmojis),
    gm().in('-page', '+0+0', tempImagePath) // init with image
  );

  logger.log('Composed image');

  const newImageBuffer = yield imagemanipulator.toBuffer(composedImage.mosaic());

  yield s3.uploadImage(imagePath, newImageBuffer);
} catch (e) {
  throw e;
} finally {
  logger.log('Cleaning up tmp images ', tmpEmojis);

  if (tmpEmojis.length) {
    // Clean up! - this is important Lambda is not completely stateless
    yield BbPromise.all(tmpEmojis, (p) => unlinkAsync(p));
  }
}
});

const processImages = (imageFaces) => BbPromise.map(Object.keys(imageFaces), (imagePath) =>
  s3.downloadImage(imagePath).then((response) => {
    const faceDetails = imageFaces[imagePath].FaceDetails;
    return overlayFacesWithEmoji(imagePath, response.Body, faceDetails);
  })
);

module.exports.handler = BbPromise.coroutine(function* (event, context, callback) {
  try {
    logger.log('Recieved Event', event);
    const images = getImagesFromEvent(event);

    logger.log('Found images on event', images);
    const imageFaces = yield rekognition.detectFacesOnImages(images);

    logger.log('Detected faces', imageFaces);
    yield processImages(imageFaces);

    callback(null);
  } catch (err) {
    logger.log('Error', err);
    callback(err);
  }
});
