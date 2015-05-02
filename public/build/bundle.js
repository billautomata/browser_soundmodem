(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

module.exports.agent = agent


function agent(){

  // check for global audio ctx
  // var context

  if(window.context === undefined){
    console.log('creating new window.AudioContext()')
    window.context = new window.AudioContext()
    // var context = new window.AudioContext()
  } else {
    // context = window.context
  }

  var analyser = context.createAnalyser()
  // var local_analyser = window.context.createAnalyser()
  var analyserDataArray
  var bufferLength

  var peak_ranges
  var mean
  var grouped_peak_ranges

  var flip_flop = true

  var osc_bank = []
  var gain_bank = []

  var n_osc = 10
  var freqRange = 17000
  var spread = (freqRange / n_osc)
  var initialFreq = 1000

  // init()
  // getBuffer()

  function init(name){

    // create osc + gain banks
    for(var idx = 0; idx < n_osc; idx++){

      let local_osc = context.createOscillator()
      local_osc.frequency.value = (idx * spread) + initialFreq

      let local_gain = context.createGain()
      local_gain.gain.value = 1.0 / (n_osc)

      local_osc.connect(local_gain)

      // local_gain.connect(analyser)
      // local_gain.connect(context.destination)

      local_osc.start()

      osc_bank.push(local_osc)
      gain_bank.push(local_gain)

    }

    analyser.name = name
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0
    bufferLength = analyser.frequencyBinCount
    analyserDataArray = new Uint8Array(bufferLength)

  }

  function connect(other_agent){

    var other_gain_bank = other_agent.get_gain_bank()
    // console.log(other_analyser)

    other_gain_bank.forEach(function(gainNode){
      // console.log(gainNode)
      gainNode.connect(analyser)
    })

    getBuffer()

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

  function get_gain_bank(){
    return gain_bank
  }

  function get_analyser(){
    return analyser
  }

  function register_peak_ranges(){

    getBuffer()
    console.log(analyserDataArray)

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

    // window.p = peak_ranges

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

  function encode_byte(byte){

    var chars = get_encoded_byte_array(byte)

    // console.log(chars)

    chars.forEach(function(c,idx){
      if(c === '0'){
        set_gain(idx,0)
      } else {
        set_gain(idx,1/n_osc)
      }
    })

    flip_flop = !flip_flop
    if(flip_flop){
      set_gain(8,1/n_osc)
      set_gain(9,0)
    } else {
      set_gain(9,1/n_osc)
      set_gain(8,0)
    }

  }

  function get_encoded_byte_array(byte){
    return pad(byte.toString(2),8).split('')
  }

  function read_byte_from_signal(){

    var ranges = validate_ranges()

    console.log(ranges)

    var binary_string = ''
    for(var i = 0; i < 8; i++){
      if(ranges[i]){
        binary_string += '1'
      } else {
        binary_string += '0'
      }
    }

    return parseInt(binary_string,2)

  }


  function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }


  var k = {
    init: init,
    connect: connect,
    get_gain_bank: get_gain_bank,
    get_analyser: get_analyser,
    getBuffer: getBuffer,
    check_peak_ranges: check_peak_ranges,
    group_peak_ranges: group_peak_ranges,
    set_gain: set_gain,
    validate_ranges: validate_ranges,
    n_channels: n_channels,
    get_groups: get_groups,
    encode_range: encode_byte,
    get_encoded_byte_array: get_encoded_byte_array,
    read_byte_from_signal: read_byte_from_signal
  }

  return k

}

},{}],2:[function(require,module,exports){
window.onload = function () {
  "use strict";

  console.log('main.js / window.onload anonymous function')


  var Agent = require('./agent.js')
  // return;

  window.alice = Agent.agent()
  alice.init('alice')

  window.bob = Agent.agent()
  bob.init('bob')

  alice.connect(bob)
  bob.connect(alice)

  // return;

  var dataArray = alice.getBuffer()
  var bufferLength = dataArray.length

  var WIDTH = 1024
  var HEIGHT = 256

  // window.d = dataArray
  window.draw = draw

  var barWidth = (WIDTH / bufferLength);

  var barHeight
  var x = 0
  var mod = 0.0
  var counter = 0
  var i

  window.byte_to_code = 1

  // create svg
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
    if(counter % 10 === 1){

      console.clear()
      console.log(Date.now())

      alice.getBuffer()
      for(i=0;i<bufferLength;i++){
        bars[i].attr('height', dataArray[i])
      }

      console.log('here')

      // does the encoded byte match?
      var current_signal_byte = alice.read_byte_from_signal()
      console.log('current signal byte ' + current_signal_byte)

      // return true;

      // if(current_signal_byte === window.byte_to_code){
      //   window.byte_to_code += 1
      //   console.log(window.byte_to_code)
      //   window.byte_to_code = window.byte_to_code % 255
      // } else {
      //   console.log('too slow!')
      // }


      // var ranges = alice.validate_ranges()
      // var test_byte = alice.get_encoded_byte_array(window.byte_to_code)
      //
      // var no_misses = true
      // for(var i = 0; i < 8; i++){
      //   if((ranges[i] === true && test_byte[i] === '1') ||
      //     (ranges[i] === false && test_byte[i] === '0')){
      //       // do nothing
      //     } else {
      //       no_misses = false
      //       console.log('miss')
      //     }
      //
      //
      // }
      //
      // if(no_misses){
      // }


      // console.log('encoding ' + window.byte_to_code)
      // bob.encode_range(window.byte_to_code)


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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzLmFnZW50ID0gYWdlbnRcblxuXG5mdW5jdGlvbiBhZ2VudCgpe1xuXG4gIC8vIGNoZWNrIGZvciBnbG9iYWwgYXVkaW8gY3R4XG4gIC8vIHZhciBjb250ZXh0XG5cbiAgaWYod2luZG93LmNvbnRleHQgPT09IHVuZGVmaW5lZCl7XG4gICAgY29uc29sZS5sb2coJ2NyZWF0aW5nIG5ldyB3aW5kb3cuQXVkaW9Db250ZXh0KCknKVxuICAgIHdpbmRvdy5jb250ZXh0ID0gbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKVxuICAgIC8vIHZhciBjb250ZXh0ID0gbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKVxuICB9IGVsc2Uge1xuICAgIC8vIGNvbnRleHQgPSB3aW5kb3cuY29udGV4dFxuICB9XG5cbiAgdmFyIGFuYWx5c2VyID0gY29udGV4dC5jcmVhdGVBbmFseXNlcigpXG4gIC8vIHZhciBsb2NhbF9hbmFseXNlciA9IHdpbmRvdy5jb250ZXh0LmNyZWF0ZUFuYWx5c2VyKClcbiAgdmFyIGFuYWx5c2VyRGF0YUFycmF5XG4gIHZhciBidWZmZXJMZW5ndGhcblxuICB2YXIgcGVha19yYW5nZXNcbiAgdmFyIG1lYW5cbiAgdmFyIGdyb3VwZWRfcGVha19yYW5nZXNcblxuICB2YXIgZmxpcF9mbG9wID0gdHJ1ZVxuXG4gIHZhciBvc2NfYmFuayA9IFtdXG4gIHZhciBnYWluX2JhbmsgPSBbXVxuXG4gIHZhciBuX29zYyA9IDEwXG4gIHZhciBmcmVxUmFuZ2UgPSAxNzAwMFxuICB2YXIgc3ByZWFkID0gKGZyZXFSYW5nZSAvIG5fb3NjKVxuICB2YXIgaW5pdGlhbEZyZXEgPSAxMDAwXG5cbiAgLy8gaW5pdCgpXG4gIC8vIGdldEJ1ZmZlcigpXG5cbiAgZnVuY3Rpb24gaW5pdChuYW1lKXtcblxuICAgIC8vIGNyZWF0ZSBvc2MgKyBnYWluIGJhbmtzXG4gICAgZm9yKHZhciBpZHggPSAwOyBpZHggPCBuX29zYzsgaWR4Kyspe1xuXG4gICAgICBsZXQgbG9jYWxfb3NjID0gY29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKClcbiAgICAgIGxvY2FsX29zYy5mcmVxdWVuY3kudmFsdWUgPSAoaWR4ICogc3ByZWFkKSArIGluaXRpYWxGcmVxXG5cbiAgICAgIGxldCBsb2NhbF9nYWluID0gY29udGV4dC5jcmVhdGVHYWluKClcbiAgICAgIGxvY2FsX2dhaW4uZ2Fpbi52YWx1ZSA9IDEuMCAvIChuX29zYylcblxuICAgICAgbG9jYWxfb3NjLmNvbm5lY3QobG9jYWxfZ2FpbilcblxuICAgICAgLy8gbG9jYWxfZ2Fpbi5jb25uZWN0KGFuYWx5c2VyKVxuICAgICAgLy8gbG9jYWxfZ2Fpbi5jb25uZWN0KGNvbnRleHQuZGVzdGluYXRpb24pXG5cbiAgICAgIGxvY2FsX29zYy5zdGFydCgpXG5cbiAgICAgIG9zY19iYW5rLnB1c2gobG9jYWxfb3NjKVxuICAgICAgZ2Fpbl9iYW5rLnB1c2gobG9jYWxfZ2FpbilcblxuICAgIH1cblxuICAgIGFuYWx5c2VyLm5hbWUgPSBuYW1lXG4gICAgYW5hbHlzZXIuZmZ0U2l6ZSA9IDEwMjRcbiAgICBhbmFseXNlci5zbW9vdGhpbmdUaW1lQ29uc3RhbnQgPSAwXG4gICAgYnVmZmVyTGVuZ3RoID0gYW5hbHlzZXIuZnJlcXVlbmN5QmluQ291bnRcbiAgICBhbmFseXNlckRhdGFBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlckxlbmd0aClcblxuICB9XG5cbiAgZnVuY3Rpb24gY29ubmVjdChvdGhlcl9hZ2VudCl7XG5cbiAgICB2YXIgb3RoZXJfZ2Fpbl9iYW5rID0gb3RoZXJfYWdlbnQuZ2V0X2dhaW5fYmFuaygpXG4gICAgLy8gY29uc29sZS5sb2cob3RoZXJfYW5hbHlzZXIpXG5cbiAgICBvdGhlcl9nYWluX2JhbmsuZm9yRWFjaChmdW5jdGlvbihnYWluTm9kZSl7XG4gICAgICAvLyBjb25zb2xlLmxvZyhnYWluTm9kZSlcbiAgICAgIGdhaW5Ob2RlLmNvbm5lY3QoYW5hbHlzZXIpXG4gICAgfSlcblxuICAgIGdldEJ1ZmZlcigpXG5cbiAgICBzZXRUaW1lb3V0KHJlZ2lzdGVyX3BlYWtfcmFuZ2VzLDIwMClcblxuICB9XG5cblxuICBmdW5jdGlvbiBuX2NoYW5uZWxzKCl7XG4gICAgcmV0dXJuIG5fb3NjXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfZ3JvdXBzKCl7XG4gICAgcmV0dXJuIGdyb3VwZWRfcGVha19yYW5nZXNcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEJ1ZmZlcigpe1xuICAgIGFuYWx5c2VyLmdldEJ5dGVGcmVxdWVuY3lEYXRhKGFuYWx5c2VyRGF0YUFycmF5KVxuICAgIHJldHVybiBhbmFseXNlckRhdGFBcnJheVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2dhaW5fYmFuaygpe1xuICAgIHJldHVybiBnYWluX2JhbmtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9hbmFseXNlcigpe1xuICAgIHJldHVybiBhbmFseXNlclxuICB9XG5cbiAgZnVuY3Rpb24gcmVnaXN0ZXJfcGVha19yYW5nZXMoKXtcblxuICAgIGdldEJ1ZmZlcigpXG4gICAgY29uc29sZS5sb2coYW5hbHlzZXJEYXRhQXJyYXkpXG5cbiAgICAvLyBwdXNoIG9uIHRvIG5ldyBhcnJheSBmb3Igc29ydGluZ1xuICAgIHZhciBkID0gW11cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgYnVmZmVyTGVuZ3RoOyBpKyspe1xuICAgICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbaV0gPiAwKXtcbiAgICAgICAgZC5wdXNoKGFuYWx5c2VyRGF0YUFycmF5W2ldKVxuICAgICAgfVxuICAgIH1cbiAgICBkLnNvcnQoZnVuY3Rpb24oYSxiKXtcbiAgICAgIHJldHVybiBhLWJcbiAgICB9KVxuICAgIGNvbnNvbGUubG9nKCdNZWFuOiAnK2RbTWF0aC5mbG9vcihkLmxlbmd0aC8yKV0pXG5cbiAgICBtZWFuID0gZFtNYXRoLmZsb29yKGQubGVuZ3RoLzIpXVxuXG4gICAgLy9cbiAgICBwZWFrX3JhbmdlcyA9IFtdXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKXtcbiAgICAgIGlmKGFuYWx5c2VyRGF0YUFycmF5W2ldID4gbWVhbil7XG4gICAgICAgIHBlYWtfcmFuZ2VzLnB1c2goaSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB3aW5kb3cucCA9IHBlYWtfcmFuZ2VzXG5cbiAgICBncm91cF9wZWFrX3JhbmdlcygpXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNoZWNrX3BlYWtfcmFuZ2VzKCl7XG5cbiAgICBnZXRCdWZmZXIoKVxuXG4gICAgdmFyIGhpdHMgPSBbXVxuICAgIHBlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24oZGF0YUFycmF5X2lkeCl7XG4gICAgICBpZihhbmFseXNlckRhdGFBcnJheVtkYXRhQXJyYXlfaWR4XSA+IG1lYW4pe1xuICAgICAgICBoaXRzLnB1c2godHJ1ZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGhpdHMucHVzaChmYWxzZSlcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIGhpdHNcblxuICB9XG5cbiAgZnVuY3Rpb24gZ3JvdXBfcGVha19yYW5nZXMoKXtcblxuICAgIGlmKHBlYWtfcmFuZ2VzID09PSB1bmRlZmluZWQgfHwgcGVha19yYW5nZXMubGVuZ3RoID09PSAwKXtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZ3JvdXBzID0gW10gLy8gWyBbMSwyLDNdLCBbOCw5LDEwXSwgWzMwLDMxLDMyXSAgXVxuXG4gICAgdmFyIGN1cnJlbnRfZ3JvdXBfaWR4ID0gMFxuXG4gICAgdmFyIGxvY2FsX2dyb3VwID0gbmV3IEFycmF5KClcblxuICAgIHBlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24ocGVha19pZHgsIGlkeCl7XG5cbiAgICAgIC8vIGlmIHRoZSBNYXRoLmFicyhwZWFrX2lkeCAtIHBlYWtfcmFuZ2VzW2lkeCsxXSkgPT09IDFcbiAgICAgIC8vICAgIHB1c2ggcGVha19pZHggb24gdG8gbG9jYWxfZ3JvdXBcbiAgICAgIC8vIGVsc2VcbiAgICAgIC8vICAgIHB1c2ggbG9jYWxfZ3JvdXAgb24gdG8gZ3JvdXBzXG4gICAgICAvLyAgICBjbGVhciBsb2NhbF9ncm91cFxuICAgICAgLy8gICAgcHVzaCBwZWFrX2lkeCBvbiB0byBsb2NhbF9ncm91cFxuXG4gICAgICBpZihpZHggPT09IHBlYWtfcmFuZ2VzLmxlbmd0aC0xKXtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ2hlcmUnKVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmKE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4KzFdKSA8PSAyKXtcbiAgICAgICAgbG9jYWxfZ3JvdXAucHVzaChwZWFrX2lkeClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgICAgIGdyb3Vwcy5wdXNoKGxvY2FsX2dyb3VwKVxuICAgICAgICBsb2NhbF9ncm91cCA9IG5ldyBBcnJheSgpXG4gICAgICB9XG5cbiAgICB9KVxuXG4gICAgZ3JvdXBzLnB1c2gobG9jYWxfZ3JvdXApXG5cbiAgICBncm91cGVkX3BlYWtfcmFuZ2VzID0gZ3JvdXBzXG5cbiAgICByZXR1cm4gZ3JvdXBzXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9nYWluKGNoYW5uZWwsIHZhbHVlKXtcbiAgICAvLyBjaGFubmVsID0gKG5fb3NjLTEpIC0gY2hhbm5lbFxuICAgIGdhaW5fYmFua1tjaGFubmVsXS5nYWluLnZhbHVlID0gdmFsdWVcbiAgfVxuXG4gIGZ1bmN0aW9uIHZhbGlkYXRlX3Jhbmdlcygpe1xuXG4gICAgaWYoZ3JvdXBlZF9wZWFrX3JhbmdlcyA9PT0gdW5kZWZpbmVkKXtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBnZXRCdWZmZXIoKVxuXG4gICAgdmFyIHZhbGlkX2dyb3VwcyA9IFtdXG5cbiAgICBncm91cGVkX3BlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24oZ3JvdXApe1xuXG4gICAgICAvLyBmb3IgZWFjaCBlbnRyeSBpbiB0aGUgZ3JvdXBcbiAgICAgIHZhciBoaXRzID0gMFxuXG4gICAgICBncm91cC5mb3JFYWNoKGZ1bmN0aW9uKGlkeCl7XG4gICAgICAgIGlmKGFuYWx5c2VyRGF0YUFycmF5W2lkeF0gPj0gbWVhbil7XG4gICAgICAgICAgaGl0cyArPSAxXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKGhpdHMpXG5cbiAgICAgIGlmKGhpdHMgPj0gZ3JvdXAubGVuZ3RoLzIpe1xuICAgICAgICB2YWxpZF9ncm91cHMucHVzaCh0cnVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsaWRfZ3JvdXBzLnB1c2goZmFsc2UpXG4gICAgICB9XG5cbiAgICB9KVxuXG4gICAgcmV0dXJuIHZhbGlkX2dyb3Vwc1xuXG4gIH1cblxuICBmdW5jdGlvbiBlbmNvZGVfYnl0ZShieXRlKXtcblxuICAgIHZhciBjaGFycyA9IGdldF9lbmNvZGVkX2J5dGVfYXJyYXkoYnl0ZSlcblxuICAgIC8vIGNvbnNvbGUubG9nKGNoYXJzKVxuXG4gICAgY2hhcnMuZm9yRWFjaChmdW5jdGlvbihjLGlkeCl7XG4gICAgICBpZihjID09PSAnMCcpe1xuICAgICAgICBzZXRfZ2FpbihpZHgsMClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldF9nYWluKGlkeCwxL25fb3NjKVxuICAgICAgfVxuICAgIH0pXG5cbiAgICBmbGlwX2Zsb3AgPSAhZmxpcF9mbG9wXG4gICAgaWYoZmxpcF9mbG9wKXtcbiAgICAgIHNldF9nYWluKDgsMS9uX29zYylcbiAgICAgIHNldF9nYWluKDksMClcbiAgICB9IGVsc2Uge1xuICAgICAgc2V0X2dhaW4oOSwxL25fb3NjKVxuICAgICAgc2V0X2dhaW4oOCwwKVxuICAgIH1cblxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2VuY29kZWRfYnl0ZV9hcnJheShieXRlKXtcbiAgICByZXR1cm4gcGFkKGJ5dGUudG9TdHJpbmcoMiksOCkuc3BsaXQoJycpXG4gIH1cblxuICBmdW5jdGlvbiByZWFkX2J5dGVfZnJvbV9zaWduYWwoKXtcblxuICAgIHZhciByYW5nZXMgPSB2YWxpZGF0ZV9yYW5nZXMoKVxuXG4gICAgY29uc29sZS5sb2cocmFuZ2VzKVxuXG4gICAgdmFyIGJpbmFyeV9zdHJpbmcgPSAnJ1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCA4OyBpKyspe1xuICAgICAgaWYocmFuZ2VzW2ldKXtcbiAgICAgICAgYmluYXJ5X3N0cmluZyArPSAnMSdcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJpbmFyeV9zdHJpbmcgKz0gJzAnXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcnNlSW50KGJpbmFyeV9zdHJpbmcsMilcblxuICB9XG5cblxuICBmdW5jdGlvbiBwYWQobiwgd2lkdGgsIHopIHtcbiAgICB6ID0geiB8fCAnMCc7XG4gICAgbiA9IG4gKyAnJztcbiAgICByZXR1cm4gbi5sZW5ndGggPj0gd2lkdGggPyBuIDogbmV3IEFycmF5KHdpZHRoIC0gbi5sZW5ndGggKyAxKS5qb2luKHopICsgbjtcbiAgfVxuXG5cbiAgdmFyIGsgPSB7XG4gICAgaW5pdDogaW5pdCxcbiAgICBjb25uZWN0OiBjb25uZWN0LFxuICAgIGdldF9nYWluX2Jhbms6IGdldF9nYWluX2JhbmssXG4gICAgZ2V0X2FuYWx5c2VyOiBnZXRfYW5hbHlzZXIsXG4gICAgZ2V0QnVmZmVyOiBnZXRCdWZmZXIsXG4gICAgY2hlY2tfcGVha19yYW5nZXM6IGNoZWNrX3BlYWtfcmFuZ2VzLFxuICAgIGdyb3VwX3BlYWtfcmFuZ2VzOiBncm91cF9wZWFrX3JhbmdlcyxcbiAgICBzZXRfZ2Fpbjogc2V0X2dhaW4sXG4gICAgdmFsaWRhdGVfcmFuZ2VzOiB2YWxpZGF0ZV9yYW5nZXMsXG4gICAgbl9jaGFubmVsczogbl9jaGFubmVscyxcbiAgICBnZXRfZ3JvdXBzOiBnZXRfZ3JvdXBzLFxuICAgIGVuY29kZV9yYW5nZTogZW5jb2RlX2J5dGUsXG4gICAgZ2V0X2VuY29kZWRfYnl0ZV9hcnJheTogZ2V0X2VuY29kZWRfYnl0ZV9hcnJheSxcbiAgICByZWFkX2J5dGVfZnJvbV9zaWduYWw6IHJlYWRfYnl0ZV9mcm9tX3NpZ25hbFxuICB9XG5cbiAgcmV0dXJuIGtcblxufVxuIiwid2luZG93Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgY29uc29sZS5sb2coJ21haW4uanMgLyB3aW5kb3cub25sb2FkIGFub255bW91cyBmdW5jdGlvbicpXG5cblxuICB2YXIgQWdlbnQgPSByZXF1aXJlKCcuL2FnZW50LmpzJylcbiAgLy8gcmV0dXJuO1xuXG4gIHdpbmRvdy5hbGljZSA9IEFnZW50LmFnZW50KClcbiAgYWxpY2UuaW5pdCgnYWxpY2UnKVxuXG4gIHdpbmRvdy5ib2IgPSBBZ2VudC5hZ2VudCgpXG4gIGJvYi5pbml0KCdib2InKVxuXG4gIGFsaWNlLmNvbm5lY3QoYm9iKVxuICBib2IuY29ubmVjdChhbGljZSlcblxuICAvLyByZXR1cm47XG5cbiAgdmFyIGRhdGFBcnJheSA9IGFsaWNlLmdldEJ1ZmZlcigpXG4gIHZhciBidWZmZXJMZW5ndGggPSBkYXRhQXJyYXkubGVuZ3RoXG5cbiAgdmFyIFdJRFRIID0gMTAyNFxuICB2YXIgSEVJR0hUID0gMjU2XG5cbiAgLy8gd2luZG93LmQgPSBkYXRhQXJyYXlcbiAgd2luZG93LmRyYXcgPSBkcmF3XG5cbiAgdmFyIGJhcldpZHRoID0gKFdJRFRIIC8gYnVmZmVyTGVuZ3RoKTtcblxuICB2YXIgYmFySGVpZ2h0XG4gIHZhciB4ID0gMFxuICB2YXIgbW9kID0gMC4wXG4gIHZhciBjb3VudGVyID0gMFxuICB2YXIgaVxuXG4gIHdpbmRvdy5ieXRlX3RvX2NvZGUgPSAxXG5cbiAgLy8gY3JlYXRlIHN2Z1xuICB2YXIgc3ZnID0gZDMuc2VsZWN0KCdkaXYjY29udGFpbmVyJykuYXBwZW5kKCdzdmcnKVxuICAgIC5hdHRyKCd3aWR0aCcsV0lEVEgpXG4gICAgLmF0dHIoJ2hlaWdodCcsIEhFSUdIVClcblxuICB2YXIgYmFycyA9IFtdXG4gIGZvcih2YXIgc3ZnYmFycyA9IDA7IHN2Z2JhcnMgPCBidWZmZXJMZW5ndGg7IHN2Z2JhcnMrKyl7XG4gICAgdmFyIGJhciA9IHN2Zy5hcHBlbmQoJ3JlY3QnKVxuICAgICAgLmF0dHIoJ3gnLCBiYXJXaWR0aCAqIHN2Z2JhcnMpXG4gICAgICAuYXR0cigneScsIDApXG4gICAgICAuYXR0cignd2lkdGgnLCBiYXJXaWR0aClcbiAgICAgIC5hdHRyKCdoZWlnaHQnLCAwKVxuXG4gICAgbGV0IGJhcl9pZHggPSBzdmdiYXJzXG4gICAgYmFyLm9uKCdtb3VzZW92ZXInLCBmdW5jdGlvbigpe1xuICAgICAgY29uc29sZS5sb2coYmFyX2lkeClcbiAgICB9KVxuXG4gICAgYmFycy5wdXNoKGJhcilcbiAgfVxuXG4gIHZhciBwcmV2X3JhbmdlcyA9IFtdXG5cbiAgZnVuY3Rpb24gZHJhdygpIHtcblxuICAgIGNvdW50ZXIrK1xuICAgIGlmKGNvdW50ZXIgJSAxMCA9PT0gMSl7XG5cbiAgICAgIGNvbnNvbGUuY2xlYXIoKVxuICAgICAgY29uc29sZS5sb2coRGF0ZS5ub3coKSlcblxuICAgICAgYWxpY2UuZ2V0QnVmZmVyKClcbiAgICAgIGZvcihpPTA7aTxidWZmZXJMZW5ndGg7aSsrKXtcbiAgICAgICAgYmFyc1tpXS5hdHRyKCdoZWlnaHQnLCBkYXRhQXJyYXlbaV0pXG4gICAgICB9XG5cbiAgICAgIGNvbnNvbGUubG9nKCdoZXJlJylcblxuICAgICAgLy8gZG9lcyB0aGUgZW5jb2RlZCBieXRlIG1hdGNoP1xuICAgICAgdmFyIGN1cnJlbnRfc2lnbmFsX2J5dGUgPSBhbGljZS5yZWFkX2J5dGVfZnJvbV9zaWduYWwoKVxuICAgICAgY29uc29sZS5sb2coJ2N1cnJlbnQgc2lnbmFsIGJ5dGUgJyArIGN1cnJlbnRfc2lnbmFsX2J5dGUpXG5cbiAgICAgIC8vIHJldHVybiB0cnVlO1xuXG4gICAgICAvLyBpZihjdXJyZW50X3NpZ25hbF9ieXRlID09PSB3aW5kb3cuYnl0ZV90b19jb2RlKXtcbiAgICAgIC8vICAgd2luZG93LmJ5dGVfdG9fY29kZSArPSAxXG4gICAgICAvLyAgIGNvbnNvbGUubG9nKHdpbmRvdy5ieXRlX3RvX2NvZGUpXG4gICAgICAvLyAgIHdpbmRvdy5ieXRlX3RvX2NvZGUgPSB3aW5kb3cuYnl0ZV90b19jb2RlICUgMjU1XG4gICAgICAvLyB9IGVsc2Uge1xuICAgICAgLy8gICBjb25zb2xlLmxvZygndG9vIHNsb3chJylcbiAgICAgIC8vIH1cblxuXG4gICAgICAvLyB2YXIgcmFuZ2VzID0gYWxpY2UudmFsaWRhdGVfcmFuZ2VzKClcbiAgICAgIC8vIHZhciB0ZXN0X2J5dGUgPSBhbGljZS5nZXRfZW5jb2RlZF9ieXRlX2FycmF5KHdpbmRvdy5ieXRlX3RvX2NvZGUpXG4gICAgICAvL1xuICAgICAgLy8gdmFyIG5vX21pc3NlcyA9IHRydWVcbiAgICAgIC8vIGZvcih2YXIgaSA9IDA7IGkgPCA4OyBpKyspe1xuICAgICAgLy8gICBpZigocmFuZ2VzW2ldID09PSB0cnVlICYmIHRlc3RfYnl0ZVtpXSA9PT0gJzEnKSB8fFxuICAgICAgLy8gICAgIChyYW5nZXNbaV0gPT09IGZhbHNlICYmIHRlc3RfYnl0ZVtpXSA9PT0gJzAnKSl7XG4gICAgICAvLyAgICAgICAvLyBkbyBub3RoaW5nXG4gICAgICAvLyAgICAgfSBlbHNlIHtcbiAgICAgIC8vICAgICAgIG5vX21pc3NlcyA9IGZhbHNlXG4gICAgICAvLyAgICAgICBjb25zb2xlLmxvZygnbWlzcycpXG4gICAgICAvLyAgICAgfVxuICAgICAgLy9cbiAgICAgIC8vXG4gICAgICAvLyB9XG4gICAgICAvL1xuICAgICAgLy8gaWYobm9fbWlzc2VzKXtcbiAgICAgIC8vIH1cblxuXG4gICAgICAvLyBjb25zb2xlLmxvZygnZW5jb2RpbmcgJyArIHdpbmRvdy5ieXRlX3RvX2NvZGUpXG4gICAgICAvLyBib2IuZW5jb2RlX3JhbmdlKHdpbmRvdy5ieXRlX3RvX2NvZGUpXG5cblxuICAgICAgLy8gY29uc29sZS5sb2cocmFuZ2VzKVxuICAgICAgLy8gaWYocmFuZ2VzW2NoYW5uZWxfdG9fY2hlY2tdID09PSBmYWxzZSl7XG4gICAgICAvLyAgIGNoYW5uZWxfdG9fY2hlY2sgKz0gMVxuICAgICAgLy8gICBjaGFubmVsX3RvX2NoZWNrID0gY2hhbm5lbF90b19jaGVjayAlIGFsaWNlLm5fY2hhbm5lbHMoKVxuICAgICAgLy8gfVxuICAgICAgLy9cbiAgICAgIC8vIGZvcih2YXIgaSA9IDA7IGkgPCBhbGljZS5uX2NoYW5uZWxzKCk7IGkrKyl7XG4gICAgICAvLyAgIGlmKGkgPT09IGNoYW5uZWxfdG9fY2hlY2spe1xuICAgICAgLy8gICAgIC8vIGNvbnNvbGUubG9nKCdoZXJlJytpKVxuICAgICAgLy8gICAgIGFsaWNlLnNldF9nYWluKGksMC4wKVxuICAgICAgLy8gICB9IGVsc2Uge1xuICAgICAgLy8gICAgIGFsaWNlLnNldF9nYWluKGksMS4wL2FsaWNlLm5fY2hhbm5lbHMoKSlcbiAgICAgIC8vICAgfVxuICAgICAgLy8gfVxuICAgICAgLy9cbiAgICAgIC8vIHZhciBhbGxfbWF0Y2hlZCA9IHRydWVcbiAgICAgIC8vIHJhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKHYsaSl7XG4gICAgICAvLyAgIGlmKHYgIT09IHByZXZfcmFuZ2VzW2ldKXtcbiAgICAgIC8vICAgICBhbGxfbWF0Y2hlZCA9IGZhbHNlXG4gICAgICAvLyAgIH1cbiAgICAgIC8vIH0pXG4gICAgICAvLyBpZihhbGxfbWF0Y2hlZCl7XG4gICAgICAvLyAgIGNvbnNvbGUubG9nKCdNSVNTJylcbiAgICAgIC8vIH1cbiAgICAgIC8vXG4gICAgICAvLyBwcmV2X3JhbmdlcyA9IHJhbmdlc1xuXG4gICAgfVxuXG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShkcmF3KTtcblxuICB9XG5cbiAgc2V0VGltZW91dChkcmF3LDUwMClcbiAgLy8gZHJhdygpXG5cblxufVxuIl19
