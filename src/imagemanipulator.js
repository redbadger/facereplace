const BpPromise = require('bluebird');
const path = require('path');
const uuidV4 = require('uuid/v4');
const gm = require('gm').subClass({imageMagick: true});
const logger = require('./logger');

const getTmpPath = (imageName) => path.join('/tmp', uuidV4() + path.extname(imageName));

const resize = (imagePath, width, height) => new BbPromise((resolve, reject) => {
  const tempPath = getTmpPath('temp.png');
  logger.log('Creating tmp overlay image', {tempPath, width, height, fileName});

  gm(imagePath)
    .resize(width.toString(), height.toString())
    .write(tempPath, (err) => {
      if (err) reject(err);
      resolve(tempPath);
    });
});

const toDisk = (image, path) => new BbPromise((resolve, reject) => {
  image.write(path, (err) => {
    if (err) reject(err);
    else resolve(getTmpPath(path));
  });
});

const toBuffer = (image) => new BbPromise((resolve, reject) => {
  image.toBuffer('jpg', (err, buffer) => {
    if (err) reject(err);
    else resolve(buffer);
  });
});

const getSize = (image, bufferStream) => new BbPromise((resolve, reject) => {
  image.size({
    bufferStream: bufferStream
  }, (err, result) => {
    if (err) {
      reject(err);
    } else {
      logger.log('Found size info', result);
      resolve(result);
    }
  });
});

module.exports = {
  toDisk,
  toBuffer,
  getSize,
  resize
};
