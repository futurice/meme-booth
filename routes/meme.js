'use strict';
var PHOTOSDATADIR = require('../env').PHOTOSDATADIR;
var photoUtil = require('../lib/photo-util');
var XDate = require('xdate');
var fs = require('fs');
var assert = require('assert');
var _ = require('lodash');

module.exports = function(db) {
  var exports = { };

  // Few safety precaucions
  assert(fs.statSync(PHOTOSDATADIR).isDirectory());

  var imageURI;

  exports.showmeme = function(req, res) {
    res.render('meme', { title: 'Filter', img: imageURI });
  };

  exports.showmemes = function(req, res) {
    var collection = db.get('photocollection');
    collection.find({location: 'M'}, function(e, docs){
      if(docs) {
        _(docs).reverse();
        res.render('memes', { 'images': _.take(docs, 20)});
      } else {
        res.render('memes', { 'images': []});
      }
    });
  };

  exports.takememeshot = function(req, res) {
    var reqId = _.uniqueId('meme');
    try {
      var string = req.body.data;
      //Maybe not the right way to do this?
      imageURI = string;
      var regex = /^data:.+\/(.+);base64,(.*)$/;
      var matches = string.match(regex);
      var ext = matches[1];
      var data = matches[2];
      var buffer = new Buffer(data, 'base64');
      var now = new XDate();
      var timeAsISO = now.toISOString().replace(/[:\-]/g, '');
      var id = 'M' + timeAsISO + '-' + _.uniqueId();
      var fileName = id + '.' + ext;

      // save file to S3
      photoUtil.saveImageToS3(reqId, buffer, fileName)
        .then(function () {
          return photoUtil.postToTwitter(reqId, buffer, 'M');
        })
        .then(function (twitterUrl) {
          return photoUtil.saveToDB(reqId, db, id, timeAsISO, ext, twitterUrl, 'M');
        })
        .catch(function (err) {
          console.error(reqId, 'ERROR', err);
          res.status(500).json({
            error: '' + err
          });
        })
        .done(function () {
          res.json({});
        });
    } catch (err) {
      console.error('ERROR', err);
      res.json(500).json({
        error: '' + err
      });
    }
  };
  return exports;
};
