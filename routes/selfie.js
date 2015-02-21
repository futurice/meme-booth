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

// Knox is used to send images to S3
var client = knox.createClient({
  key: env.KNOX_KEY,
  secret: env.KNOX_SECRET,
  bucket: env.KNOX_BUCKET,
  region: env.KNOX_REGION
});

module.exports = function(db) {
  var exports = { };

  // Few safety precaucions
  assert(fs.statSync(PHOTOSDATADIR).isDirectory());

  exports.showselfie = function(req, res){
    res.render("selfie", { title: "Snapshot" });
  };

  exports.showphotos = function(req, res) {
    var collection = db.get("photocollection");
    collection.find({location: "S"}, function(e, docs){
      if(docs) {
        _(docs).reverse();
        res.render("selfies", { "images": _.take(docs, 20)});
      } else {
        res.render("selfies", { "images": []});
      }
    });
  };

  exports.photosjson = function(req, res) {
    var urlLocation = req.params.location;
    var query;
    if(urlLocation) {
      query = {location: urlLocation}
    } else {
      query = {$or: [{ location: "S" }, { location: "M" }] };
    }
    var collection = db.get("photocollection");
    collection.find(query, function(e, docs){
      var data = {};
      if(docs) {
        _(docs).reverse();
        data = JSON.stringify(docs);
        res.writeHead(200, {
          "Content-Length": data.length,
          "Content-Type": "application/json"
        });
      }
      res.send(data);
    });
  };

  exports.filterphotos = function(req, res) {
    res.render("filter");
  };

  exports.photo = function (req, res) {
    var photoId = req.params.photoid || "foobar";
    var filename = photoId + ".png";
    client.getFile(filename, function(err, stream) {
      if(!err) {
        stream.pipe(res);
      } else {
        console.log("oh snap, error ocurred");
      }
    });
  };

  exports.takesnapshot = function(req, res) {
    var reqId = _.uniqueId("snap");
    console.log(reqId, "Entered takesnapshot");
    try {
      var string = req.body.data;
      var regex = /^data:.+\/(.+);base64,(.*)$/;
      var matches = string.match(regex);
      var ext = matches[1];
      var data = matches[2];
      var buffer = new Buffer(data, "base64");
      var now = new XDate();
      var timeAsISO = now.toISOString().replace(/[:\-]/g, "");
      var id = "S" + timeAsISO + "-" + _.uniqueId();
      var fileName = id + "." + ext;
      console.log(reqId, "file name", fileName);
      console.log(reqId, "data length", data.length);

      saveImageToS3(reqId, buffer, fileName)
      .then(function () {
        return postToTwitter(reqId, buffer, now);
      })
      .then(function (urlToTwitter) {
        console.log(reqId, "twitter responded with url", urlToTwitter);
        return saveToDB(reqId, db, id, timeAsISO, ext, urlToTwitter);
      })
      .catch(function (error) {
        console.error(reqId, "Saving failed big time", error);
        res.status(500).json({ error: error });
      })
      .done(function(){
        res.json({ });
      });
    } catch (err) {
      console.error(reqId, "ERROR", err);
      res.status(500).json({ error: "" + err });
    }
  };
  return exports;
};

function saveImageToS3(reqId, buffer, fileName) {
  var deferred = when.defer();
  var headers = {"Content-Type": "text/plain"};
  client.putBuffer(buffer, "/" + fileName, headers, function(err, res) {
    console.log(reqId, "putBuffer, err - res " + err + " - " + res);
    if(res && res.statusCode === 200) {
      deferred.resolve("photo saved to S3");
    } else {
      console.error(reqId, "ERR failed to put to buffer");
      deferred.reject(new Error("Save to S3 failed"));
    }
  });

  return deferred.promise;
}

function postToTwitter(reqId, buffer, now) {
  var deferred = when.defer();

  var r = request.post({
    url: "https://api.twitter.com/1.1/statuses/update_with_media.json",
    oauth: {
      "consumer_key": env.TWITTER_CONSUMER_KEY,
      "consumer_secret": env.TWITTER_CONSUMER_SECRET,
      "token": env.TWITTER_TOKEN,
      "token_secret": env.TWITTER_TOKEN_SECRET
    }
  }, function (err, response, body) {
    console.log(reqId, "posted tweet: err - response " + err + " - " + response);
    if (response) {
      deferred.resolve(body);
    } else {
      if (env.TWITTER_CONSUMER_KEY === "") {
        deferred.resolve(body);
      } else {
        deferred.reject(new Error("Post to Twitter failed"));
      }
    }
  });

  var status = "New Visitor: " + now.toString("d.M.yyyy HH:mm:ss");
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
    location: "S",
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
