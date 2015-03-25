'use strict';

var _ = require('lodash');
var knox = require('knox');
var env = require('../env');

// Knox is used to send images to S3
var client = knox.createClient({
  key: env.KNOX_KEY,
  secret: env.KNOX_SECRET,
  bucket: env.KNOX_BUCKET,
  region: env.KNOX_REGION
});

module.exports = function(db) {
  var exports = { };

  exports.photosjson = function(req, res) {
    var urlLocation = req.params.location;
    var query;
    if(urlLocation) {
      query = {location: urlLocation};
    } else {
      query = {$or: [{ location: 'S' }, { location: 'M' }] };
    }
    var collection = db.get('photocollection');
    collection.find(query, function(e, docs){
      var data = {};
      if(docs) {
        _(docs).reverse();
        data = JSON.stringify(docs);
        res.writeHead(200, {
          'Content-Length': data.length,
          'Content-Type': 'application/json'
        });
      }
      res.send(data);
    });
  };

  exports.photo = function (req, res) {
    var photoId = req.params.photoid || 'foobar';
    var filename = photoId + '.png';
    client.getFile(filename, function(err, stream) {
      if(!err) {
        stream.pipe(res);
      } else {
        console.log('oh snap, error ocurred');
      }
    });
  };
return exports;
};