module.exports = function(){

  // lets do some fun
  var video = document.getElementById('webcam');
  var canvas = document.getElementById('canvas');
  try {
    var attempts = 0;
    var readyListener = function (event) {
      findVideoSize();
    };
    var findVideoSize = function () {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        video.removeEventListener('loadeddata', readyListener);
        // onDimensionsReady(video.videoWidth, video.videoHeight);
      } else {
        if (attempts < 10) {
          attempts++;
          setTimeout(findVideoSize, 200);
        } else {
          // onDimensionsReady(640, 480);
        }
      }
    };
    // var onDimensionsReady = function(width, height) {
    //   // demo_app(width, height);
    //   // compatibility.requestAnimationFrame(tick);
    // };

    video.addEventListener('loadeddata', readyListener);

    compatibility.getUserMedia({
      video: true
    }, function (stream) {

      try {
        video.src = compatibility.URL.createObjectURL(stream);
      } catch (error) {
        video.src = stream;
      }

      setTimeout(function () {
        video.play();
      }, 500);

    }, function (error) {
      console.log(error)
    });
  } catch (error) {
    console.log(error)
  }  


}
