'use strict';
var XDate = require('xdate');
var request = require('request');
var when = require('when');
var knox = require('knox');
var env = require('../env');
var XDate = require('xdate');

// Knox is used to send images to S3
var client = knox.createClient({
  key: env.KNOX_KEY,
  secret: env.KNOX_SECRET,
  bucket: env.KNOX_BUCKET,
  region: env.KNOX_REGION
});

module.exports = {
    saveImageToS3: saveImageToS3,
    postToTwitter: postToTwitter,
    saveToDB: saveToDB
};

    function saveImageToS3(reqId, buffer, fileName) {
        var deferred = when.defer();
        var headers = {'Content-Type': 'text/plain'};
        client.putBuffer(buffer, '/' + fileName, headers, function(err, res) {
             var status = res.statusCode;
             if (err) {
               console.error(reqId, 'Error saving to S3', err);
               deferred.reject(err);
               return;
             }
             if (200 !== res.statusCode) {
              deferred.reject(new Error('Status code 200 != ' + status));
            }
          deferred.resolve('saved');
        });
        return deferred.promise;
    }

  function postToTwitter(reqId, buffer, location) {
    var deferred = when.defer();
    var now = new XDate();
    console.log('tweet');
    var r = request.post({
      url: 'https://api.twitter.com/1.1/statuses/update_with_media.json',
      oauth: {
        'consumer_key': env.TWITTER_CONSUMER_KEY,
        'consumer_secret': env.TWITTER_CONSUMER_SECRET,
        'token': env.TWITTER_TOKEN,
        'token_secret': env.TWITTER_TOKEN_SECRET
      }
    }, function(err, response, body) {
        if (!err && response && response.statusCode === 200) {
            console.log('tweeted');
        deferred.resolve(body);
        } else {
            console.log('tweet failed, err ' + err);
            if (env.TWITTER_CONSUMER_KEY === '') {
              deferred.resolve(body);
            } else {
          deferred.reject(err);
        }
      }
    });
    var statusText = 'New Meme: ';
    if(location === 'S') {
        statusText = 'New Visitor: ';
    }
    var status = statusText + now.toString('d.M.yyyy HH:mm:ss');
    var form = r.form();
    form.append('status', status);
    form.append('media[]', buffer);

    return deferred.promise
      .then(JSON.parse)
      .then(function (json) {
        if (env.TWITTER_CONSUMER_KEY !== '') {
          return json.entities.media[0].expanded_url;
        } else {
          return 'Twitter is not defined';
        }
      });
  }

function saveToDB(reqId, db, id, timeAsISO, ext, twitterUrl, location) {
  var deferred = when.defer();
  console.log(reqId, 'going to save to db');
  var collection = db.get('photocollection');
  collection.insert({
    id: id,
    location: location,
    url: '/photo/' + id,
    twitter_url: twitterUrl,
    time: timeAsISO,
    timestamp: new Date(),
    extension: ext,
    deleted: false
  }, function(err, saved) {
    console.log(reqId, 'saved to db', err + '/' + JSON.stringify(saved));
    if (err || !saved) {
      console.error(reqId, 'Photo not saved', err, saved);
      deferred.reject(err || new Error('photo not saved'));
    } else {
      console.log(reqId, 'Photo saved' + id);
      deferred.resolve(saved);
    }
  });
  return deferred.promise;
}