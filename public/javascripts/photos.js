$(function() {
  'use strict';

  function getImagesFromDom() {
    return _.chain($('img').toArray())
    .map(function (element) {
      return element.src;
    })
    .value();
  }

  function endsWith(str, suffix) {
    return str.substr(str.length - suffix.length, str.length) === suffix;
  }

  var interval = Bacon.fromPoll(3000, function () {
    return 'tick';
  }).flatMapFirst(function () {
    var path = '/photosjson';
    if($('body').hasClass('selfie')) {
      console.log('selfie');
      path = path + '/S';
    } else if($('body').hasClass('memes')) {
      console.log('meme');
      path = path + '/M';
    }
    return Bacon.fromPromise($.get(path));
  }).onValue(function (json) {
    var existingImages = getImagesFromDom();

    _.chain(json)
    .reverse()
    .each(function (newPic) {
      var exists = existingImages.some(function (url) {
        return endsWith(url, newPic.url);
      });

      if (!exists) {
        $('body').prepend($('<img>').addClass('selfie-image').attr('src', newPic.url));
      }
    });

    // remove when too much.
    _.chain($('img').toArray())
    .drop(1000)
    .each(function (el) {
      el.parentNode.removeChild(el);
    });
  });
});
