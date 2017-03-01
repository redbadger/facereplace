module.exports.log = (msg, obj) => obj ?
  console.log(msg, JSON.stringify(obj, null, 2)) :
  console.log(msg);
