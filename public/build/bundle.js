(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

module.exports = {
  getBuffer: getBuffer,
  check_peak_ranges: check_peak_ranges,
  group_peak_ranges: group_peak_ranges,
  set_gain: set_gain,
  validate_ranges: validate_ranges
}

// check for global audio ctx

if(window.context === undefined){
  window.context = new window.AudioContext()
}

var analyser = window.context.createAnalyser()
var analyserDataArray
var bufferLength

var peak_ranges
var mean
var grouped_peak_ranges

var osc_bank = []
var gain_bank = []

var n_osc = 3
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

  group_peak_ranges()

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

function group_peak_ranges(){

  if(peak_ranges === undefined || peak_ranges.length === 0){
    return;
  }

  var groups = [] // [ [1,2,3], [8,9,10], [30,31,32]  ]

  var current_group_idx = 0

  var local_group = new Array()

  peak_ranges.forEach(function(peak_idx, idx){

    // if the Math.abs(peak_idx - peak_ranges[idx+1]) === 1
    //    push peak_idx on to local_group
    // else
    //    push local_group on to groups
    //    clear local_group
    //    push peak_idx on to local_group

    if(idx === peak_ranges.length-1){
      // console.log('here')
      return;
    }

    if(Math.abs(peak_idx - peak_ranges[idx+1]) <= 2){
      local_group.push(peak_idx)
    } else {
      local_group.push(peak_idx)
      groups.push(local_group)
      local_group = new Array()
    }

  })

  groups.push(local_group)

  grouped_peak_ranges = groups

  return groups

}

function set_gain(channel, value){
  gain_bank[channel].gain.value = value
}

function validate_ranges(){

  getBuffer()

  var valid_groups = []

  grouped_peak_ranges.forEach(function(group){

    // for each entry in the group
    var hits = 0

    group.forEach(function(idx){
      if(analyserDataArray[idx] >= mean){
        hits += 1
      }
    })

    console.log(hits)

    if(hits >= group.length/2){
      valid_groups.push(true)
    } else {
      valid_groups.push(false)
    }

  })

  return valid_groups

}

},{}],2:[function(require,module,exports){
window.onload = function () {
  "use strict";

  console.log('main.js / window.onload anonymous function')

  window.alice = require('./agent.js')
  var dataArray = alice.getBuffer()
  var bufferLength = dataArray.length

  var WIDTH = 1024
  var HEIGHT = 768

  window.d = dataArray
  window.draw = draw

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
    // dataArray = alice.getBuffer()
    // window.d = dataArray
    // // analyser.getFloatFrequencyData(dataArray)
    //
    // var total = 0
    // for(i=0;i<bufferLength;i++){
    //   // dataArraySlope[i] = dataArray[i] - dataArray[i+1]
    //   total += dataArray[i]
    // }
    //
    // var avg = total / (bufferLength)
    //
    // var count_peaks = 0
    // var peaks = []
    //
    // var threshold = 2
    // var minValue = threshold * avg
    //
    counter++
    if(counter % 60 === 1){


      alice.getBuffer()
      // console.log('peak ranges (grouped)')
      // var peak_ranges = alice.group_peak_ranges()
      //
      // if(peak_ranges){
      //   console.log(peak_ranges)
      //   console.log(peak_ranges.length)
      // }

      // console.log(alice.group_peak_ranges())

      for(i=0;i<bufferLength;i++){
        bars[i].attr('height', dataArray[i] * 2)
      }

    }

    window.requestAnimationFrame(draw);

  }

  draw()


}

},{"./agent.js":1}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdk1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdldEJ1ZmZlcjogZ2V0QnVmZmVyLFxuICBjaGVja19wZWFrX3JhbmdlczogY2hlY2tfcGVha19yYW5nZXMsXG4gIGdyb3VwX3BlYWtfcmFuZ2VzOiBncm91cF9wZWFrX3JhbmdlcyxcbiAgc2V0X2dhaW46IHNldF9nYWluLFxuICB2YWxpZGF0ZV9yYW5nZXM6IHZhbGlkYXRlX3Jhbmdlc1xufVxuXG4vLyBjaGVjayBmb3IgZ2xvYmFsIGF1ZGlvIGN0eFxuXG5pZih3aW5kb3cuY29udGV4dCA9PT0gdW5kZWZpbmVkKXtcbiAgd2luZG93LmNvbnRleHQgPSBuZXcgd2luZG93LkF1ZGlvQ29udGV4dCgpXG59XG5cbnZhciBhbmFseXNlciA9IHdpbmRvdy5jb250ZXh0LmNyZWF0ZUFuYWx5c2VyKClcbnZhciBhbmFseXNlckRhdGFBcnJheVxudmFyIGJ1ZmZlckxlbmd0aFxuXG52YXIgcGVha19yYW5nZXNcbnZhciBtZWFuXG52YXIgZ3JvdXBlZF9wZWFrX3Jhbmdlc1xuXG52YXIgb3NjX2JhbmsgPSBbXVxudmFyIGdhaW5fYmFuayA9IFtdXG5cbnZhciBuX29zYyA9IDNcbnZhciBmcmVxUmFuZ2UgPSAxODAwMFxudmFyIHNwcmVhZCA9IChmcmVxUmFuZ2UgLyBuX29zYylcbnZhciBpbml0aWFsRnJlcSA9IDEwMDBcblxuaW5pdCgpXG5nZXRCdWZmZXIoKVxuXG5mdW5jdGlvbiBpbml0KCl7XG5cbiAgLy8gY3JlYXRlIG9zYyArIGdhaW4gYmFua3NcbiAgZm9yKHZhciBpZHggPSAwOyBpZHggPCBuX29zYzsgaWR4Kyspe1xuXG4gICAgbGV0IGxvY2FsX29zYyA9IGNvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpXG4gICAgbG9jYWxfb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IChpZHggKiBzcHJlYWQpICsgaW5pdGlhbEZyZXFcblxuICAgIGxldCBsb2NhbF9nYWluID0gY29udGV4dC5jcmVhdGVHYWluKClcbiAgICBsb2NhbF9nYWluLmdhaW4udmFsdWUgPSAxLjAgLyAobl9vc2MpXG5cbiAgICBsb2NhbF9vc2MuY29ubmVjdChsb2NhbF9nYWluKVxuICAgIGxvY2FsX2dhaW4uY29ubmVjdChhbmFseXNlcilcblxuICAgIC8vIGxvY2FsX2dhaW4uY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKVxuXG4gICAgbG9jYWxfb3NjLnN0YXJ0KClcblxuICAgIG9zY19iYW5rLnB1c2gobG9jYWxfb3NjKVxuICAgIGdhaW5fYmFuay5wdXNoKGxvY2FsX2dhaW4pXG5cbiAgfVxuXG4gIGFuYWx5c2VyLmZmdFNpemUgPSAxMDI0XG4gIGFuYWx5c2VyLnNtb290aGluZ1RpbWVDb25zdGFudCA9IDBcbiAgYnVmZmVyTGVuZ3RoID0gYW5hbHlzZXIuZnJlcXVlbmN5QmluQ291bnRcbiAgYW5hbHlzZXJEYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXJMZW5ndGgpXG5cbiAgc2V0VGltZW91dChyZWdpc3Rlcl9wZWFrX3JhbmdlcywxMDApXG5cbn1cblxuZnVuY3Rpb24gZ2V0QnVmZmVyKCl7XG4gIGFuYWx5c2VyLmdldEJ5dGVGcmVxdWVuY3lEYXRhKGFuYWx5c2VyRGF0YUFycmF5KVxuICByZXR1cm4gYW5hbHlzZXJEYXRhQXJyYXlcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJfcGVha19yYW5nZXMoKXtcblxuICBnZXRCdWZmZXIoKVxuXG4gIC8vIHB1c2ggb24gdG8gbmV3IGFycmF5IGZvciBzb3J0aW5nXG4gIHZhciBkID0gW11cbiAgZm9yKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKXtcbiAgICBpZihhbmFseXNlckRhdGFBcnJheVtpXSA+IDApe1xuICAgICAgZC5wdXNoKGFuYWx5c2VyRGF0YUFycmF5W2ldKVxuICAgIH1cbiAgfVxuICBkLnNvcnQoZnVuY3Rpb24oYSxiKXtcbiAgICByZXR1cm4gYS1iXG4gIH0pXG4gIGNvbnNvbGUubG9nKCdNZWFuOiAnK2RbTWF0aC5mbG9vcihkLmxlbmd0aC8yKV0pXG5cbiAgbWVhbiA9IGRbTWF0aC5mbG9vcihkLmxlbmd0aC8yKV1cblxuICAvL1xuICBwZWFrX3JhbmdlcyA9IFtdXG4gIGZvcih2YXIgaSA9IDA7IGkgPCBidWZmZXJMZW5ndGg7IGkrKyl7XG4gICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbaV0gPiBtZWFuKXtcbiAgICAgIHBlYWtfcmFuZ2VzLnB1c2goaSlcbiAgICB9XG4gIH1cblxuICB3aW5kb3cucCA9IHBlYWtfcmFuZ2VzXG5cbiAgZ3JvdXBfcGVha19yYW5nZXMoKVxuXG59XG5cbmZ1bmN0aW9uIGNoZWNrX3BlYWtfcmFuZ2VzKCl7XG5cbiAgZ2V0QnVmZmVyKClcblxuICB2YXIgaGl0cyA9IFtdXG4gIHBlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24oZGF0YUFycmF5X2lkeCl7XG4gICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbZGF0YUFycmF5X2lkeF0gPiBtZWFuKXtcbiAgICAgIGhpdHMucHVzaCh0cnVlKVxuICAgIH0gZWxzZSB7XG4gICAgICBoaXRzLnB1c2goZmFsc2UpXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiBoaXRzXG5cbn1cblxuZnVuY3Rpb24gZ3JvdXBfcGVha19yYW5nZXMoKXtcblxuICBpZihwZWFrX3JhbmdlcyA9PT0gdW5kZWZpbmVkIHx8IHBlYWtfcmFuZ2VzLmxlbmd0aCA9PT0gMCl7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGdyb3VwcyA9IFtdIC8vIFsgWzEsMiwzXSwgWzgsOSwxMF0sIFszMCwzMSwzMl0gIF1cblxuICB2YXIgY3VycmVudF9ncm91cF9pZHggPSAwXG5cbiAgdmFyIGxvY2FsX2dyb3VwID0gbmV3IEFycmF5KClcblxuICBwZWFrX3Jhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKHBlYWtfaWR4LCBpZHgpe1xuXG4gICAgLy8gaWYgdGhlIE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4KzFdKSA9PT0gMVxuICAgIC8vICAgIHB1c2ggcGVha19pZHggb24gdG8gbG9jYWxfZ3JvdXBcbiAgICAvLyBlbHNlXG4gICAgLy8gICAgcHVzaCBsb2NhbF9ncm91cCBvbiB0byBncm91cHNcbiAgICAvLyAgICBjbGVhciBsb2NhbF9ncm91cFxuICAgIC8vICAgIHB1c2ggcGVha19pZHggb24gdG8gbG9jYWxfZ3JvdXBcblxuICAgIGlmKGlkeCA9PT0gcGVha19yYW5nZXMubGVuZ3RoLTEpe1xuICAgICAgLy8gY29uc29sZS5sb2coJ2hlcmUnKVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4KzFdKSA8PSAyKXtcbiAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgfSBlbHNlIHtcbiAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgICBncm91cHMucHVzaChsb2NhbF9ncm91cClcbiAgICAgIGxvY2FsX2dyb3VwID0gbmV3IEFycmF5KClcbiAgICB9XG5cbiAgfSlcblxuICBncm91cHMucHVzaChsb2NhbF9ncm91cClcblxuICBncm91cGVkX3BlYWtfcmFuZ2VzID0gZ3JvdXBzXG5cbiAgcmV0dXJuIGdyb3Vwc1xuXG59XG5cbmZ1bmN0aW9uIHNldF9nYWluKGNoYW5uZWwsIHZhbHVlKXtcbiAgZ2Fpbl9iYW5rW2NoYW5uZWxdLmdhaW4udmFsdWUgPSB2YWx1ZVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZV9yYW5nZXMoKXtcblxuICBnZXRCdWZmZXIoKVxuXG4gIHZhciB2YWxpZF9ncm91cHMgPSBbXVxuXG4gIGdyb3VwZWRfcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbihncm91cCl7XG5cbiAgICAvLyBmb3IgZWFjaCBlbnRyeSBpbiB0aGUgZ3JvdXBcbiAgICB2YXIgaGl0cyA9IDBcblxuICAgIGdyb3VwLmZvckVhY2goZnVuY3Rpb24oaWR4KXtcbiAgICAgIGlmKGFuYWx5c2VyRGF0YUFycmF5W2lkeF0gPj0gbWVhbil7XG4gICAgICAgIGhpdHMgKz0gMVxuICAgICAgfVxuICAgIH0pXG5cbiAgICBjb25zb2xlLmxvZyhoaXRzKVxuXG4gICAgaWYoaGl0cyA+PSBncm91cC5sZW5ndGgvMil7XG4gICAgICB2YWxpZF9ncm91cHMucHVzaCh0cnVlKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YWxpZF9ncm91cHMucHVzaChmYWxzZSlcbiAgICB9XG5cbiAgfSlcblxuICByZXR1cm4gdmFsaWRfZ3JvdXBzXG5cbn1cbiIsIndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIGNvbnNvbGUubG9nKCdtYWluLmpzIC8gd2luZG93Lm9ubG9hZCBhbm9ueW1vdXMgZnVuY3Rpb24nKVxuXG4gIHdpbmRvdy5hbGljZSA9IHJlcXVpcmUoJy4vYWdlbnQuanMnKVxuICB2YXIgZGF0YUFycmF5ID0gYWxpY2UuZ2V0QnVmZmVyKClcbiAgdmFyIGJ1ZmZlckxlbmd0aCA9IGRhdGFBcnJheS5sZW5ndGhcblxuICB2YXIgV0lEVEggPSAxMDI0XG4gIHZhciBIRUlHSFQgPSA3NjhcblxuICB3aW5kb3cuZCA9IGRhdGFBcnJheVxuICB3aW5kb3cuZHJhdyA9IGRyYXdcblxuICB2YXIgYmFyV2lkdGggPSAoV0lEVEggLyBidWZmZXJMZW5ndGgpO1xuXG4gIHZhciBiYXJIZWlnaHRcbiAgdmFyIHggPSAwXG4gIHZhciBtb2QgPSAwLjBcbiAgdmFyIGNvdW50ZXIgPSAwXG4gIHZhciBpXG5cbiAgdmFyIHN2ZyA9IGQzLnNlbGVjdCgnZGl2I2NvbnRhaW5lcicpLmFwcGVuZCgnc3ZnJylcbiAgICAuYXR0cignd2lkdGgnLFdJRFRIKVxuICAgIC5hdHRyKCdoZWlnaHQnLCBIRUlHSFQpXG5cbiAgdmFyIGJhcnMgPSBbXVxuICBmb3IodmFyIHN2Z2JhcnMgPSAwOyBzdmdiYXJzIDwgYnVmZmVyTGVuZ3RoOyBzdmdiYXJzKyspe1xuICAgIHZhciBiYXIgPSBzdmcuYXBwZW5kKCdyZWN0JylcbiAgICAgIC5hdHRyKCd4JywgYmFyV2lkdGggKiBzdmdiYXJzKVxuICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgLmF0dHIoJ3dpZHRoJywgYmFyV2lkdGgpXG4gICAgICAuYXR0cignaGVpZ2h0JywgMClcblxuICAgIGJhcnMucHVzaChiYXIpXG4gIH1cblxuICBmdW5jdGlvbiBkcmF3KCkge1xuXG5cbiAgICAvLyBpZihtb2QgPT09IDAuMCl7XG4gICAgLy8gICBtb2QgPSAwLjVcbiAgICAvLyB9IGVsc2Uge1xuICAgIC8vICAgbW9kID0gMC4wXG4gICAgLy8gfVxuXG4gICAgLy8gZ2Fpbk5vZGUuZ2Fpbi52YWx1ZSA9IG1vZFxuXG4gICAgLy8gdmFyIHJhbmRvbV9iYW5rID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpKmdhaW5fYmFuay5sZW5ndGgpXG4gICAgLy8gZ2Fpbl9iYW5rWzJdLmdhaW4udmFsdWUgPSAwXG5cblxuICAgIC8vIGFuYWx5c2VyLmdldEJ5dGVUaW1lRG9tYWluRGF0YShkYXRhQXJyYXkpO1xuICAgIC8vIGRhdGFBcnJheSA9IGFsaWNlLmdldEJ1ZmZlcigpXG4gICAgLy8gd2luZG93LmQgPSBkYXRhQXJyYXlcbiAgICAvLyAvLyBhbmFseXNlci5nZXRGbG9hdEZyZXF1ZW5jeURhdGEoZGF0YUFycmF5KVxuICAgIC8vXG4gICAgLy8gdmFyIHRvdGFsID0gMFxuICAgIC8vIGZvcihpPTA7aTxidWZmZXJMZW5ndGg7aSsrKXtcbiAgICAvLyAgIC8vIGRhdGFBcnJheVNsb3BlW2ldID0gZGF0YUFycmF5W2ldIC0gZGF0YUFycmF5W2krMV1cbiAgICAvLyAgIHRvdGFsICs9IGRhdGFBcnJheVtpXVxuICAgIC8vIH1cbiAgICAvL1xuICAgIC8vIHZhciBhdmcgPSB0b3RhbCAvIChidWZmZXJMZW5ndGgpXG4gICAgLy9cbiAgICAvLyB2YXIgY291bnRfcGVha3MgPSAwXG4gICAgLy8gdmFyIHBlYWtzID0gW11cbiAgICAvL1xuICAgIC8vIHZhciB0aHJlc2hvbGQgPSAyXG4gICAgLy8gdmFyIG1pblZhbHVlID0gdGhyZXNob2xkICogYXZnXG4gICAgLy9cbiAgICBjb3VudGVyKytcbiAgICBpZihjb3VudGVyICUgNjAgPT09IDEpe1xuXG5cbiAgICAgIGFsaWNlLmdldEJ1ZmZlcigpXG4gICAgICAvLyBjb25zb2xlLmxvZygncGVhayByYW5nZXMgKGdyb3VwZWQpJylcbiAgICAgIC8vIHZhciBwZWFrX3JhbmdlcyA9IGFsaWNlLmdyb3VwX3BlYWtfcmFuZ2VzKClcbiAgICAgIC8vXG4gICAgICAvLyBpZihwZWFrX3Jhbmdlcyl7XG4gICAgICAvLyAgIGNvbnNvbGUubG9nKHBlYWtfcmFuZ2VzKVxuICAgICAgLy8gICBjb25zb2xlLmxvZyhwZWFrX3Jhbmdlcy5sZW5ndGgpXG4gICAgICAvLyB9XG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKGFsaWNlLmdyb3VwX3BlYWtfcmFuZ2VzKCkpXG5cbiAgICAgIGZvcihpPTA7aTxidWZmZXJMZW5ndGg7aSsrKXtcbiAgICAgICAgYmFyc1tpXS5hdHRyKCdoZWlnaHQnLCBkYXRhQXJyYXlbaV0gKiAyKVxuICAgICAgfVxuXG4gICAgfVxuXG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShkcmF3KTtcblxuICB9XG5cbiAgZHJhdygpXG5cblxufVxuIl19
