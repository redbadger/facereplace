module.exports = {
  BUCKET_NAME: process.env.BUCKET_NAME,
  ALLOWED_EXTENSIONS: process.env.ALLOWED_EXTENSIONS.split('|'),
  PROCESSED_DIR_NAME: process.env.PROCESSED_DIR_NAME
};
