'use strict';
var _ = require('lodash');

var express = require('express');
var path = require('path');

var env = require('./env.js');
_.each(env, function (value, key) {
  console.info('env ' + key + ': ' + value);
});

// Mongo db setup
var monk = require('monk');
var db = monk(env.MONGODB);

// HTTP basic auth setup
var auth = require('http-auth');
var basic = auth.basic({
  realm: 'Snapshot'
  }, function(username, password, callback) {
    callback(username === env.USERNAME && password === env.PASSWORD);
  }
);

var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes');
var photos = require('./routes/photo')(db);
var selfie = require('./routes/selfie');
// var monitor = require('./routes/monitor');

var app = express();
app.use(auth.connect(basic));

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hjs');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(express.bodyParser());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);

app.get('/', routes.index);

app.get('/photos', photos.showphotos);
app.get('/photosjson', photos.photosjson);
app.get('/photo/:photoid', photos.photo);
app.post('/takesnapshot', photos.takesnapshot);
app.post('/takememeshot', selfie.takememeshot(db));
app.get('/filter', selfie.showfilter);
app.get('/memes', selfie.showmemes(db));

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res /* , next */) {
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res /*, next */) {
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
