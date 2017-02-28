const AWS = require('aws-sdk');
const BpPromise = require('bluebird');
const BUCKET_NAME = require('./constants').BUCKET_NAME;

const rekognition = new AWS.Rekognition();

const params = {
  Image: {
    S3Object: {
      Bucket: BUCKET_NAME,
      Name: i,
    }
  },
  Attributes: [
    'ALL',
  ]
};

const detectFacesOnImages = (images) => BbPromise.reduce(images, (accum, i) => {
  return new BbPromise((resolve, reject) => {
    rekognition.detectFaces(params, (err, data) => {
      if (err) reject(err);
      if (data.FaceDetails.length) accum[i] = data;
      resolve(accum);
    });
  });
}, {});

module.exports = {
  detectFacesOnImages
};
