(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

module.exports = {
  getBuffer: getBuffer,
  check_peak_ranges: check_peak_ranges,
  group_peak_ranges: group_peak_ranges,
  set_gain: set_gain,
  validate_ranges: validate_ranges,
  n_channels: n_channels,
  get_groups: get_groups,
  encode_range: encode_range,
  get_encoded_byte_array: get_encoded_byte_array
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

var n_osc = 8
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

    local_gain.connect(context.destination)

    local_osc.start()

    osc_bank.push(local_osc)
    gain_bank.push(local_gain)

  }

  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0
  bufferLength = analyser.frequencyBinCount
  analyserDataArray = new Uint8Array(bufferLength)

  setTimeout(register_peak_ranges,200)

}

function n_channels(){
  return n_osc
}

function get_groups(){
  return grouped_peak_ranges
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
  // channel = (n_osc-1) - channel
  gain_bank[channel].gain.value = value
}

function validate_ranges(){

  if(grouped_peak_ranges === undefined){
    return;
  }

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

    // console.log(hits)

    if(hits >= group.length/2){
      valid_groups.push(true)
    } else {
      valid_groups.push(false)
    }

  })

  return valid_groups

}


function encode_range(byte){

  var chars = get_encoded_byte_array(byte)

  // console.log(chars)

  chars.forEach(function(c,idx){
    if(c === '0'){
      set_gain(idx,0)
    } else {
      set_gain(idx,1/n_osc)
    }
  })

}

function get_encoded_byte_array(byte){
  return pad(byte.toString(2),8).split('')
}

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

},{}],2:[function(require,module,exports){
window.onload = function () {
  "use strict";

  console.log('main.js / window.onload anonymous function')

  window.alice = require('./agent.js')
  var dataArray = alice.getBuffer()
  var bufferLength = dataArray.length

  var WIDTH = 1024
  var HEIGHT = 256

  window.d = dataArray
  window.draw = draw

  var barWidth = (WIDTH / bufferLength);

  var barHeight
  var x = 0
  var mod = 0.0
  var counter = 0
  var i

  window.byte_to_code = 1

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

    let bar_idx = svgbars
    bar.on('mouseover', function(){
      console.log(bar_idx)
    })

    bars.push(bar)
  }

  var prev_ranges = []

  function draw() {

    counter++
    if(counter % 5 === 0){

      // console.clear()

      alice.getBuffer()
      for(i=0;i<bufferLength;i++){
        bars[i].attr('height', dataArray[i])
      }

      // does the encoded byte match?


      var ranges = alice.validate_ranges()
      var test_byte = alice.get_encoded_byte_array(window.byte_to_code)

      var no_misses = true
      ranges.forEach(function(range,range_idx){

        if((range === true && test_byte[range_idx] === '1') ||
          (range === false && test_byte[range_idx] === '0')){
          } else {
            no_misses = false
            console.log('miss...')
          }

        // console.log(range, test_byte[range_idx])
      })

      if(no_misses){
        window.byte_to_code += 1
        console.log(window.byte_to_code)

        window.byte_to_code = window.byte_to_code % 255
      }



      alice.encode_range(window.byte_to_code)


      // console.log(ranges)
      // if(ranges[channel_to_check] === false){
      //   channel_to_check += 1
      //   channel_to_check = channel_to_check % alice.n_channels()
      // }
      //
      // for(var i = 0; i < alice.n_channels(); i++){
      //   if(i === channel_to_check){
      //     // console.log('here'+i)
      //     alice.set_gain(i,0.0)
      //   } else {
      //     alice.set_gain(i,1.0/alice.n_channels())
      //   }
      // }
      //
      // var all_matched = true
      // ranges.forEach(function(v,i){
      //   if(v !== prev_ranges[i]){
      //     all_matched = false
      //   }
      // })
      // if(all_matched){
      //   console.log('MISS')
      // }
      //
      // prev_ranges = ranges

    }

    window.requestAnimationFrame(draw);

  }

  setTimeout(draw,500)
  // draw()


}

},{"./agent.js":1}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ2V0QnVmZmVyOiBnZXRCdWZmZXIsXG4gIGNoZWNrX3BlYWtfcmFuZ2VzOiBjaGVja19wZWFrX3JhbmdlcyxcbiAgZ3JvdXBfcGVha19yYW5nZXM6IGdyb3VwX3BlYWtfcmFuZ2VzLFxuICBzZXRfZ2Fpbjogc2V0X2dhaW4sXG4gIHZhbGlkYXRlX3JhbmdlczogdmFsaWRhdGVfcmFuZ2VzLFxuICBuX2NoYW5uZWxzOiBuX2NoYW5uZWxzLFxuICBnZXRfZ3JvdXBzOiBnZXRfZ3JvdXBzLFxuICBlbmNvZGVfcmFuZ2U6IGVuY29kZV9yYW5nZSxcbiAgZ2V0X2VuY29kZWRfYnl0ZV9hcnJheTogZ2V0X2VuY29kZWRfYnl0ZV9hcnJheVxufVxuXG4vLyBjaGVjayBmb3IgZ2xvYmFsIGF1ZGlvIGN0eFxuXG5pZih3aW5kb3cuY29udGV4dCA9PT0gdW5kZWZpbmVkKXtcbiAgd2luZG93LmNvbnRleHQgPSBuZXcgd2luZG93LkF1ZGlvQ29udGV4dCgpXG59XG5cbnZhciBhbmFseXNlciA9IHdpbmRvdy5jb250ZXh0LmNyZWF0ZUFuYWx5c2VyKClcbnZhciBhbmFseXNlckRhdGFBcnJheVxudmFyIGJ1ZmZlckxlbmd0aFxuXG52YXIgcGVha19yYW5nZXNcbnZhciBtZWFuXG52YXIgZ3JvdXBlZF9wZWFrX3Jhbmdlc1xuXG52YXIgb3NjX2JhbmsgPSBbXVxudmFyIGdhaW5fYmFuayA9IFtdXG5cbnZhciBuX29zYyA9IDhcbnZhciBmcmVxUmFuZ2UgPSAxODAwMFxudmFyIHNwcmVhZCA9IChmcmVxUmFuZ2UgLyBuX29zYylcbnZhciBpbml0aWFsRnJlcSA9IDEwMDBcblxuaW5pdCgpXG5nZXRCdWZmZXIoKVxuXG5mdW5jdGlvbiBpbml0KCl7XG5cbiAgLy8gY3JlYXRlIG9zYyArIGdhaW4gYmFua3NcbiAgZm9yKHZhciBpZHggPSAwOyBpZHggPCBuX29zYzsgaWR4Kyspe1xuXG4gICAgbGV0IGxvY2FsX29zYyA9IGNvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpXG4gICAgbG9jYWxfb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IChpZHggKiBzcHJlYWQpICsgaW5pdGlhbEZyZXFcblxuICAgIGxldCBsb2NhbF9nYWluID0gY29udGV4dC5jcmVhdGVHYWluKClcbiAgICBsb2NhbF9nYWluLmdhaW4udmFsdWUgPSAxLjAgLyAobl9vc2MpXG5cbiAgICBsb2NhbF9vc2MuY29ubmVjdChsb2NhbF9nYWluKVxuICAgIGxvY2FsX2dhaW4uY29ubmVjdChhbmFseXNlcilcblxuICAgIGxvY2FsX2dhaW4uY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKVxuXG4gICAgbG9jYWxfb3NjLnN0YXJ0KClcblxuICAgIG9zY19iYW5rLnB1c2gobG9jYWxfb3NjKVxuICAgIGdhaW5fYmFuay5wdXNoKGxvY2FsX2dhaW4pXG5cbiAgfVxuXG4gIGFuYWx5c2VyLmZmdFNpemUgPSAxMDI0XG4gIGFuYWx5c2VyLnNtb290aGluZ1RpbWVDb25zdGFudCA9IDBcbiAgYnVmZmVyTGVuZ3RoID0gYW5hbHlzZXIuZnJlcXVlbmN5QmluQ291bnRcbiAgYW5hbHlzZXJEYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXJMZW5ndGgpXG5cbiAgc2V0VGltZW91dChyZWdpc3Rlcl9wZWFrX3JhbmdlcywyMDApXG5cbn1cblxuZnVuY3Rpb24gbl9jaGFubmVscygpe1xuICByZXR1cm4gbl9vc2Ncbn1cblxuZnVuY3Rpb24gZ2V0X2dyb3Vwcygpe1xuICByZXR1cm4gZ3JvdXBlZF9wZWFrX3Jhbmdlc1xufVxuXG5cblxuZnVuY3Rpb24gZ2V0QnVmZmVyKCl7XG4gIGFuYWx5c2VyLmdldEJ5dGVGcmVxdWVuY3lEYXRhKGFuYWx5c2VyRGF0YUFycmF5KVxuICByZXR1cm4gYW5hbHlzZXJEYXRhQXJyYXlcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJfcGVha19yYW5nZXMoKXtcblxuICBnZXRCdWZmZXIoKVxuXG4gIC8vIHB1c2ggb24gdG8gbmV3IGFycmF5IGZvciBzb3J0aW5nXG4gIHZhciBkID0gW11cbiAgZm9yKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKXtcbiAgICBpZihhbmFseXNlckRhdGFBcnJheVtpXSA+IDApe1xuICAgICAgZC5wdXNoKGFuYWx5c2VyRGF0YUFycmF5W2ldKVxuICAgIH1cbiAgfVxuICBkLnNvcnQoZnVuY3Rpb24oYSxiKXtcbiAgICByZXR1cm4gYS1iXG4gIH0pXG4gIGNvbnNvbGUubG9nKCdNZWFuOiAnK2RbTWF0aC5mbG9vcihkLmxlbmd0aC8yKV0pXG5cbiAgbWVhbiA9IGRbTWF0aC5mbG9vcihkLmxlbmd0aC8yKV1cblxuICAvL1xuICBwZWFrX3JhbmdlcyA9IFtdXG4gIGZvcih2YXIgaSA9IDA7IGkgPCBidWZmZXJMZW5ndGg7IGkrKyl7XG4gICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbaV0gPiBtZWFuKXtcbiAgICAgIHBlYWtfcmFuZ2VzLnB1c2goaSlcbiAgICB9XG4gIH1cblxuICB3aW5kb3cucCA9IHBlYWtfcmFuZ2VzXG5cbiAgZ3JvdXBfcGVha19yYW5nZXMoKVxuXG59XG5cbmZ1bmN0aW9uIGNoZWNrX3BlYWtfcmFuZ2VzKCl7XG5cbiAgZ2V0QnVmZmVyKClcblxuICB2YXIgaGl0cyA9IFtdXG4gIHBlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24oZGF0YUFycmF5X2lkeCl7XG4gICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbZGF0YUFycmF5X2lkeF0gPiBtZWFuKXtcbiAgICAgIGhpdHMucHVzaCh0cnVlKVxuICAgIH0gZWxzZSB7XG4gICAgICBoaXRzLnB1c2goZmFsc2UpXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiBoaXRzXG5cbn1cblxuZnVuY3Rpb24gZ3JvdXBfcGVha19yYW5nZXMoKXtcblxuICBpZihwZWFrX3JhbmdlcyA9PT0gdW5kZWZpbmVkIHx8IHBlYWtfcmFuZ2VzLmxlbmd0aCA9PT0gMCl7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGdyb3VwcyA9IFtdIC8vIFsgWzEsMiwzXSwgWzgsOSwxMF0sIFszMCwzMSwzMl0gIF1cblxuICB2YXIgY3VycmVudF9ncm91cF9pZHggPSAwXG5cbiAgdmFyIGxvY2FsX2dyb3VwID0gbmV3IEFycmF5KClcblxuICBwZWFrX3Jhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKHBlYWtfaWR4LCBpZHgpe1xuXG4gICAgLy8gaWYgdGhlIE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4KzFdKSA9PT0gMVxuICAgIC8vICAgIHB1c2ggcGVha19pZHggb24gdG8gbG9jYWxfZ3JvdXBcbiAgICAvLyBlbHNlXG4gICAgLy8gICAgcHVzaCBsb2NhbF9ncm91cCBvbiB0byBncm91cHNcbiAgICAvLyAgICBjbGVhciBsb2NhbF9ncm91cFxuICAgIC8vICAgIHB1c2ggcGVha19pZHggb24gdG8gbG9jYWxfZ3JvdXBcblxuICAgIGlmKGlkeCA9PT0gcGVha19yYW5nZXMubGVuZ3RoLTEpe1xuICAgICAgLy8gY29uc29sZS5sb2coJ2hlcmUnKVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4KzFdKSA8PSAyKXtcbiAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgfSBlbHNlIHtcbiAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgICBncm91cHMucHVzaChsb2NhbF9ncm91cClcbiAgICAgIGxvY2FsX2dyb3VwID0gbmV3IEFycmF5KClcbiAgICB9XG5cbiAgfSlcblxuICBncm91cHMucHVzaChsb2NhbF9ncm91cClcblxuICBncm91cGVkX3BlYWtfcmFuZ2VzID0gZ3JvdXBzXG5cbiAgcmV0dXJuIGdyb3Vwc1xuXG59XG5cbmZ1bmN0aW9uIHNldF9nYWluKGNoYW5uZWwsIHZhbHVlKXtcbiAgLy8gY2hhbm5lbCA9IChuX29zYy0xKSAtIGNoYW5uZWxcbiAgZ2Fpbl9iYW5rW2NoYW5uZWxdLmdhaW4udmFsdWUgPSB2YWx1ZVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZV9yYW5nZXMoKXtcblxuICBpZihncm91cGVkX3BlYWtfcmFuZ2VzID09PSB1bmRlZmluZWQpe1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGdldEJ1ZmZlcigpXG5cbiAgdmFyIHZhbGlkX2dyb3VwcyA9IFtdXG5cbiAgZ3JvdXBlZF9wZWFrX3Jhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGdyb3VwKXtcblxuICAgIC8vIGZvciBlYWNoIGVudHJ5IGluIHRoZSBncm91cFxuICAgIHZhciBoaXRzID0gMFxuXG4gICAgZ3JvdXAuZm9yRWFjaChmdW5jdGlvbihpZHgpe1xuICAgICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbaWR4XSA+PSBtZWFuKXtcbiAgICAgICAgaGl0cyArPSAxXG4gICAgICB9XG4gICAgfSlcblxuICAgIC8vIGNvbnNvbGUubG9nKGhpdHMpXG5cbiAgICBpZihoaXRzID49IGdyb3VwLmxlbmd0aC8yKXtcbiAgICAgIHZhbGlkX2dyb3Vwcy5wdXNoKHRydWUpXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbGlkX2dyb3Vwcy5wdXNoKGZhbHNlKVxuICAgIH1cblxuICB9KVxuXG4gIHJldHVybiB2YWxpZF9ncm91cHNcblxufVxuXG5cbmZ1bmN0aW9uIGVuY29kZV9yYW5nZShieXRlKXtcblxuICB2YXIgY2hhcnMgPSBnZXRfZW5jb2RlZF9ieXRlX2FycmF5KGJ5dGUpXG5cbiAgLy8gY29uc29sZS5sb2coY2hhcnMpXG5cbiAgY2hhcnMuZm9yRWFjaChmdW5jdGlvbihjLGlkeCl7XG4gICAgaWYoYyA9PT0gJzAnKXtcbiAgICAgIHNldF9nYWluKGlkeCwwKVxuICAgIH0gZWxzZSB7XG4gICAgICBzZXRfZ2FpbihpZHgsMS9uX29zYylcbiAgICB9XG4gIH0pXG5cbn1cblxuZnVuY3Rpb24gZ2V0X2VuY29kZWRfYnl0ZV9hcnJheShieXRlKXtcbiAgcmV0dXJuIHBhZChieXRlLnRvU3RyaW5nKDIpLDgpLnNwbGl0KCcnKVxufVxuXG5mdW5jdGlvbiBwYWQobiwgd2lkdGgsIHopIHtcbiAgeiA9IHogfHwgJzAnO1xuICBuID0gbiArICcnO1xuICByZXR1cm4gbi5sZW5ndGggPj0gd2lkdGggPyBuIDogbmV3IEFycmF5KHdpZHRoIC0gbi5sZW5ndGggKyAxKS5qb2luKHopICsgbjtcbn1cbiIsIndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIGNvbnNvbGUubG9nKCdtYWluLmpzIC8gd2luZG93Lm9ubG9hZCBhbm9ueW1vdXMgZnVuY3Rpb24nKVxuXG4gIHdpbmRvdy5hbGljZSA9IHJlcXVpcmUoJy4vYWdlbnQuanMnKVxuICB2YXIgZGF0YUFycmF5ID0gYWxpY2UuZ2V0QnVmZmVyKClcbiAgdmFyIGJ1ZmZlckxlbmd0aCA9IGRhdGFBcnJheS5sZW5ndGhcblxuICB2YXIgV0lEVEggPSAxMDI0XG4gIHZhciBIRUlHSFQgPSAyNTZcblxuICB3aW5kb3cuZCA9IGRhdGFBcnJheVxuICB3aW5kb3cuZHJhdyA9IGRyYXdcblxuICB2YXIgYmFyV2lkdGggPSAoV0lEVEggLyBidWZmZXJMZW5ndGgpO1xuXG4gIHZhciBiYXJIZWlnaHRcbiAgdmFyIHggPSAwXG4gIHZhciBtb2QgPSAwLjBcbiAgdmFyIGNvdW50ZXIgPSAwXG4gIHZhciBpXG5cbiAgd2luZG93LmJ5dGVfdG9fY29kZSA9IDFcblxuICB2YXIgc3ZnID0gZDMuc2VsZWN0KCdkaXYjY29udGFpbmVyJykuYXBwZW5kKCdzdmcnKVxuICAgIC5hdHRyKCd3aWR0aCcsV0lEVEgpXG4gICAgLmF0dHIoJ2hlaWdodCcsIEhFSUdIVClcblxuICB2YXIgYmFycyA9IFtdXG4gIGZvcih2YXIgc3ZnYmFycyA9IDA7IHN2Z2JhcnMgPCBidWZmZXJMZW5ndGg7IHN2Z2JhcnMrKyl7XG4gICAgdmFyIGJhciA9IHN2Zy5hcHBlbmQoJ3JlY3QnKVxuICAgICAgLmF0dHIoJ3gnLCBiYXJXaWR0aCAqIHN2Z2JhcnMpXG4gICAgICAuYXR0cigneScsIDApXG4gICAgICAuYXR0cignd2lkdGgnLCBiYXJXaWR0aClcbiAgICAgIC5hdHRyKCdoZWlnaHQnLCAwKVxuXG4gICAgbGV0IGJhcl9pZHggPSBzdmdiYXJzXG4gICAgYmFyLm9uKCdtb3VzZW92ZXInLCBmdW5jdGlvbigpe1xuICAgICAgY29uc29sZS5sb2coYmFyX2lkeClcbiAgICB9KVxuXG4gICAgYmFycy5wdXNoKGJhcilcbiAgfVxuXG4gIHZhciBwcmV2X3JhbmdlcyA9IFtdXG5cbiAgZnVuY3Rpb24gZHJhdygpIHtcblxuICAgIGNvdW50ZXIrK1xuICAgIGlmKGNvdW50ZXIgJSA1ID09PSAwKXtcblxuICAgICAgLy8gY29uc29sZS5jbGVhcigpXG5cbiAgICAgIGFsaWNlLmdldEJ1ZmZlcigpXG4gICAgICBmb3IoaT0wO2k8YnVmZmVyTGVuZ3RoO2krKyl7XG4gICAgICAgIGJhcnNbaV0uYXR0cignaGVpZ2h0JywgZGF0YUFycmF5W2ldKVxuICAgICAgfVxuXG4gICAgICAvLyBkb2VzIHRoZSBlbmNvZGVkIGJ5dGUgbWF0Y2g/XG5cblxuICAgICAgdmFyIHJhbmdlcyA9IGFsaWNlLnZhbGlkYXRlX3JhbmdlcygpXG4gICAgICB2YXIgdGVzdF9ieXRlID0gYWxpY2UuZ2V0X2VuY29kZWRfYnl0ZV9hcnJheSh3aW5kb3cuYnl0ZV90b19jb2RlKVxuXG4gICAgICB2YXIgbm9fbWlzc2VzID0gdHJ1ZVxuICAgICAgcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24ocmFuZ2UscmFuZ2VfaWR4KXtcblxuICAgICAgICBpZigocmFuZ2UgPT09IHRydWUgJiYgdGVzdF9ieXRlW3JhbmdlX2lkeF0gPT09ICcxJykgfHxcbiAgICAgICAgICAocmFuZ2UgPT09IGZhbHNlICYmIHRlc3RfYnl0ZVtyYW5nZV9pZHhdID09PSAnMCcpKXtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbm9fbWlzc2VzID0gZmFsc2VcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdtaXNzLi4uJylcbiAgICAgICAgICB9XG5cbiAgICAgICAgLy8gY29uc29sZS5sb2cocmFuZ2UsIHRlc3RfYnl0ZVtyYW5nZV9pZHhdKVxuICAgICAgfSlcblxuICAgICAgaWYobm9fbWlzc2VzKXtcbiAgICAgICAgd2luZG93LmJ5dGVfdG9fY29kZSArPSAxXG4gICAgICAgIGNvbnNvbGUubG9nKHdpbmRvdy5ieXRlX3RvX2NvZGUpXG5cbiAgICAgICAgd2luZG93LmJ5dGVfdG9fY29kZSA9IHdpbmRvdy5ieXRlX3RvX2NvZGUgJSAyNTVcbiAgICAgIH1cblxuXG5cbiAgICAgIGFsaWNlLmVuY29kZV9yYW5nZSh3aW5kb3cuYnl0ZV90b19jb2RlKVxuXG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKHJhbmdlcylcbiAgICAgIC8vIGlmKHJhbmdlc1tjaGFubmVsX3RvX2NoZWNrXSA9PT0gZmFsc2Upe1xuICAgICAgLy8gICBjaGFubmVsX3RvX2NoZWNrICs9IDFcbiAgICAgIC8vICAgY2hhbm5lbF90b19jaGVjayA9IGNoYW5uZWxfdG9fY2hlY2sgJSBhbGljZS5uX2NoYW5uZWxzKClcbiAgICAgIC8vIH1cbiAgICAgIC8vXG4gICAgICAvLyBmb3IodmFyIGkgPSAwOyBpIDwgYWxpY2Uubl9jaGFubmVscygpOyBpKyspe1xuICAgICAgLy8gICBpZihpID09PSBjaGFubmVsX3RvX2NoZWNrKXtcbiAgICAgIC8vICAgICAvLyBjb25zb2xlLmxvZygnaGVyZScraSlcbiAgICAgIC8vICAgICBhbGljZS5zZXRfZ2FpbihpLDAuMClcbiAgICAgIC8vICAgfSBlbHNlIHtcbiAgICAgIC8vICAgICBhbGljZS5zZXRfZ2FpbihpLDEuMC9hbGljZS5uX2NoYW5uZWxzKCkpXG4gICAgICAvLyAgIH1cbiAgICAgIC8vIH1cbiAgICAgIC8vXG4gICAgICAvLyB2YXIgYWxsX21hdGNoZWQgPSB0cnVlXG4gICAgICAvLyByYW5nZXMuZm9yRWFjaChmdW5jdGlvbih2LGkpe1xuICAgICAgLy8gICBpZih2ICE9PSBwcmV2X3Jhbmdlc1tpXSl7XG4gICAgICAvLyAgICAgYWxsX21hdGNoZWQgPSBmYWxzZVxuICAgICAgLy8gICB9XG4gICAgICAvLyB9KVxuICAgICAgLy8gaWYoYWxsX21hdGNoZWQpe1xuICAgICAgLy8gICBjb25zb2xlLmxvZygnTUlTUycpXG4gICAgICAvLyB9XG4gICAgICAvL1xuICAgICAgLy8gcHJldl9yYW5nZXMgPSByYW5nZXNcblxuICAgIH1cblxuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZHJhdyk7XG5cbiAgfVxuXG4gIHNldFRpbWVvdXQoZHJhdyw1MDApXG4gIC8vIGRyYXcoKVxuXG5cbn1cbiJdfQ==
