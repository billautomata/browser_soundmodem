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

  var prev_high_channel = -1
  var current_high_channel = 0
  var fresh_data = false

  var osc_bank = []
  var gain_bank = []

  var n_osc = 10
  var freqRange = 20000
  var spread = (freqRange / n_osc)
  var initialFreq = 200


  function poll(){

    var valid_ranges = validate_ranges()
    // console.log(valid_ranges)

    if(valid_ranges[8] === true && valid_ranges[9] === false){
      // console.log('here')
      current_high_channel = 8
    } else {
      current_high_channel = 9
    }

    // console.log(current_high_channel, prev_high_channel)

    if(current_high_channel !== prev_high_channel){
      fresh_data = true
    }

    prev_high_channel = current_high_channel

    return fresh_data

  }

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

  function connect(other_agent, callback){

    var other_gain_bank = other_agent.get_gain_bank()

    other_gain_bank.forEach(function(gainNode){
      gainNode.connect(analyser)
    })

    getBuffer()

    setTimeout(function(){
      register_peak_ranges()
      callback()
    },100)

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

    console.log('registering peak ranges')

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

    var binary_string = ''
    for(var i = 0; i < 8; i++){
      if(ranges[i]){
        binary_string += '1'
      } else {
        binary_string += '0'
      }
    }

    fresh_data = false

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
    read_byte_from_signal: read_byte_from_signal,
    poll: poll

  }

  return k

}

},{}],2:[function(require,module,exports){
window.onload = function () {
  "use strict";

  var udp_mode = true

  console.log('main.js / window.onload anonymous function')

  var message_to_send = 'this is a test that the modulation / demodulation works correctly '
  var message_idx = 0

  var output_msg = ''

  var Agent = require('./agent.js')

  window.alice = Agent.agent()
  alice.init('alice')

  window.bob = Agent.agent()
  bob.init('bob')

  var dataArray = alice.getBuffer()
  var bufferLength = dataArray.length

  var WIDTH = 1024
  var HEIGHT = 256

  var barWidth = (WIDTH / bufferLength);

  var barHeight
  var x = 0
  var mod = 0.0
  var counter = 0
  var i

  window.byte_to_code = 0

  // create svg
  var svg = d3.select('div#container').append('svg')
    .attr('width',WIDTH)
    .attr('height', HEIGHT)
    .style('background-color', 'rgba(0,0,0,0.1)')

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

  alice.connect(bob, function(){
    bob.connect(alice, start)
  })

  function start(){
    alice.encode_range(22)
    draw()
  }

  function draw() {

    counter++
    if(counter % 3 === 0){

      // console.clear()
      // console.log(Date.now())

      alice.getBuffer()
      for(i=0;i<bufferLength;i++){
        bars[i].attr('height', dataArray[i])
      }

      if(bob.poll() || udp_mode){

        bob.read_byte_from_signal()
        window.byte_to_code = message_to_send[message_idx].charCodeAt(0)
        bob.encode_range(window.byte_to_code)
        message_idx += 1
        message_idx = message_idx % message_to_send.length

      } else {
        // console.log('bob miss')
      }

      if(alice.poll()){

        var alice_reads = alice.read_byte_from_signal()

        output_msg += String.fromCharCode(alice_reads)

        d3.select('div.output_msg').html(output_msg)

        alice.encode_range(2)

      } else {
        // console.log('alice miss')
      }

    }

    window.requestAnimationFrame(draw);

  }



}

},{"./agent.js":1}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzLmFnZW50ID0gYWdlbnRcblxuXG5mdW5jdGlvbiBhZ2VudCgpe1xuXG4gIC8vIGNoZWNrIGZvciBnbG9iYWwgYXVkaW8gY3R4XG4gIC8vIHZhciBjb250ZXh0XG5cbiAgaWYod2luZG93LmNvbnRleHQgPT09IHVuZGVmaW5lZCl7XG4gICAgY29uc29sZS5sb2coJ2NyZWF0aW5nIG5ldyB3aW5kb3cuQXVkaW9Db250ZXh0KCknKVxuICAgIHdpbmRvdy5jb250ZXh0ID0gbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKVxuICAgIC8vIHZhciBjb250ZXh0ID0gbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKVxuICB9IGVsc2Uge1xuICAgIC8vIGNvbnRleHQgPSB3aW5kb3cuY29udGV4dFxuICB9XG5cbiAgdmFyIGFuYWx5c2VyID0gY29udGV4dC5jcmVhdGVBbmFseXNlcigpXG4gIC8vIHZhciBsb2NhbF9hbmFseXNlciA9IHdpbmRvdy5jb250ZXh0LmNyZWF0ZUFuYWx5c2VyKClcbiAgdmFyIGFuYWx5c2VyRGF0YUFycmF5XG4gIHZhciBidWZmZXJMZW5ndGhcblxuICB2YXIgcGVha19yYW5nZXNcbiAgdmFyIG1lYW5cbiAgdmFyIGdyb3VwZWRfcGVha19yYW5nZXNcblxuICB2YXIgZmxpcF9mbG9wID0gdHJ1ZVxuXG4gIHZhciBwcmV2X2hpZ2hfY2hhbm5lbCA9IC0xXG4gIHZhciBjdXJyZW50X2hpZ2hfY2hhbm5lbCA9IDBcbiAgdmFyIGZyZXNoX2RhdGEgPSBmYWxzZVxuXG4gIHZhciBvc2NfYmFuayA9IFtdXG4gIHZhciBnYWluX2JhbmsgPSBbXVxuXG4gIHZhciBuX29zYyA9IDEwXG4gIHZhciBmcmVxUmFuZ2UgPSAyMDAwMFxuICB2YXIgc3ByZWFkID0gKGZyZXFSYW5nZSAvIG5fb3NjKVxuICB2YXIgaW5pdGlhbEZyZXEgPSAyMDBcblxuXG4gIGZ1bmN0aW9uIHBvbGwoKXtcblxuICAgIHZhciB2YWxpZF9yYW5nZXMgPSB2YWxpZGF0ZV9yYW5nZXMoKVxuICAgIC8vIGNvbnNvbGUubG9nKHZhbGlkX3JhbmdlcylcblxuICAgIGlmKHZhbGlkX3Jhbmdlc1s4XSA9PT0gdHJ1ZSAmJiB2YWxpZF9yYW5nZXNbOV0gPT09IGZhbHNlKXtcbiAgICAgIC8vIGNvbnNvbGUubG9nKCdoZXJlJylcbiAgICAgIGN1cnJlbnRfaGlnaF9jaGFubmVsID0gOFxuICAgIH0gZWxzZSB7XG4gICAgICBjdXJyZW50X2hpZ2hfY2hhbm5lbCA9IDlcbiAgICB9XG5cbiAgICAvLyBjb25zb2xlLmxvZyhjdXJyZW50X2hpZ2hfY2hhbm5lbCwgcHJldl9oaWdoX2NoYW5uZWwpXG5cbiAgICBpZihjdXJyZW50X2hpZ2hfY2hhbm5lbCAhPT0gcHJldl9oaWdoX2NoYW5uZWwpe1xuICAgICAgZnJlc2hfZGF0YSA9IHRydWVcbiAgICB9XG5cbiAgICBwcmV2X2hpZ2hfY2hhbm5lbCA9IGN1cnJlbnRfaGlnaF9jaGFubmVsXG5cbiAgICByZXR1cm4gZnJlc2hfZGF0YVxuXG4gIH1cblxuICBmdW5jdGlvbiBpbml0KG5hbWUpe1xuXG4gICAgLy8gY3JlYXRlIG9zYyArIGdhaW4gYmFua3NcbiAgICBmb3IodmFyIGlkeCA9IDA7IGlkeCA8IG5fb3NjOyBpZHgrKyl7XG5cbiAgICAgIGxldCBsb2NhbF9vc2MgPSBjb250ZXh0LmNyZWF0ZU9zY2lsbGF0b3IoKVxuICAgICAgbG9jYWxfb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IChpZHggKiBzcHJlYWQpICsgaW5pdGlhbEZyZXFcblxuICAgICAgbGV0IGxvY2FsX2dhaW4gPSBjb250ZXh0LmNyZWF0ZUdhaW4oKVxuICAgICAgbG9jYWxfZ2Fpbi5nYWluLnZhbHVlID0gMS4wIC8gKG5fb3NjKVxuXG4gICAgICBsb2NhbF9vc2MuY29ubmVjdChsb2NhbF9nYWluKVxuXG4gICAgICAvLyBsb2NhbF9nYWluLmNvbm5lY3QoYW5hbHlzZXIpXG4gICAgICAvLyBsb2NhbF9nYWluLmNvbm5lY3QoY29udGV4dC5kZXN0aW5hdGlvbilcblxuICAgICAgbG9jYWxfb3NjLnN0YXJ0KClcblxuICAgICAgb3NjX2JhbmsucHVzaChsb2NhbF9vc2MpXG4gICAgICBnYWluX2JhbmsucHVzaChsb2NhbF9nYWluKVxuXG4gICAgfVxuXG4gICAgYW5hbHlzZXIubmFtZSA9IG5hbWVcbiAgICBhbmFseXNlci5mZnRTaXplID0gMTAyNFxuICAgIGFuYWx5c2VyLnNtb290aGluZ1RpbWVDb25zdGFudCA9IDBcbiAgICBidWZmZXJMZW5ndGggPSBhbmFseXNlci5mcmVxdWVuY3lCaW5Db3VudFxuICAgIGFuYWx5c2VyRGF0YUFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyTGVuZ3RoKVxuXG4gIH1cblxuICBmdW5jdGlvbiBjb25uZWN0KG90aGVyX2FnZW50LCBjYWxsYmFjayl7XG5cbiAgICB2YXIgb3RoZXJfZ2Fpbl9iYW5rID0gb3RoZXJfYWdlbnQuZ2V0X2dhaW5fYmFuaygpXG5cbiAgICBvdGhlcl9nYWluX2JhbmsuZm9yRWFjaChmdW5jdGlvbihnYWluTm9kZSl7XG4gICAgICBnYWluTm9kZS5jb25uZWN0KGFuYWx5c2VyKVxuICAgIH0pXG5cbiAgICBnZXRCdWZmZXIoKVxuXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVnaXN0ZXJfcGVha19yYW5nZXMoKVxuICAgICAgY2FsbGJhY2soKVxuICAgIH0sMTAwKVxuXG4gIH1cblxuXG4gIGZ1bmN0aW9uIG5fY2hhbm5lbHMoKXtcbiAgICByZXR1cm4gbl9vc2NcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9ncm91cHMoKXtcbiAgICByZXR1cm4gZ3JvdXBlZF9wZWFrX3Jhbmdlc1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0QnVmZmVyKCl7XG4gICAgYW5hbHlzZXIuZ2V0Qnl0ZUZyZXF1ZW5jeURhdGEoYW5hbHlzZXJEYXRhQXJyYXkpXG4gICAgcmV0dXJuIGFuYWx5c2VyRGF0YUFycmF5XG4gIH1cblxuICBmdW5jdGlvbiBnZXRfZ2Fpbl9iYW5rKCl7XG4gICAgcmV0dXJuIGdhaW5fYmFua1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2FuYWx5c2VyKCl7XG4gICAgcmV0dXJuIGFuYWx5c2VyXG4gIH1cblxuICBmdW5jdGlvbiByZWdpc3Rlcl9wZWFrX3Jhbmdlcygpe1xuXG4gICAgY29uc29sZS5sb2coJ3JlZ2lzdGVyaW5nIHBlYWsgcmFuZ2VzJylcblxuICAgIGdldEJ1ZmZlcigpXG4gICAgY29uc29sZS5sb2coYW5hbHlzZXJEYXRhQXJyYXkpXG5cbiAgICAvLyBwdXNoIG9uIHRvIG5ldyBhcnJheSBmb3Igc29ydGluZ1xuICAgIHZhciBkID0gW11cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgYnVmZmVyTGVuZ3RoOyBpKyspe1xuICAgICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbaV0gPiAwKXtcbiAgICAgICAgZC5wdXNoKGFuYWx5c2VyRGF0YUFycmF5W2ldKVxuICAgICAgfVxuICAgIH1cbiAgICBkLnNvcnQoZnVuY3Rpb24oYSxiKXtcbiAgICAgIHJldHVybiBhLWJcbiAgICB9KVxuICAgIGNvbnNvbGUubG9nKCdNZWFuOiAnK2RbTWF0aC5mbG9vcihkLmxlbmd0aC8yKV0pXG5cbiAgICBtZWFuID0gZFtNYXRoLmZsb29yKGQubGVuZ3RoLzIpXVxuXG4gICAgLy9cbiAgICBwZWFrX3JhbmdlcyA9IFtdXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKXtcbiAgICAgIGlmKGFuYWx5c2VyRGF0YUFycmF5W2ldID4gbWVhbil7XG4gICAgICAgIHBlYWtfcmFuZ2VzLnB1c2goaSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB3aW5kb3cucCA9IHBlYWtfcmFuZ2VzXG5cbiAgICBncm91cF9wZWFrX3JhbmdlcygpXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNoZWNrX3BlYWtfcmFuZ2VzKCl7XG5cbiAgICBnZXRCdWZmZXIoKVxuXG4gICAgdmFyIGhpdHMgPSBbXVxuICAgIHBlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24oZGF0YUFycmF5X2lkeCl7XG4gICAgICBpZihhbmFseXNlckRhdGFBcnJheVtkYXRhQXJyYXlfaWR4XSA+IG1lYW4pe1xuICAgICAgICBoaXRzLnB1c2godHJ1ZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGhpdHMucHVzaChmYWxzZSlcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIGhpdHNcblxuICB9XG5cbiAgZnVuY3Rpb24gZ3JvdXBfcGVha19yYW5nZXMoKXtcblxuICAgIGlmKHBlYWtfcmFuZ2VzID09PSB1bmRlZmluZWQgfHwgcGVha19yYW5nZXMubGVuZ3RoID09PSAwKXtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZ3JvdXBzID0gW10gLy8gWyBbMSwyLDNdLCBbOCw5LDEwXSwgWzMwLDMxLDMyXSAgXVxuXG4gICAgdmFyIGN1cnJlbnRfZ3JvdXBfaWR4ID0gMFxuXG4gICAgdmFyIGxvY2FsX2dyb3VwID0gbmV3IEFycmF5KClcblxuICAgIHBlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24ocGVha19pZHgsIGlkeCl7XG5cbiAgICAgIC8vIGlmIHRoZSBNYXRoLmFicyhwZWFrX2lkeCAtIHBlYWtfcmFuZ2VzW2lkeCsxXSkgPT09IDFcbiAgICAgIC8vICAgIHB1c2ggcGVha19pZHggb24gdG8gbG9jYWxfZ3JvdXBcbiAgICAgIC8vIGVsc2VcbiAgICAgIC8vICAgIHB1c2ggbG9jYWxfZ3JvdXAgb24gdG8gZ3JvdXBzXG4gICAgICAvLyAgICBjbGVhciBsb2NhbF9ncm91cFxuICAgICAgLy8gICAgcHVzaCBwZWFrX2lkeCBvbiB0byBsb2NhbF9ncm91cFxuXG4gICAgICBpZihpZHggPT09IHBlYWtfcmFuZ2VzLmxlbmd0aC0xKXtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ2hlcmUnKVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmKE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4KzFdKSA8PSAyKXtcbiAgICAgICAgbG9jYWxfZ3JvdXAucHVzaChwZWFrX2lkeClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgICAgIGdyb3Vwcy5wdXNoKGxvY2FsX2dyb3VwKVxuICAgICAgICBsb2NhbF9ncm91cCA9IG5ldyBBcnJheSgpXG4gICAgICB9XG5cbiAgICB9KVxuXG4gICAgZ3JvdXBzLnB1c2gobG9jYWxfZ3JvdXApXG5cbiAgICBncm91cGVkX3BlYWtfcmFuZ2VzID0gZ3JvdXBzXG5cbiAgICByZXR1cm4gZ3JvdXBzXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9nYWluKGNoYW5uZWwsIHZhbHVlKXtcbiAgICAvLyBjaGFubmVsID0gKG5fb3NjLTEpIC0gY2hhbm5lbFxuICAgIGdhaW5fYmFua1tjaGFubmVsXS5nYWluLnZhbHVlID0gdmFsdWVcbiAgfVxuXG4gIGZ1bmN0aW9uIHZhbGlkYXRlX3Jhbmdlcygpe1xuXG4gICAgaWYoZ3JvdXBlZF9wZWFrX3JhbmdlcyA9PT0gdW5kZWZpbmVkKXtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBnZXRCdWZmZXIoKVxuXG4gICAgdmFyIHZhbGlkX2dyb3VwcyA9IFtdXG5cbiAgICBncm91cGVkX3BlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24oZ3JvdXApe1xuXG4gICAgICAvLyBmb3IgZWFjaCBlbnRyeSBpbiB0aGUgZ3JvdXBcbiAgICAgIHZhciBoaXRzID0gMFxuXG4gICAgICBncm91cC5mb3JFYWNoKGZ1bmN0aW9uKGlkeCl7XG4gICAgICAgIGlmKGFuYWx5c2VyRGF0YUFycmF5W2lkeF0gPj0gbWVhbil7XG4gICAgICAgICAgaGl0cyArPSAxXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKGhpdHMpXG5cbiAgICAgIGlmKGhpdHMgPj0gZ3JvdXAubGVuZ3RoLzIpe1xuICAgICAgICB2YWxpZF9ncm91cHMucHVzaCh0cnVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsaWRfZ3JvdXBzLnB1c2goZmFsc2UpXG4gICAgICB9XG5cbiAgICB9KVxuXG4gICAgcmV0dXJuIHZhbGlkX2dyb3Vwc1xuXG4gIH1cblxuICBmdW5jdGlvbiBlbmNvZGVfYnl0ZShieXRlKXtcblxuICAgIHZhciBjaGFycyA9IGdldF9lbmNvZGVkX2J5dGVfYXJyYXkoYnl0ZSlcblxuICAgIC8vIGNvbnNvbGUubG9nKGNoYXJzKVxuXG4gICAgY2hhcnMuZm9yRWFjaChmdW5jdGlvbihjLGlkeCl7XG4gICAgICBpZihjID09PSAnMCcpe1xuICAgICAgICBzZXRfZ2FpbihpZHgsMClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldF9nYWluKGlkeCwxL25fb3NjKVxuICAgICAgfVxuICAgIH0pXG5cbiAgICBmbGlwX2Zsb3AgPSAhZmxpcF9mbG9wXG4gICAgaWYoZmxpcF9mbG9wKXtcbiAgICAgIHNldF9nYWluKDgsMS9uX29zYylcbiAgICAgIHNldF9nYWluKDksMClcbiAgICB9IGVsc2Uge1xuICAgICAgc2V0X2dhaW4oOSwxL25fb3NjKVxuICAgICAgc2V0X2dhaW4oOCwwKVxuICAgIH1cblxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2VuY29kZWRfYnl0ZV9hcnJheShieXRlKXtcbiAgICByZXR1cm4gcGFkKGJ5dGUudG9TdHJpbmcoMiksOCkuc3BsaXQoJycpXG4gIH1cblxuICBmdW5jdGlvbiByZWFkX2J5dGVfZnJvbV9zaWduYWwoKXtcblxuICAgIHZhciByYW5nZXMgPSB2YWxpZGF0ZV9yYW5nZXMoKVxuXG4gICAgdmFyIGJpbmFyeV9zdHJpbmcgPSAnJ1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCA4OyBpKyspe1xuICAgICAgaWYocmFuZ2VzW2ldKXtcbiAgICAgICAgYmluYXJ5X3N0cmluZyArPSAnMSdcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJpbmFyeV9zdHJpbmcgKz0gJzAnXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnJlc2hfZGF0YSA9IGZhbHNlXG5cbiAgICByZXR1cm4gcGFyc2VJbnQoYmluYXJ5X3N0cmluZywyKVxuXG4gIH1cblxuXG4gIGZ1bmN0aW9uIHBhZChuLCB3aWR0aCwgeikge1xuICAgIHogPSB6IHx8ICcwJztcbiAgICBuID0gbiArICcnO1xuICAgIHJldHVybiBuLmxlbmd0aCA+PSB3aWR0aCA/IG4gOiBuZXcgQXJyYXkod2lkdGggLSBuLmxlbmd0aCArIDEpLmpvaW4oeikgKyBuO1xuICB9XG5cblxuICB2YXIgayA9IHtcbiAgICBpbml0OiBpbml0LFxuICAgIGNvbm5lY3Q6IGNvbm5lY3QsXG4gICAgZ2V0X2dhaW5fYmFuazogZ2V0X2dhaW5fYmFuayxcbiAgICBnZXRfYW5hbHlzZXI6IGdldF9hbmFseXNlcixcbiAgICBnZXRCdWZmZXI6IGdldEJ1ZmZlcixcbiAgICBjaGVja19wZWFrX3JhbmdlczogY2hlY2tfcGVha19yYW5nZXMsXG4gICAgZ3JvdXBfcGVha19yYW5nZXM6IGdyb3VwX3BlYWtfcmFuZ2VzLFxuICAgIHNldF9nYWluOiBzZXRfZ2FpbixcbiAgICB2YWxpZGF0ZV9yYW5nZXM6IHZhbGlkYXRlX3JhbmdlcyxcbiAgICBuX2NoYW5uZWxzOiBuX2NoYW5uZWxzLFxuICAgIGdldF9ncm91cHM6IGdldF9ncm91cHMsXG4gICAgZW5jb2RlX3JhbmdlOiBlbmNvZGVfYnl0ZSxcbiAgICBnZXRfZW5jb2RlZF9ieXRlX2FycmF5OiBnZXRfZW5jb2RlZF9ieXRlX2FycmF5LFxuICAgIHJlYWRfYnl0ZV9mcm9tX3NpZ25hbDogcmVhZF9ieXRlX2Zyb21fc2lnbmFsLFxuICAgIHBvbGw6IHBvbGxcblxuICB9XG5cbiAgcmV0dXJuIGtcblxufVxuIiwid2luZG93Lm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgdmFyIHVkcF9tb2RlID0gdHJ1ZVxuXG4gIGNvbnNvbGUubG9nKCdtYWluLmpzIC8gd2luZG93Lm9ubG9hZCBhbm9ueW1vdXMgZnVuY3Rpb24nKVxuXG4gIHZhciBtZXNzYWdlX3RvX3NlbmQgPSAndGhpcyBpcyBhIHRlc3QgdGhhdCB0aGUgbW9kdWxhdGlvbiAvIGRlbW9kdWxhdGlvbiB3b3JrcyBjb3JyZWN0bHkgJ1xuICB2YXIgbWVzc2FnZV9pZHggPSAwXG5cbiAgdmFyIG91dHB1dF9tc2cgPSAnJ1xuXG4gIHZhciBBZ2VudCA9IHJlcXVpcmUoJy4vYWdlbnQuanMnKVxuXG4gIHdpbmRvdy5hbGljZSA9IEFnZW50LmFnZW50KClcbiAgYWxpY2UuaW5pdCgnYWxpY2UnKVxuXG4gIHdpbmRvdy5ib2IgPSBBZ2VudC5hZ2VudCgpXG4gIGJvYi5pbml0KCdib2InKVxuXG4gIHZhciBkYXRhQXJyYXkgPSBhbGljZS5nZXRCdWZmZXIoKVxuICB2YXIgYnVmZmVyTGVuZ3RoID0gZGF0YUFycmF5Lmxlbmd0aFxuXG4gIHZhciBXSURUSCA9IDEwMjRcbiAgdmFyIEhFSUdIVCA9IDI1NlxuXG4gIHZhciBiYXJXaWR0aCA9IChXSURUSCAvIGJ1ZmZlckxlbmd0aCk7XG5cbiAgdmFyIGJhckhlaWdodFxuICB2YXIgeCA9IDBcbiAgdmFyIG1vZCA9IDAuMFxuICB2YXIgY291bnRlciA9IDBcbiAgdmFyIGlcblxuICB3aW5kb3cuYnl0ZV90b19jb2RlID0gMFxuXG4gIC8vIGNyZWF0ZSBzdmdcbiAgdmFyIHN2ZyA9IGQzLnNlbGVjdCgnZGl2I2NvbnRhaW5lcicpLmFwcGVuZCgnc3ZnJylcbiAgICAuYXR0cignd2lkdGgnLFdJRFRIKVxuICAgIC5hdHRyKCdoZWlnaHQnLCBIRUlHSFQpXG4gICAgLnN0eWxlKCdiYWNrZ3JvdW5kLWNvbG9yJywgJ3JnYmEoMCwwLDAsMC4xKScpXG5cbiAgdmFyIGJhcnMgPSBbXVxuICBmb3IodmFyIHN2Z2JhcnMgPSAwOyBzdmdiYXJzIDwgYnVmZmVyTGVuZ3RoOyBzdmdiYXJzKyspe1xuICAgIHZhciBiYXIgPSBzdmcuYXBwZW5kKCdyZWN0JylcbiAgICAgIC5hdHRyKCd4JywgYmFyV2lkdGggKiBzdmdiYXJzKVxuICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgLmF0dHIoJ3dpZHRoJywgYmFyV2lkdGgpXG4gICAgICAuYXR0cignaGVpZ2h0JywgMClcblxuICAgIGxldCBiYXJfaWR4ID0gc3ZnYmFyc1xuICAgIGJhci5vbignbW91c2VvdmVyJywgZnVuY3Rpb24oKXtcbiAgICAgIGNvbnNvbGUubG9nKGJhcl9pZHgpXG4gICAgfSlcblxuICAgIGJhcnMucHVzaChiYXIpXG4gIH1cblxuICB2YXIgcHJldl9yYW5nZXMgPSBbXVxuXG4gIGFsaWNlLmNvbm5lY3QoYm9iLCBmdW5jdGlvbigpe1xuICAgIGJvYi5jb25uZWN0KGFsaWNlLCBzdGFydClcbiAgfSlcblxuICBmdW5jdGlvbiBzdGFydCgpe1xuICAgIGFsaWNlLmVuY29kZV9yYW5nZSgyMilcbiAgICBkcmF3KClcbiAgfVxuXG4gIGZ1bmN0aW9uIGRyYXcoKSB7XG5cbiAgICBjb3VudGVyKytcbiAgICBpZihjb3VudGVyICUgMyA9PT0gMCl7XG5cbiAgICAgIC8vIGNvbnNvbGUuY2xlYXIoKVxuICAgICAgLy8gY29uc29sZS5sb2coRGF0ZS5ub3coKSlcblxuICAgICAgYWxpY2UuZ2V0QnVmZmVyKClcbiAgICAgIGZvcihpPTA7aTxidWZmZXJMZW5ndGg7aSsrKXtcbiAgICAgICAgYmFyc1tpXS5hdHRyKCdoZWlnaHQnLCBkYXRhQXJyYXlbaV0pXG4gICAgICB9XG5cbiAgICAgIGlmKGJvYi5wb2xsKCkgfHwgdWRwX21vZGUpe1xuXG4gICAgICAgIGJvYi5yZWFkX2J5dGVfZnJvbV9zaWduYWwoKVxuICAgICAgICB3aW5kb3cuYnl0ZV90b19jb2RlID0gbWVzc2FnZV90b19zZW5kW21lc3NhZ2VfaWR4XS5jaGFyQ29kZUF0KDApXG4gICAgICAgIGJvYi5lbmNvZGVfcmFuZ2Uod2luZG93LmJ5dGVfdG9fY29kZSlcbiAgICAgICAgbWVzc2FnZV9pZHggKz0gMVxuICAgICAgICBtZXNzYWdlX2lkeCA9IG1lc3NhZ2VfaWR4ICUgbWVzc2FnZV90b19zZW5kLmxlbmd0aFxuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjb25zb2xlLmxvZygnYm9iIG1pc3MnKVxuICAgICAgfVxuXG4gICAgICBpZihhbGljZS5wb2xsKCkpe1xuXG4gICAgICAgIHZhciBhbGljZV9yZWFkcyA9IGFsaWNlLnJlYWRfYnl0ZV9mcm9tX3NpZ25hbCgpXG5cbiAgICAgICAgb3V0cHV0X21zZyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGFsaWNlX3JlYWRzKVxuXG4gICAgICAgIGQzLnNlbGVjdCgnZGl2Lm91dHB1dF9tc2cnKS5odG1sKG91dHB1dF9tc2cpXG5cbiAgICAgICAgYWxpY2UuZW5jb2RlX3JhbmdlKDIpXG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdhbGljZSBtaXNzJylcbiAgICAgIH1cblxuICAgIH1cblxuICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZHJhdyk7XG5cbiAgfVxuXG5cblxufVxuIl19
