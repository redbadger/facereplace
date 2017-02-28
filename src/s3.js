const AWS = require('aws-sdk');
const BbPromise = require('bluebird');
const path = require('path');
const constants = require('./constants');

const BUCKET_NAME = constants.BUCKET_NAME;
const PROCESSED_DIR_NAME = constants.BUCKET_NAME;

const s3 = new AWS.S3();

const downloadImage = (imagePath) => new BbPromise((resolve, reject) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: imagePath
  };

  s3.getObject(params, (err, data) => {
    if (err) reject(err);
    else resolve(data);
  });
});

const uploadImage = (imagePath, imageData) => new BbPromise((resolve, reject) => {
  const fileName = path.basename(imagePath);
  const params = {
    Bucket: BUCKET_NAME,
    Key: path.join(PROCESSED_DIR_NAME, fileName),
    Body: imageData,
  };

  s3.putObject(params, (err, data) => {
    if (err) reject(err);
    else resolve(data);
  });
});

module.exports = {
  downloadImage,
  uploadImage
};
