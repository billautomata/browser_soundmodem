(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

module.exports = {
  getBuffer: getBuffer,
  check_peak_ranges: check_peak_ranges
}

// check for global audio ctx

if(window.context === undefined){
  window.context = new window.AudioContext()
}

var analyser = window.context.createAnalyser()
var bufferLength
var analyserDataArray
var peak_ranges
var mean

var osc_bank = []
var gain_bank = []

var n_osc = 18
var freqRange = 18000
var spread = (freqRange / n_osc)
var initialFreq = 1000

init()
getBuffer()

function init(){

  // create osc + gain banks
  for(var idx = 0; idx < n_osc; idx++){

    let local_osc = context.createOscillator()
    local_osc.frequency.value = (idx * spread) + initialFreq

    let local_gain = context.createGain()
    local_gain.gain.value = 1.0 / (n_osc)

    local_osc.connect(local_gain)
    local_gain.connect(analyser)

    // local_gain.connect(context.destination)

    local_osc.start()

    osc_bank.push(local_osc)
    gain_bank.push(local_gain)

  }

  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0
  bufferLength = analyser.frequencyBinCount
  analyserDataArray = new Uint8Array(bufferLength)

  setTimeout(register_peak_ranges,100)

}

function getBuffer(){
  analyser.getByteFrequencyData(analyserDataArray)
  return analyserDataArray
}

function register_peak_ranges(){

  getBuffer()

  // push on to new array for sorting
  var d = []
  for(var i = 0; i < bufferLength; i++){
    if(analyserDataArray[i] > 0){
      d.push(analyserDataArray[i])
    }
  }
  d.sort(function(a,b){
    return a-b
  })
  console.log('Mean: '+d[Math.floor(d.length/2)])

  mean = d[Math.floor(d.length/2)]

  //
  peak_ranges = []
  for(var i = 0; i < bufferLength; i++){
    if(analyserDataArray[i] > mean){
      peak_ranges.push(i)
    }
  }

  window.p = peak_ranges

}

function check_peak_ranges(){

  getBuffer()

  var hits = []
  peak_ranges.forEach(function(dataArray_idx){
    if(analyserDataArray[dataArray_idx] > mean){
      hits.push(true)
    } else {
      hits.push(false)
    }
  })

  return hits


}

},{}],2:[function(require,module,exports){
window.onload = function () {
  "use strict";

  console.log('main.js / window.onload anonymous function')

  window.alice = require('./agent.js')

  console.log(alice.getBuffer())

  var bufferLength = alice.getBuffer().length

  // var context = new AudioContext()
  // var analyser = context.createAnalyser()
  //
  // var osc_bank = []
  // var gain_bank = []
  //
  // window.gb = gain_bank
  // var n_osc = 8
  //
  // var freqRange = 18000 // hz
  // var spread = (freqRange / n_osc)  // hz
  //
  // console.log(spread)
  // var initialFreq = 1000
  //
  // // create tones
  // for(var idx = 0; idx < n_osc; idx++){
  //
  //   let local_osc = context.createOscillator()
  //
  //   local_osc.frequency.value = (idx * spread) + initialFreq
  //
  //   let local_gain = context.createGain()
  //   local_gain.gain.value = 1.0 / (n_osc)
  //
  //   // local_gain.gain.value *= Math.random()
  //
  //   local_osc.connect(local_gain)
  //   local_gain.connect(analyser)
  //
  //   gain_bank.push(local_gain)
  //
  //   // local_gain.connect(context.destination)
  //
  //   local_osc.start()
  //
  // }

  var WIDTH = 1024
  var HEIGHT = 768
  //
  //
  // analyser.fftSize = 1024;
  // analyser.smoothingTimeConstant = 0
  // var bufferLength = analyser.frequencyBinCount;
  // var dataArray = new Uint8Array(bufferLength);
  // // var dataArray = new Float32Array(bufferLength)
  // var dataArraySlope = new Float32Array(bufferLength)

  var dataArray

  window.d = dataArray
  // analyser.getFloatFrequencyData(dataArray);

  window.draw = draw
  //
  // window.analyser = analyser

  var barWidth = (WIDTH / bufferLength);

  var barHeight
  var x = 0
  var mod = 0.0
  var counter = 0
  var i

  var svg = d3.select('div#container').append('svg')
    .attr('width',WIDTH)
    .attr('height', HEIGHT)

  var bars = []
  for(var svgbars = 0; svgbars < bufferLength; svgbars++){
    var bar = svg.append('rect')
      .attr('x', barWidth * svgbars)
      .attr('y', 0)
      .attr('width', barWidth)
      .attr('height', 0)

    bars.push(bar)
  }

  function draw() {

    // if(mod === 0.0){
    //   mod = 0.5
    // } else {
    //   mod = 0.0
    // }

    // gainNode.gain.value = mod

    // var random_bank = Math.floor(Math.random()*gain_bank.length)
    // gain_bank[2].gain.value = 0


    // analyser.getByteTimeDomainData(dataArray);
    dataArray = alice.getBuffer()
    window.d = dataArray
    // analyser.getFloatFrequencyData(dataArray)

    var total = 0
    for(i=0;i<bufferLength;i++){
      // dataArraySlope[i] = dataArray[i] - dataArray[i+1]
      total += dataArray[i]
    }

    var avg = total / (bufferLength)

    var count_peaks = 0
    var peaks = []

    var threshold = 2
    var minValue = threshold * avg

    counter++
    if(counter % 60 === 1){

      var last_valid_peak_index = 0
      for(i=0;i<bufferLength;i++){

        bars[i].attr('height', dataArray[i] * 2)
          .attr('fill', 'red')

        if(dataArray[i] > minValue){

          // push an index on to the peak index list
          peaks.push(i)

          bars[i].attr('fill', 'green')

        }

      }

      console.log('average: ' + avg)
      console.log(peaks.length)

      var peak_groups = 0

      var current_peak_streak = false
      for(var p = 0; p<peaks.length-1; p++){

        if(peaks[p]-peaks[p+1] === -1){

          if(!current_peak_streak){
            peak_groups += 1
            bars[peaks[p]].attr('height', HEIGHT).attr('fill','purple')
          }

          current_peak_streak = true

        } else {

          if(current_peak_streak){
            bars[peaks[p]].attr('height', HEIGHT).attr('fill','orange')
          }

          current_peak_streak = false

        }
      }

      if(peaks.length > 0){
        bars[peaks[peaks.length-1]].attr('height', HEIGHT).attr('fill','orange')
      }

      console.log('peak groups: ' + peak_groups)

      // console.log(bufferLength)
      // console.log(dataArray)
    }

    window.requestAnimationFrame(draw);

  }

  draw()


}

},{"./agent.js":1}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBnZXRCdWZmZXI6IGdldEJ1ZmZlcixcbiAgY2hlY2tfcGVha19yYW5nZXM6IGNoZWNrX3BlYWtfcmFuZ2VzXG59XG5cbi8vIGNoZWNrIGZvciBnbG9iYWwgYXVkaW8gY3R4XG5cbmlmKHdpbmRvdy5jb250ZXh0ID09PSB1bmRlZmluZWQpe1xuICB3aW5kb3cuY29udGV4dCA9IG5ldyB3aW5kb3cuQXVkaW9Db250ZXh0KClcbn1cblxudmFyIGFuYWx5c2VyID0gd2luZG93LmNvbnRleHQuY3JlYXRlQW5hbHlzZXIoKVxudmFyIGJ1ZmZlckxlbmd0aFxudmFyIGFuYWx5c2VyRGF0YUFycmF5XG52YXIgcGVha19yYW5nZXNcbnZhciBtZWFuXG5cbnZhciBvc2NfYmFuayA9IFtdXG52YXIgZ2Fpbl9iYW5rID0gW11cblxudmFyIG5fb3NjID0gMThcbnZhciBmcmVxUmFuZ2UgPSAxODAwMFxudmFyIHNwcmVhZCA9IChmcmVxUmFuZ2UgLyBuX29zYylcbnZhciBpbml0aWFsRnJlcSA9IDEwMDBcblxuaW5pdCgpXG5nZXRCdWZmZXIoKVxuXG5mdW5jdGlvbiBpbml0KCl7XG5cbiAgLy8gY3JlYXRlIG9zYyArIGdhaW4gYmFua3NcbiAgZm9yKHZhciBpZHggPSAwOyBpZHggPCBuX29zYzsgaWR4Kyspe1xuXG4gICAgbGV0IGxvY2FsX29zYyA9IGNvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpXG4gICAgbG9jYWxfb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IChpZHggKiBzcHJlYWQpICsgaW5pdGlhbEZyZXFcblxuICAgIGxldCBsb2NhbF9nYWluID0gY29udGV4dC5jcmVhdGVHYWluKClcbiAgICBsb2NhbF9nYWluLmdhaW4udmFsdWUgPSAxLjAgLyAobl9vc2MpXG5cbiAgICBsb2NhbF9vc2MuY29ubmVjdChsb2NhbF9nYWluKVxuICAgIGxvY2FsX2dhaW4uY29ubmVjdChhbmFseXNlcilcblxuICAgIC8vIGxvY2FsX2dhaW4uY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKVxuXG4gICAgbG9jYWxfb3NjLnN0YXJ0KClcblxuICAgIG9zY19iYW5rLnB1c2gobG9jYWxfb3NjKVxuICAgIGdhaW5fYmFuay5wdXNoKGxvY2FsX2dhaW4pXG5cbiAgfVxuXG4gIGFuYWx5c2VyLmZmdFNpemUgPSAxMDI0XG4gIGFuYWx5c2VyLnNtb290aGluZ1RpbWVDb25zdGFudCA9IDBcbiAgYnVmZmVyTGVuZ3RoID0gYW5hbHlzZXIuZnJlcXVlbmN5QmluQ291bnRcbiAgYW5hbHlzZXJEYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXJMZW5ndGgpXG5cbiAgc2V0VGltZW91dChyZWdpc3Rlcl9wZWFrX3JhbmdlcywxMDApXG5cbn1cblxuZnVuY3Rpb24gZ2V0QnVmZmVyKCl7XG4gIGFuYWx5c2VyLmdldEJ5dGVGcmVxdWVuY3lEYXRhKGFuYWx5c2VyRGF0YUFycmF5KVxuICByZXR1cm4gYW5hbHlzZXJEYXRhQXJyYXlcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJfcGVha19yYW5nZXMoKXtcblxuICBnZXRCdWZmZXIoKVxuXG4gIC8vIHB1c2ggb24gdG8gbmV3IGFycmF5IGZvciBzb3J0aW5nXG4gIHZhciBkID0gW11cbiAgZm9yKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKXtcbiAgICBpZihhbmFseXNlckRhdGFBcnJheVtpXSA+IDApe1xuICAgICAgZC5wdXNoKGFuYWx5c2VyRGF0YUFycmF5W2ldKVxuICAgIH1cbiAgfVxuICBkLnNvcnQoZnVuY3Rpb24oYSxiKXtcbiAgICByZXR1cm4gYS1iXG4gIH0pXG4gIGNvbnNvbGUubG9nKCdNZWFuOiAnK2RbTWF0aC5mbG9vcihkLmxlbmd0aC8yKV0pXG5cbiAgbWVhbiA9IGRbTWF0aC5mbG9vcihkLmxlbmd0aC8yKV1cblxuICAvL1xuICBwZWFrX3JhbmdlcyA9IFtdXG4gIGZvcih2YXIgaSA9IDA7IGkgPCBidWZmZXJMZW5ndGg7IGkrKyl7XG4gICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbaV0gPiBtZWFuKXtcbiAgICAgIHBlYWtfcmFuZ2VzLnB1c2goaSlcbiAgICB9XG4gIH1cblxuICB3aW5kb3cucCA9IHBlYWtfcmFuZ2VzXG5cbn1cblxuZnVuY3Rpb24gY2hlY2tfcGVha19yYW5nZXMoKXtcblxuICBnZXRCdWZmZXIoKVxuXG4gIHZhciBoaXRzID0gW11cbiAgcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbihkYXRhQXJyYXlfaWR4KXtcbiAgICBpZihhbmFseXNlckRhdGFBcnJheVtkYXRhQXJyYXlfaWR4XSA+IG1lYW4pe1xuICAgICAgaGl0cy5wdXNoKHRydWUpXG4gICAgfSBlbHNlIHtcbiAgICAgIGhpdHMucHVzaChmYWxzZSlcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIGhpdHNcblxuXG59XG4iLCJ3aW5kb3cub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICBjb25zb2xlLmxvZygnbWFpbi5qcyAvIHdpbmRvdy5vbmxvYWQgYW5vbnltb3VzIGZ1bmN0aW9uJylcblxuICB3aW5kb3cuYWxpY2UgPSByZXF1aXJlKCcuL2FnZW50LmpzJylcblxuICBjb25zb2xlLmxvZyhhbGljZS5nZXRCdWZmZXIoKSlcblxuICB2YXIgYnVmZmVyTGVuZ3RoID0gYWxpY2UuZ2V0QnVmZmVyKCkubGVuZ3RoXG5cbiAgLy8gdmFyIGNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KClcbiAgLy8gdmFyIGFuYWx5c2VyID0gY29udGV4dC5jcmVhdGVBbmFseXNlcigpXG4gIC8vXG4gIC8vIHZhciBvc2NfYmFuayA9IFtdXG4gIC8vIHZhciBnYWluX2JhbmsgPSBbXVxuICAvL1xuICAvLyB3aW5kb3cuZ2IgPSBnYWluX2JhbmtcbiAgLy8gdmFyIG5fb3NjID0gOFxuICAvL1xuICAvLyB2YXIgZnJlcVJhbmdlID0gMTgwMDAgLy8gaHpcbiAgLy8gdmFyIHNwcmVhZCA9IChmcmVxUmFuZ2UgLyBuX29zYykgIC8vIGh6XG4gIC8vXG4gIC8vIGNvbnNvbGUubG9nKHNwcmVhZClcbiAgLy8gdmFyIGluaXRpYWxGcmVxID0gMTAwMFxuICAvL1xuICAvLyAvLyBjcmVhdGUgdG9uZXNcbiAgLy8gZm9yKHZhciBpZHggPSAwOyBpZHggPCBuX29zYzsgaWR4Kyspe1xuICAvL1xuICAvLyAgIGxldCBsb2NhbF9vc2MgPSBjb250ZXh0LmNyZWF0ZU9zY2lsbGF0b3IoKVxuICAvL1xuICAvLyAgIGxvY2FsX29zYy5mcmVxdWVuY3kudmFsdWUgPSAoaWR4ICogc3ByZWFkKSArIGluaXRpYWxGcmVxXG4gIC8vXG4gIC8vICAgbGV0IGxvY2FsX2dhaW4gPSBjb250ZXh0LmNyZWF0ZUdhaW4oKVxuICAvLyAgIGxvY2FsX2dhaW4uZ2Fpbi52YWx1ZSA9IDEuMCAvIChuX29zYylcbiAgLy9cbiAgLy8gICAvLyBsb2NhbF9nYWluLmdhaW4udmFsdWUgKj0gTWF0aC5yYW5kb20oKVxuICAvL1xuICAvLyAgIGxvY2FsX29zYy5jb25uZWN0KGxvY2FsX2dhaW4pXG4gIC8vICAgbG9jYWxfZ2Fpbi5jb25uZWN0KGFuYWx5c2VyKVxuICAvL1xuICAvLyAgIGdhaW5fYmFuay5wdXNoKGxvY2FsX2dhaW4pXG4gIC8vXG4gIC8vICAgLy8gbG9jYWxfZ2Fpbi5jb25uZWN0KGNvbnRleHQuZGVzdGluYXRpb24pXG4gIC8vXG4gIC8vICAgbG9jYWxfb3NjLnN0YXJ0KClcbiAgLy9cbiAgLy8gfVxuXG4gIHZhciBXSURUSCA9IDEwMjRcbiAgdmFyIEhFSUdIVCA9IDc2OFxuICAvL1xuICAvL1xuICAvLyBhbmFseXNlci5mZnRTaXplID0gMTAyNDtcbiAgLy8gYW5hbHlzZXIuc21vb3RoaW5nVGltZUNvbnN0YW50ID0gMFxuICAvLyB2YXIgYnVmZmVyTGVuZ3RoID0gYW5hbHlzZXIuZnJlcXVlbmN5QmluQ291bnQ7XG4gIC8vIHZhciBkYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXJMZW5ndGgpO1xuICAvLyAvLyB2YXIgZGF0YUFycmF5ID0gbmV3IEZsb2F0MzJBcnJheShidWZmZXJMZW5ndGgpXG4gIC8vIHZhciBkYXRhQXJyYXlTbG9wZSA9IG5ldyBGbG9hdDMyQXJyYXkoYnVmZmVyTGVuZ3RoKVxuXG4gIHZhciBkYXRhQXJyYXlcblxuICB3aW5kb3cuZCA9IGRhdGFBcnJheVxuICAvLyBhbmFseXNlci5nZXRGbG9hdEZyZXF1ZW5jeURhdGEoZGF0YUFycmF5KTtcblxuICB3aW5kb3cuZHJhdyA9IGRyYXdcbiAgLy9cbiAgLy8gd2luZG93LmFuYWx5c2VyID0gYW5hbHlzZXJcblxuICB2YXIgYmFyV2lkdGggPSAoV0lEVEggLyBidWZmZXJMZW5ndGgpO1xuXG4gIHZhciBiYXJIZWlnaHRcbiAgdmFyIHggPSAwXG4gIHZhciBtb2QgPSAwLjBcbiAgdmFyIGNvdW50ZXIgPSAwXG4gIHZhciBpXG5cbiAgdmFyIHN2ZyA9IGQzLnNlbGVjdCgnZGl2I2NvbnRhaW5lcicpLmFwcGVuZCgnc3ZnJylcbiAgICAuYXR0cignd2lkdGgnLFdJRFRIKVxuICAgIC5hdHRyKCdoZWlnaHQnLCBIRUlHSFQpXG5cbiAgdmFyIGJhcnMgPSBbXVxuICBmb3IodmFyIHN2Z2JhcnMgPSAwOyBzdmdiYXJzIDwgYnVmZmVyTGVuZ3RoOyBzdmdiYXJzKyspe1xuICAgIHZhciBiYXIgPSBzdmcuYXBwZW5kKCdyZWN0JylcbiAgICAgIC5hdHRyKCd4JywgYmFyV2lkdGggKiBzdmdiYXJzKVxuICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgLmF0dHIoJ3dpZHRoJywgYmFyV2lkdGgpXG4gICAgICAuYXR0cignaGVpZ2h0JywgMClcblxuICAgIGJhcnMucHVzaChiYXIpXG4gIH1cblxuICBmdW5jdGlvbiBkcmF3KCkge1xuXG4gICAgLy8gaWYobW9kID09PSAwLjApe1xuICAgIC8vICAgbW9kID0gMC41XG4gICAgLy8gfSBlbHNlIHtcbiAgICAvLyAgIG1vZCA9IDAuMFxuICAgIC8vIH1cblxuICAgIC8vIGdhaW5Ob2RlLmdhaW4udmFsdWUgPSBtb2RcblxuICAgIC8vIHZhciByYW5kb21fYmFuayA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSpnYWluX2JhbmsubGVuZ3RoKVxuICAgIC8vIGdhaW5fYmFua1syXS5nYWluLnZhbHVlID0gMFxuXG5cbiAgICAvLyBhbmFseXNlci5nZXRCeXRlVGltZURvbWFpbkRhdGEoZGF0YUFycmF5KTtcbiAgICBkYXRhQXJyYXkgPSBhbGljZS5nZXRCdWZmZXIoKVxuICAgIHdpbmRvdy5kID0gZGF0YUFycmF5XG4gICAgLy8gYW5hbHlzZXIuZ2V0RmxvYXRGcmVxdWVuY3lEYXRhKGRhdGFBcnJheSlcblxuICAgIHZhciB0b3RhbCA9IDBcbiAgICBmb3IoaT0wO2k8YnVmZmVyTGVuZ3RoO2krKyl7XG4gICAgICAvLyBkYXRhQXJyYXlTbG9wZVtpXSA9IGRhdGFBcnJheVtpXSAtIGRhdGFBcnJheVtpKzFdXG4gICAgICB0b3RhbCArPSBkYXRhQXJyYXlbaV1cbiAgICB9XG5cbiAgICB2YXIgYXZnID0gdG90YWwgLyAoYnVmZmVyTGVuZ3RoKVxuXG4gICAgdmFyIGNvdW50X3BlYWtzID0gMFxuICAgIHZhciBwZWFrcyA9IFtdXG5cbiAgICB2YXIgdGhyZXNob2xkID0gMlxuICAgIHZhciBtaW5WYWx1ZSA9IHRocmVzaG9sZCAqIGF2Z1xuXG4gICAgY291bnRlcisrXG4gICAgaWYoY291bnRlciAlIDYwID09PSAxKXtcblxuICAgICAgdmFyIGxhc3RfdmFsaWRfcGVha19pbmRleCA9IDBcbiAgICAgIGZvcihpPTA7aTxidWZmZXJMZW5ndGg7aSsrKXtcblxuICAgICAgICBiYXJzW2ldLmF0dHIoJ2hlaWdodCcsIGRhdGFBcnJheVtpXSAqIDIpXG4gICAgICAgICAgLmF0dHIoJ2ZpbGwnLCAncmVkJylcblxuICAgICAgICBpZihkYXRhQXJyYXlbaV0gPiBtaW5WYWx1ZSl7XG5cbiAgICAgICAgICAvLyBwdXNoIGFuIGluZGV4IG9uIHRvIHRoZSBwZWFrIGluZGV4IGxpc3RcbiAgICAgICAgICBwZWFrcy5wdXNoKGkpXG5cbiAgICAgICAgICBiYXJzW2ldLmF0dHIoJ2ZpbGwnLCAnZ3JlZW4nKVxuXG4gICAgICAgIH1cblxuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZygnYXZlcmFnZTogJyArIGF2ZylcbiAgICAgIGNvbnNvbGUubG9nKHBlYWtzLmxlbmd0aClcblxuICAgICAgdmFyIHBlYWtfZ3JvdXBzID0gMFxuXG4gICAgICB2YXIgY3VycmVudF9wZWFrX3N0cmVhayA9IGZhbHNlXG4gICAgICBmb3IodmFyIHAgPSAwOyBwPHBlYWtzLmxlbmd0aC0xOyBwKyspe1xuXG4gICAgICAgIGlmKHBlYWtzW3BdLXBlYWtzW3ArMV0gPT09IC0xKXtcblxuICAgICAgICAgIGlmKCFjdXJyZW50X3BlYWtfc3RyZWFrKXtcbiAgICAgICAgICAgIHBlYWtfZ3JvdXBzICs9IDFcbiAgICAgICAgICAgIGJhcnNbcGVha3NbcF1dLmF0dHIoJ2hlaWdodCcsIEhFSUdIVCkuYXR0cignZmlsbCcsJ3B1cnBsZScpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY3VycmVudF9wZWFrX3N0cmVhayA9IHRydWVcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgaWYoY3VycmVudF9wZWFrX3N0cmVhayl7XG4gICAgICAgICAgICBiYXJzW3BlYWtzW3BdXS5hdHRyKCdoZWlnaHQnLCBIRUlHSFQpLmF0dHIoJ2ZpbGwnLCdvcmFuZ2UnKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGN1cnJlbnRfcGVha19zdHJlYWsgPSBmYWxzZVxuXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYocGVha3MubGVuZ3RoID4gMCl7XG4gICAgICAgIGJhcnNbcGVha3NbcGVha3MubGVuZ3RoLTFdXS5hdHRyKCdoZWlnaHQnLCBIRUlHSFQpLmF0dHIoJ2ZpbGwnLCdvcmFuZ2UnKVxuICAgICAgfVxuXG4gICAgICBjb25zb2xlLmxvZygncGVhayBncm91cHM6ICcgKyBwZWFrX2dyb3VwcylcblxuICAgICAgLy8gY29uc29sZS5sb2coYnVmZmVyTGVuZ3RoKVxuICAgICAgLy8gY29uc29sZS5sb2coZGF0YUFycmF5KVxuICAgIH1cblxuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZHJhdyk7XG5cbiAgfVxuXG4gIGRyYXcoKVxuXG5cbn1cbiJdfQ==
