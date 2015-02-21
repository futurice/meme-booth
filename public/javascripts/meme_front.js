$(function() {
  'use strict';

  var baseWidth = $('#camera').width();
  var baseHeight = $('#camera').height();

  var width = 480;
  var height = 480;
  var imageWidth = baseWidth;
  var imageHeight = baseHeight;
  var stwidth = String(baseWidth) + 'px';
  var webcamWidth = baseWidth + 270;
  var webcamHeight = baseHeight;

  var AUTO_CANCEL_TIMEOUT = 10000;

  // canvas for
  var firstStepCanvas = document.getElementById("camera-canvas");
  firstStepCanvas.width = baseWidth;
  firstStepCanvas.height = baseHeight;

  // containers
  var step1Element = $('#step1');
  var step2Element = $('#step2');
  var firstInfo = $('#first-info');

  var stillElement = $('#still');

  // attaching webcam
  Webcam.set({
    dest_width: webcamWidth,
    dest_height: webcamHeight,
    image_format: 'jpeg',
    jpeg_quality: 90,
    force_flash: false
  });

  // we assume that webcam image is wider than taller.
  var propertionalWidth = imageHeight / webcamHeight * webcamWidth;
  var leftMargin = Math.floor((propertionalWidth - imageWidth) / 2);

  function positionCameraElement(element, width) {
    element
      .css('width', width || Math.floor(propertionalWidth) + 'px')
      .css('height', stwidth)
      .css('margin-left', width ? "0" : '-' + leftMargin + 'px');
  }

  positionCameraElement($('#camera-inner'));
  positionCameraElement($('#camera-canvas'), imageWidth);

  Webcam.attach('#camera-inner');

  // make camera square

  function attachCanvasToVideo(effect, canvas, clearRect, savePicture, callback) {
    var usedWidth = imageWidth;
    var usedHeight = imageHeight;
    if (savePicture) {
      usedWidth = width;
      usedHeight = height;
    }

    var deferred = Q.defer();
    var div = document.getElementById('camera');

    var ctx = canvas.getContext('2d');

    var fImage = new Image();

    fImage.onload = function() {
      if (clearRect) {
        ctx.clearRect(0, 0, usedWidth, usedHeight);
        console.log('clear canvas');
      }
      ctx.drawImage(fImage, 0, 0, 480, 480, 0, 0, usedWidth, usedHeight);
      var data = canvas.toDataURL();
      deferred.resolve(data);
      if(callback){
        callback();
      }
   };

   fImage.src = getSource(effect);
   return deferred.promise;
  }

  function process(dataUri, effect) {
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    var deferred = Q.defer();

    // http://stackoverflow.com/questions/4773966/drawing-an-image-from-a-data-url-to-a-canvas
    var img = new Image();

    img.onload = function () {
      // Mirror
      // translate context to center of canvas
      ctx.translate(canvas.width, 0);

      // flip context horizontally
      ctx.scale(-1, 1);

      ctx.drawImage(img, leftMargin, 0, webcamHeight, webcamHeight, 0, 0, width, height);

      // Unmirror
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      attachCanvasToVideo(effect, canvas, false, true).then(function (effectfulDataUri) {
        deferred.resolve(effectfulDataUri);
      });
    };

    // start the chain, assign src field to the image
    img.src = dataUri;

    return deferred.promise;
  }

  // Filterify
  // return a promise which is resolved with data url of image with filter applied
  function getSource(effect) {
    var path = "/img/filters/";
    var filetype = ".png";
    return path + effect + filetype;
  }

  // state
  var $stateBus = new Bacon.Bus();
  var $state = $stateBus.toProperty({});

  // State handling functions
  function isFirstStep(state) {
    return !state.dataUriPromise;
  }

  function showSpinner() {
    console.log("show spinner");
    $('#spinner').show();
  }

  function hideSpinner() {
    console.log("HIDE spinner");
    $('#spinner').hide();
  }

  function filterId(state) {
    return state.filter || '0';
  }

  function mod(n, m) {
    return ((m % n) + n) % n;
  }

  function setAllFiltersNotActive() {
    console.log('setting default filter active');
    $('#'+0).addClass('active');
    $('#'+1).removeClass('active');
    $('#'+2).removeClass('active');
    $('#'+3).removeClass('active');
    $('#'+4).removeClass('active');
    $('#'+5).removeClass('active');
    $('#'+6).removeClass('active');
    $('#'+7).removeClass('active');
    $('#'+8).removeClass('active');
    $('#'+9).removeClass('active');
    $('#'+10).removeClass('active');
    $('#'+11).removeClass('active');
  }

  function rightArrowPressed(filterId) {
      var id = filterId + 1;
      var idMod = mod(10, id);
      $('#'+filterId).removeClass('active');
      $('#'+idMod).addClass('active');
      if(mod(6,idMod) == 0) {
        var margin = -1 * 160 * idMod;
        $('#first-filter').css( { marginTop : margin });
      }
      return idMod;
  }

  function leftArrowPressed(filterId) {
      var id = filterId - 1;
      var idMod = mod(10, id);
      console.log(idMod);
      $('#'+filterId).removeClass('active');
      $('#'+idMod).addClass('active');
      var margin;
      if(idMod === 5) {
        margin = 0;
      } else if(idMod === 9) {
        margin = -970;
      }
      console.log(margin);
      if(margin != undefined) {
        console.log(margin);
        $('#first-filter').css( { marginTop : margin });
      }
      return idMod;
  }

  // helper streams
  var $isFirstStep = $state.map(isFirstStep);
  var $isSecondStep = $isFirstStep.not();

  function stateUpdate(state) {
    if (isFirstStep(state)) {
      step2Element.hide();

      // clear 2nd step image
      stillElement.attr("src", "");

      showSpinner();
      return attachCanvasToVideo(filterId(state), firstStepCanvas, true, false, function() {
        hideSpinner();
        firstInfo.show();
        step1Element.show();
      });
    } else {
      step1Element.hide();
      showSpinner();
      setAllFiltersNotActive();
      $('#first-filter').css( { marginTop : 0 });
      var effect = filterId(state);
      var rawDataPromise = state.dataUriPromise;
      return rawDataPromise.then(function (dataUri) {
        // view
        stillElement.attr("src", dataUri);
        hideSpinner();
        firstInfo.hide();
        step2Element.show();
        // save
        $.post("/takememeshot", { data: dataUri }, function() {
          console.log('post is ready?');
        });
      });
    }
  }

  var stateUpdatePromise = Q.resolve();

  // onState handler
  $state.onValue(function (state) {
    stateUpdatePromise = stateUpdatePromise
    .then(function () {
      return stateUpdate(state);
    })
    .catch(function () {
      // if there is error - keep going
    });
  });

  // events
  var $spaces = $(window).asEventStream('keypress').filter(function (e) {
    return e.keyCode === 32 || e.keyCode == 0;
  });

  var $enters = $(window).asEventStream('keypress').filter(function (e) {
    return e.keyCode === 13;
  });

  var $leftArrows = $(window).asEventStream('keydown').filter($isFirstStep).filter(function (e) {
    return e.keyCode === 37;
  }).debounceImmediate(400);

  var $rightArrows = $(window).asEventStream('keydown').filter($isFirstStep).filter(function (e) {
    return e.keyCode === 39;
  }).debounceImmediate(400);

  // ota mukaan "ota kuva"
  var $photos = $spaces.filter($isFirstStep).map(function () {
    return Webcam.snap();
  });

  var $cancelButton = $enters.filter($isFirstStep.not());

  // essentially delayed photos, but omitted if other cancel is pressed before
  var $cancelDataUri = $photos.flatMap(function () {
    return Bacon.sequentially(AUTO_CANCEL_TIMEOUT, [{ type: 'cancel'}])
      .takeUntil($cancelButton);
  });

  $cancelDataUri.log("cancelDataUri")

  var $cancel = Bacon.mergeAll([$cancelButton, $cancelDataUri]);

  var $events = Bacon.mergeAll([
    $photos.map(function (dataUri) { return { type: 'dataUri', dataUri: dataUri }; }),
    $leftArrows.map(function () { return { type: 'leftfilter' }; }),
    $rightArrows.map(function () { return { type: 'rightfilter' }; }),
    $cancel.map(function () { return { type: 'cancel' }; })
  ]);

  var $stateStream = $events.scan({}, function (state, event) {
    switch (event.type) {
      case 'cancel':
        // cleanup
        return _.omit(state, "dataUriPromise");
      case 'dataUri':
        // muokkaa kuva
        // lähetä serverille
        var dataUriPromise = process(event.dataUri, filterId(state));
        return { dataUriPromise: dataUriPromise };
      case 'leftfilter':
        var previousFilter = leftArrowPressed(filterId(state));
        return _.extend({}, state, { filter: previousFilter });
      case 'rightfilter':
        var nextFilter = rightArrowPressed(filterId(state));
        return _.extend({}, state, { filter: nextFilter });
      default:
        console.error('unhandled event', event);
    }
  });

  // tie the knot: plug stateStream into a bus
  $stateBus.plug($stateStream);

  // logging
  $events.log('event');
  $state.log('state');

});
