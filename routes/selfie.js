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

  exports.showselfie = function(req, res) {
    res.render('selfie', { title: 'Snapshot' });
  };

  exports.showphotos = function(req, res) {
    var collection = db.get('photocollection');
    collection.find({location: 'S'}, function(e, docs){
      if(docs) {
        _(docs).reverse();
        res.render('selfies', { 'images': _.take(docs, 20)});
      } else {
        res.render('selfies', { 'images': []});
      }
    });
  };

  exports.showmemes = function() {
    return function(req, res) {
      var collection = db.get('photocollection');
      collection.find({location: 'M'}, function(e, docs){
        _(docs).reverse();
        res.render('memes', { 'images': _.take(docs, 20)});
      });
    };
  };

  exports.takesnapshot = function(req, res) {
    var reqId = _.uniqueId('snap');
    console.log(reqId, 'Entered takesnapshot');
    try {
      var string = req.body.data;
      var regex = /^data:.+\/(.+);base64,(.*)$/;
      var matches = string.match(regex);
      var ext = matches[1];
      var data = matches[2];
      var buffer = new Buffer(data, 'base64');
      var now = new XDate();
      var timeAsISO = now.toISOString().replace(/[:\-]/g, '');
      var id = 'S' + timeAsISO + '-' + _.uniqueId();
      var fileName = id + '.' + ext;
      console.log(reqId, 'file name', fileName);
      console.log(reqId, 'data length', data.length);

      photoUtil.saveImageToS3(reqId, buffer, fileName)
      .then(function () {
        return photoUtil.postToTwitter(reqId, buffer, 'S');
      })
      .then(function (urlToTwitter) {
        console.log(reqId, 'twitter responded with url', urlToTwitter);
        return photoUtil.saveToDB(reqId, db, id, timeAsISO, ext, urlToTwitter, 'S');
      })
      .catch(function (error) {
        console.error(reqId, 'Saving failed big time', error);
        res.status(500).json({ error: error });
      })
      .done(function(){
        res.json({ });
      });
    } catch (err) {
      console.error(reqId, 'ERROR', err);
      res.status(500).json({ error: '' + err });
    }
  };
  return exports;
};
