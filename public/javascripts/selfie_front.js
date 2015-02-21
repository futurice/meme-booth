'use strict';

var width = 460;
var height = 460;
var stwidth = '500px';
var webcamWidth = 640;
var webcamHeight = 480;
var propertionalWidth = height / webcamHeight * webcamWidth;
var leftMargin = Math.floor((propertionalWidth - width) / 2);
var allowedToPressButton = true;

Webcam.set({
  width: 640,
  height: 480,
  dest_width: 640,
  dest_height: 480,
  image_format: 'jpeg',
  jpeg_quality: 90,
  force_flash: false
});

Webcam.attach('#my-camera');
$('#my-camera video').removeAttr('style');

function enableFullscreen() {
  var docElm = document.documentElement;
  if (docElm.requestFullscreen) {
    docElm.requestFullscreen();
  } else if (docElm.mozRequestFullScreen) {
    docElm.mozRequestFullScreen();
  } else if (docElm.webkitRequestFullScreen) {
    docElm.webkitRequestFullScreen();
  }
}

function process(dataUri, callback) {
  var canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  var ctx = canvas.getContext('2d');
  // http://stackoverflow.com/questions/4773966/drawing-an-image-from-a-data-url-to-a-canvas
  var img = new Image();
  img.onload = function () {
    console.log(img.width, img.height);

    // Mirror
    // translate context to center of canvas
    ctx.translate(canvas.width, 0);

    // flip context horizontally
    ctx.scale(-1, 1);

    ctx.drawImage(img, leftMargin, 0, webcamHeight, webcamHeight, 0, 0, width, height);

    // Unmirror
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    attachFilterToImage(canvas, callback);
  };
// start the chain, assign src field to the image
    img.src = dataUri;
}

function attachFilterToImage(canvas, callback) {
  var ctx = canvas.getContext('2d');
  var fImg = new Image();
  fImg.onload = function () {
    ctx.drawImage(fImg, 0, 0, width, height);
    console.log(canvas);
    callback(canvas);
  };
  fImg.src = '/img/filters/photo_filter_logo.png';
}

function takePicture() {
  console.log('taking picture');
  var dataUri = Webcam.snap();
  showSnapshot(dataUri);
  process(dataUri, function(canvas){
    $.post('/takeselfieshot', { data: canvas.toDataURL() });
  });
  showShutterAnimation();

}

// Attach shutter to the conteiner, once.
var container = $('#container');

container.tzShutter({
  imgSrc: 'jquery.shutter/shutter2.png',

  closeCallback: function(){
    console.log('close callback');

    // closed, let's open
    setTimeout(function () {
      console.log('open');
      container.trigger('shutterOpen');
    }, 100 /* shutter speed */);
  },

  loadCompleteCallback: function(){
    console.log('load complete callback, generated shutter stuff');
  }
});

// Trigger shutter close
function showShutterAnimation() {
  console.log('show shutter animation');
  container.trigger('shutterClose');
}

function showSnapshot(data_uri) {
  document.getElementById('my-picture').innerHTML = '<img src="' + data_uri + '"/>';
  $('#my-picture').show();
  setTimeout(function() {
    $('#my-picture').hide();
    allowedToPressButton = true;
  }, 3000);
}

$(window).keypress(function(e) {
  switch (e.keyCode) {
    // space in mozilla is 0 and in chrome 32
    case 0:
      console.log('Space pressed 0');
      if(allowedToPressButton) {
        takePicture();
        allowedToPressButton = false;
      } else {
        console.log('Not too fast!!');
      }
      break;
    case 13:
      console.log('Enter pressed');
      enableFullscreen();
      break;
    case 32:
      console.log('Space pressed 32');
      if(allowedToPressButton) {
        takePicture();
        allowedToPressButton = false;
      } else {
        console.log('Not too fast!!');
      }
    break;
  }
});
