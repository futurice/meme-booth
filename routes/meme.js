"use strict";
var PHOTOSDATADIR = require("../env").PHOTOSDATADIR;

var XDate = require("xdate");
var request = require("request");
var fs = require("fs");
var assert = require("assert");
var when = require("when");
var _ = require("lodash");
var knox = require("knox");
var env = require("../env");

var client = knox.createClient({
  key: env.KNOX_KEY,
  secret: env.KNOX_SECRET,
  bucket: env.KNOX_BUCKET,
  region: env.KNOX_REGION
});

// Few safety precaucions
assert(fs.statSync(PHOTOSDATADIR).isDirectory());

var imageURI;

exports.showmemes = function(db){
  return function(req, res) {
    var collection = db.get("photocollection");
    collection.find({location: "M"}, function(e, docs){
      if(docs) {
        _(docs).reverse();
        res.render("memes", { "images": _.take(docs, 20)});
      } else {
        res.render("memes", { "images": []});
      }
    });
  };
};

exports.takememeshot = function(db) {
  return function(req, res) {
    var reqId = _.uniqueId("meme");

    try {

      var string = req.body.data;
      //Maybe not the right way to do this?
      imageURI = string;
      var regex = /^data:.+\/(.+);base64,(.*)$/;
      var matches = string.match(regex);
      var ext = matches[1];
      var data = matches[2];
      var buffer = new Buffer(data, "base64");
      var now = new XDate();
      var timeAsISO = now.toISOString().replace(/[:\-]/g, "");
      var id = "M" + timeAsISO + "-" + _.uniqueId();
      var fileName = id + "." + ext;

      // save file to S3
      saveToS3(reqId, buffer, fileName)
        .then(function () {
          return postToTwitter(reqId, buffer);
        })
        .then(function (twitterUrl) {
          return saveToDB(reqId, db, id, timeAsISO, ext, twitterUrl);
        })
        .catch(function (err) {
          console.error(reqId, "ERROR", err);
          res.status(500).json({
            error: "" + err
          });
        })
        .done(function () {
          res.json({});
        });
    } catch (err) {
      console.error("ERROR", err);
      res.json(500).json({
        error: "" + err
      });
    }
  };
};

exports.showfilter = function(req, res) {
  res.render("filter", { title: "Filter", img: imageURI });
};

function saveToS3(reqId, buffer, fileName) {
  var deferred = when.defer();

  var headers = {"Content-Type": "text/plain"};
  client.putBuffer(buffer, "/" + fileName, headers, function(err, res) {
       var status = res.statusCode;

       console.log("in put: " + status);

       if (err) {
         console.error(reqId, "Error saving to S3", err);
         deferred.reject(err);
         return;
       }

       if (200 !== res.statusCode) {
      deferred.reject(new Error("Status code 200 != " + status));
    }

    deferred.resolve("saved");
  });

  return deferred.promise;
}

function postToTwitter(reqId, buffer) {
  var deferred = when.defer();
  var now = new XDate();
  console.log("tweet");
  var r = request.post({
    url: "https://api.twitter.com/1.1/statuses/update_with_media.json",
    // snapshotNowMeme
    oauth: {
      "consumer_key": env.TWITTER_CONSUMER_KEY,
      "consumer_secret": env.TWITTER_CONSUMER_SECRET,
      "token": env.TWITTER_TOKEN,
      "token_secret": env.TWITTER_TOKEN_SECRET
    }
  }, function(err, response, body) {
      if (!err && response && response.statusCode === 200) {
          console.log("tweeted");
      deferred.resolve(body);
      } else {
          console.log("tweet failed, err " + err);
          if (env.TWITTER_CONSUMER_KEY === "") {
        deferred.resolve(body);
          } else {
        deferred.reject(err);
      }
    }
  });

  var status = "New Meme: " + now.toString("d.M.yyyy HH:mm:ss");
  var form = r.form();
  form.append("status", status);
  form.append("media[]", buffer);

  return deferred.promise
    .then(JSON.parse)
    .then(function (json) {
      if (env.TWITTER_CONSUMER_KEY !== "") {
        return json.entities.media[0].expanded_url;
      } else {
        return "Twitter is not defined";
      }
    });
}

function saveToDB(reqId, db, id, timeAsISO, ext, twitterUrl) {
  var deferred = when.defer();
  // Save to db only if post to twitter succeeded
  console.log(reqId, "going to save to db");
  var collection = db.get("photocollection");
  collection.insert({
    id: id,
    location: "M",
    url: "/photo/" + id,
    twitter_url: twitterUrl,
    time: timeAsISO,
    timestamp: new Date(),
    extension: ext,
    deleted: false
  }, function(err, saved) {
    console.log(reqId, "saved to db", err + "/" + JSON.stringify(saved));
    if (err || !saved) {
      console.error(reqId, "Photo not saved", err, saved);
      deferred.reject(err || new Error("photo not saved"));
    } else {
      console.log(reqId, "Photo saved" + id);
      deferred.resolve(saved);
    }
  });

  return deferred.promise;
}
