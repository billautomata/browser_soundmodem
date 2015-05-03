(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

module.exports.agent = agent


function agent(opts){

  (function setup_audio_context(){
    if(window.context === undefined){
      console.log('creating new window.AudioContext()')
      window.context = new window.AudioContext()
    }
    console.log('done.')
  })()

  var MESSAGE
  var MESSAGE_IDX = 0

  var type

  var analyser = context.createAnalyser()
  var analyserDataArray   // the buffer the analyser writes to
  var bufferLength        // the length of the analyserDataArray

  var peak_ranges           // flat list of indexes of detected peak ranges
  var grouped_peak_ranges   // clustered groups of peak ranges
  var mean                  // the threshold for determining if a band is peaked

  var flip_flop = true

  var prev_high_channel = -1
  var current_high_channel = 0
  var fresh_data = false
  var SYNC_COUNT = 0

  var osc_bank = []
  var gain_bank = []

  var n_osc = 10
  var freqRange = 2500
  var spread = (freqRange / n_osc)
  var initialFreq = 200

  var CURRENT_STATE = -1

  function tick(){

    // console.log('tick')
    // console.log(CURRENT_STATE.toString())

    if(CURRENT_STATE < 0){
      return;
    } else {

      if(CURRENT_STATE === 0){

        register_peak_ranges()

        if(grouped_peak_ranges.length === 10){
          CURRENT_STATE = 1
        }


      } else if(CURRENT_STATE === 1){

        perform_signaling()
        look_for_signaling()

        if(SYNC_COUNT > 5){
          CURRENT_STATE = 2
        }

      } else if(CURRENT_STATE === 2){

        if(look_for_signaling()){

          // read byte
          if(type === 'client'){
            console.log(String.fromCharCode(read_byte_from_signal()))
          }

          // increment byte to encode
          MESSAGE_IDX += 1
          MESSAGE_IDX = MESSAGE_IDX % MESSAGE.length


          perform_signaling()

        }
        // encode byte
        var byte_to_send = MESSAGE[MESSAGE_IDX].charCodeAt(0)
        encode_byte(byte_to_send)

      }

    }

  }


  function look_for_signaling(){

    var valid_ranges = validate_ranges()
    if(valid_ranges[8] === true && valid_ranges[9] === false){
      current_high_channel = 8
    } else {
      current_high_channel = 9
    }

    var difference_found = false

    if(current_high_channel !== prev_high_channel){
      difference_found = true
      SYNC_COUNT += 1
    }

    prev_high_channel = current_high_channel

    return difference_found

  }

  function init(opts){

    MESSAGE = opts.message
    type = opts.type

    // create osc + gain banks
    for(var idx = 0; idx < n_osc; idx++){

      let local_osc = context.createOscillator()
      local_osc.frequency.value = (idx * spread) + initialFreq

      let local_gain = context.createGain()
      local_gain.gain.value = 1.0 / (n_osc)

      local_osc.connect(local_gain)

      // local_gain.connect(analyser)
      local_gain.connect(context.destination)

      local_osc.start()

      osc_bank.push(local_osc)
      gain_bank.push(local_gain)

    }

    // analyser.name = name
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0
    bufferLength = analyser.frequencyBinCount
    analyserDataArray = new Uint8Array(bufferLength)



  }

  function connect(other_agent){

    var other_gain_bank = other_agent.get_gain_bank()

    other_gain_bank.forEach(function(gainNode){
      gainNode.connect(analyser)
    })

    getBuffer()

    setTimeout(function(){
      console.log('yep')
      CURRENT_STATE = 0
    },200)



    // setTimeout(function(){
    //   register_peak_ranges()
    //   callback()
    // },100)

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

  }

  function perform_signaling(){
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
    tick: tick
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
  alice.init({
    type: 'client',
    message: 'ffff'
  })

  window.bob = Agent.agent()
  bob.init({
    type: 'server',
    message: 'testing that the mod / demod works just fine '
  })

  var dataArray = alice.getBuffer()
  // var bufferLength = dataArray.length
  var bufferLength = 512

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

  alice.connect(bob)
  bob.connect(alice)


  setTimeout(draw,200)
  // function start(){
  //   alice.encode_range(22)
  //   draw()
  // }

  function draw() {

    counter++
    if(counter % 2 === 0){

      // visualize alices buffer data
      dataArray = alice.getBuffer()

      for(i=0;i<bufferLength;i++){
        bars[i].attr('height', dataArray[i])
      }

      alice.tick()
      bob.tick()


      // if(bob.poll() || udp_mode){
      //
      //   bob.read_byte_from_signal()
      //   window.byte_to_code = message_to_send[message_idx].charCodeAt(0)
      //   bob.encode_range(window.byte_to_code)
      //   message_idx += 1
      //   message_idx = message_idx % message_to_send.length
      //
      // } else {
      //   // console.log('bob miss')
      // }
      //
      // if(alice.poll()){
      //
      //   var alice_reads = alice.read_byte_from_signal()
      //
      //   output_msg += String.fromCharCode(alice_reads)
      //
      //   d3.select('div.output_msg').html(output_msg)
      //
      //   alice.encode_range(2)
      //
      // } else {
      //   // console.log('alice miss')
      // }

    }

    window.requestAnimationFrame(draw);

  }



}

},{"./agent.js":1}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2phQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzLmFnZW50ID0gYWdlbnRcblxuXG5mdW5jdGlvbiBhZ2VudChvcHRzKXtcblxuICAoZnVuY3Rpb24gc2V0dXBfYXVkaW9fY29udGV4dCgpe1xuICAgIGlmKHdpbmRvdy5jb250ZXh0ID09PSB1bmRlZmluZWQpe1xuICAgICAgY29uc29sZS5sb2coJ2NyZWF0aW5nIG5ldyB3aW5kb3cuQXVkaW9Db250ZXh0KCknKVxuICAgICAgd2luZG93LmNvbnRleHQgPSBuZXcgd2luZG93LkF1ZGlvQ29udGV4dCgpXG4gICAgfVxuICAgIGNvbnNvbGUubG9nKCdkb25lLicpXG4gIH0pKClcblxuICB2YXIgTUVTU0FHRVxuICB2YXIgTUVTU0FHRV9JRFggPSAwXG5cbiAgdmFyIHR5cGVcblxuICB2YXIgYW5hbHlzZXIgPSBjb250ZXh0LmNyZWF0ZUFuYWx5c2VyKClcbiAgdmFyIGFuYWx5c2VyRGF0YUFycmF5ICAgLy8gdGhlIGJ1ZmZlciB0aGUgYW5hbHlzZXIgd3JpdGVzIHRvXG4gIHZhciBidWZmZXJMZW5ndGggICAgICAgIC8vIHRoZSBsZW5ndGggb2YgdGhlIGFuYWx5c2VyRGF0YUFycmF5XG5cbiAgdmFyIHBlYWtfcmFuZ2VzICAgICAgICAgICAvLyBmbGF0IGxpc3Qgb2YgaW5kZXhlcyBvZiBkZXRlY3RlZCBwZWFrIHJhbmdlc1xuICB2YXIgZ3JvdXBlZF9wZWFrX3JhbmdlcyAgIC8vIGNsdXN0ZXJlZCBncm91cHMgb2YgcGVhayByYW5nZXNcbiAgdmFyIG1lYW4gICAgICAgICAgICAgICAgICAvLyB0aGUgdGhyZXNob2xkIGZvciBkZXRlcm1pbmluZyBpZiBhIGJhbmQgaXMgcGVha2VkXG5cbiAgdmFyIGZsaXBfZmxvcCA9IHRydWVcblxuICB2YXIgcHJldl9oaWdoX2NoYW5uZWwgPSAtMVxuICB2YXIgY3VycmVudF9oaWdoX2NoYW5uZWwgPSAwXG4gIHZhciBmcmVzaF9kYXRhID0gZmFsc2VcbiAgdmFyIFNZTkNfQ09VTlQgPSAwXG5cbiAgdmFyIG9zY19iYW5rID0gW11cbiAgdmFyIGdhaW5fYmFuayA9IFtdXG5cbiAgdmFyIG5fb3NjID0gMTBcbiAgdmFyIGZyZXFSYW5nZSA9IDI1MDBcbiAgdmFyIHNwcmVhZCA9IChmcmVxUmFuZ2UgLyBuX29zYylcbiAgdmFyIGluaXRpYWxGcmVxID0gMjAwXG5cbiAgdmFyIENVUlJFTlRfU1RBVEUgPSAtMVxuXG4gIGZ1bmN0aW9uIHRpY2soKXtcblxuICAgIC8vIGNvbnNvbGUubG9nKCd0aWNrJylcbiAgICAvLyBjb25zb2xlLmxvZyhDVVJSRU5UX1NUQVRFLnRvU3RyaW5nKCkpXG5cbiAgICBpZihDVVJSRU5UX1NUQVRFIDwgMCl7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIHtcblxuICAgICAgaWYoQ1VSUkVOVF9TVEFURSA9PT0gMCl7XG5cbiAgICAgICAgcmVnaXN0ZXJfcGVha19yYW5nZXMoKVxuXG4gICAgICAgIGlmKGdyb3VwZWRfcGVha19yYW5nZXMubGVuZ3RoID09PSAxMCl7XG4gICAgICAgICAgQ1VSUkVOVF9TVEFURSA9IDFcbiAgICAgICAgfVxuXG5cbiAgICAgIH0gZWxzZSBpZihDVVJSRU5UX1NUQVRFID09PSAxKXtcblxuICAgICAgICBwZXJmb3JtX3NpZ25hbGluZygpXG4gICAgICAgIGxvb2tfZm9yX3NpZ25hbGluZygpXG5cbiAgICAgICAgaWYoU1lOQ19DT1VOVCA+IDUpe1xuICAgICAgICAgIENVUlJFTlRfU1RBVEUgPSAyXG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIGlmKENVUlJFTlRfU1RBVEUgPT09IDIpe1xuXG4gICAgICAgIGlmKGxvb2tfZm9yX3NpZ25hbGluZygpKXtcblxuICAgICAgICAgIC8vIHJlYWQgYnl0ZVxuICAgICAgICAgIGlmKHR5cGUgPT09ICdjbGllbnQnKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFN0cmluZy5mcm9tQ2hhckNvZGUocmVhZF9ieXRlX2Zyb21fc2lnbmFsKCkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIGluY3JlbWVudCBieXRlIHRvIGVuY29kZVxuICAgICAgICAgIE1FU1NBR0VfSURYICs9IDFcbiAgICAgICAgICBNRVNTQUdFX0lEWCA9IE1FU1NBR0VfSURYICUgTUVTU0FHRS5sZW5ndGhcblxuXG4gICAgICAgICAgcGVyZm9ybV9zaWduYWxpbmcoKVxuXG4gICAgICAgIH1cbiAgICAgICAgLy8gZW5jb2RlIGJ5dGVcbiAgICAgICAgdmFyIGJ5dGVfdG9fc2VuZCA9IE1FU1NBR0VbTUVTU0FHRV9JRFhdLmNoYXJDb2RlQXQoMClcbiAgICAgICAgZW5jb2RlX2J5dGUoYnl0ZV90b19zZW5kKVxuXG4gICAgICB9XG5cbiAgICB9XG5cbiAgfVxuXG5cbiAgZnVuY3Rpb24gbG9va19mb3Jfc2lnbmFsaW5nKCl7XG5cbiAgICB2YXIgdmFsaWRfcmFuZ2VzID0gdmFsaWRhdGVfcmFuZ2VzKClcbiAgICBpZih2YWxpZF9yYW5nZXNbOF0gPT09IHRydWUgJiYgdmFsaWRfcmFuZ2VzWzldID09PSBmYWxzZSl7XG4gICAgICBjdXJyZW50X2hpZ2hfY2hhbm5lbCA9IDhcbiAgICB9IGVsc2Uge1xuICAgICAgY3VycmVudF9oaWdoX2NoYW5uZWwgPSA5XG4gICAgfVxuXG4gICAgdmFyIGRpZmZlcmVuY2VfZm91bmQgPSBmYWxzZVxuXG4gICAgaWYoY3VycmVudF9oaWdoX2NoYW5uZWwgIT09IHByZXZfaGlnaF9jaGFubmVsKXtcbiAgICAgIGRpZmZlcmVuY2VfZm91bmQgPSB0cnVlXG4gICAgICBTWU5DX0NPVU5UICs9IDFcbiAgICB9XG5cbiAgICBwcmV2X2hpZ2hfY2hhbm5lbCA9IGN1cnJlbnRfaGlnaF9jaGFubmVsXG5cbiAgICByZXR1cm4gZGlmZmVyZW5jZV9mb3VuZFxuXG4gIH1cblxuICBmdW5jdGlvbiBpbml0KG9wdHMpe1xuXG4gICAgTUVTU0FHRSA9IG9wdHMubWVzc2FnZVxuICAgIHR5cGUgPSBvcHRzLnR5cGVcblxuICAgIC8vIGNyZWF0ZSBvc2MgKyBnYWluIGJhbmtzXG4gICAgZm9yKHZhciBpZHggPSAwOyBpZHggPCBuX29zYzsgaWR4Kyspe1xuXG4gICAgICBsZXQgbG9jYWxfb3NjID0gY29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKClcbiAgICAgIGxvY2FsX29zYy5mcmVxdWVuY3kudmFsdWUgPSAoaWR4ICogc3ByZWFkKSArIGluaXRpYWxGcmVxXG5cbiAgICAgIGxldCBsb2NhbF9nYWluID0gY29udGV4dC5jcmVhdGVHYWluKClcbiAgICAgIGxvY2FsX2dhaW4uZ2Fpbi52YWx1ZSA9IDEuMCAvIChuX29zYylcblxuICAgICAgbG9jYWxfb3NjLmNvbm5lY3QobG9jYWxfZ2FpbilcblxuICAgICAgLy8gbG9jYWxfZ2Fpbi5jb25uZWN0KGFuYWx5c2VyKVxuICAgICAgbG9jYWxfZ2Fpbi5jb25uZWN0KGNvbnRleHQuZGVzdGluYXRpb24pXG5cbiAgICAgIGxvY2FsX29zYy5zdGFydCgpXG5cbiAgICAgIG9zY19iYW5rLnB1c2gobG9jYWxfb3NjKVxuICAgICAgZ2Fpbl9iYW5rLnB1c2gobG9jYWxfZ2FpbilcblxuICAgIH1cblxuICAgIC8vIGFuYWx5c2VyLm5hbWUgPSBuYW1lXG4gICAgYW5hbHlzZXIuZmZ0U2l6ZSA9IDEwMjRcbiAgICBhbmFseXNlci5zbW9vdGhpbmdUaW1lQ29uc3RhbnQgPSAwXG4gICAgYnVmZmVyTGVuZ3RoID0gYW5hbHlzZXIuZnJlcXVlbmN5QmluQ291bnRcbiAgICBhbmFseXNlckRhdGFBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlckxlbmd0aClcblxuXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbm5lY3Qob3RoZXJfYWdlbnQpe1xuXG4gICAgdmFyIG90aGVyX2dhaW5fYmFuayA9IG90aGVyX2FnZW50LmdldF9nYWluX2JhbmsoKVxuXG4gICAgb3RoZXJfZ2Fpbl9iYW5rLmZvckVhY2goZnVuY3Rpb24oZ2Fpbk5vZGUpe1xuICAgICAgZ2Fpbk5vZGUuY29ubmVjdChhbmFseXNlcilcbiAgICB9KVxuXG4gICAgZ2V0QnVmZmVyKClcblxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIGNvbnNvbGUubG9nKCd5ZXAnKVxuICAgICAgQ1VSUkVOVF9TVEFURSA9IDBcbiAgICB9LDIwMClcblxuXG5cbiAgICAvLyBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgLy8gICByZWdpc3Rlcl9wZWFrX3JhbmdlcygpXG4gICAgLy8gICBjYWxsYmFjaygpXG4gICAgLy8gfSwxMDApXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIG5fY2hhbm5lbHMoKXtcbiAgICByZXR1cm4gbl9vc2NcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9ncm91cHMoKXtcbiAgICByZXR1cm4gZ3JvdXBlZF9wZWFrX3Jhbmdlc1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0QnVmZmVyKCl7XG4gICAgYW5hbHlzZXIuZ2V0Qnl0ZUZyZXF1ZW5jeURhdGEoYW5hbHlzZXJEYXRhQXJyYXkpXG4gICAgcmV0dXJuIGFuYWx5c2VyRGF0YUFycmF5XG4gIH1cblxuICBmdW5jdGlvbiBnZXRfZ2Fpbl9iYW5rKCl7XG4gICAgcmV0dXJuIGdhaW5fYmFua1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2FuYWx5c2VyKCl7XG4gICAgcmV0dXJuIGFuYWx5c2VyXG4gIH1cblxuICBmdW5jdGlvbiByZWdpc3Rlcl9wZWFrX3Jhbmdlcygpe1xuXG4gICAgY29uc29sZS5sb2coJ3JlZ2lzdGVyaW5nIHBlYWsgcmFuZ2VzJylcblxuICAgIGdldEJ1ZmZlcigpXG4gICAgY29uc29sZS5sb2coYW5hbHlzZXJEYXRhQXJyYXkpXG5cbiAgICAvLyBwdXNoIG9uIHRvIG5ldyBhcnJheSBmb3Igc29ydGluZ1xuICAgIHZhciBkID0gW11cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgYnVmZmVyTGVuZ3RoOyBpKyspe1xuICAgICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbaV0gPiAwKXtcbiAgICAgICAgZC5wdXNoKGFuYWx5c2VyRGF0YUFycmF5W2ldKVxuICAgICAgfVxuICAgIH1cbiAgICBkLnNvcnQoZnVuY3Rpb24oYSxiKXtcbiAgICAgIHJldHVybiBhLWJcbiAgICB9KVxuICAgIGNvbnNvbGUubG9nKCdNZWFuOiAnK2RbTWF0aC5mbG9vcihkLmxlbmd0aC8yKV0pXG5cbiAgICBtZWFuID0gZFtNYXRoLmZsb29yKGQubGVuZ3RoLzIpXVxuXG4gICAgLy9cbiAgICBwZWFrX3JhbmdlcyA9IFtdXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKXtcbiAgICAgIGlmKGFuYWx5c2VyRGF0YUFycmF5W2ldID4gbWVhbil7XG4gICAgICAgIHBlYWtfcmFuZ2VzLnB1c2goaSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB3aW5kb3cucCA9IHBlYWtfcmFuZ2VzXG5cbiAgICBncm91cF9wZWFrX3JhbmdlcygpXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNoZWNrX3BlYWtfcmFuZ2VzKCl7XG5cbiAgICBnZXRCdWZmZXIoKVxuXG4gICAgdmFyIGhpdHMgPSBbXVxuICAgIHBlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24oZGF0YUFycmF5X2lkeCl7XG4gICAgICBpZihhbmFseXNlckRhdGFBcnJheVtkYXRhQXJyYXlfaWR4XSA+IG1lYW4pe1xuICAgICAgICBoaXRzLnB1c2godHJ1ZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGhpdHMucHVzaChmYWxzZSlcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIGhpdHNcblxuICB9XG5cbiAgZnVuY3Rpb24gZ3JvdXBfcGVha19yYW5nZXMoKXtcblxuICAgIGlmKHBlYWtfcmFuZ2VzID09PSB1bmRlZmluZWQgfHwgcGVha19yYW5nZXMubGVuZ3RoID09PSAwKXtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZ3JvdXBzID0gW10gLy8gWyBbMSwyLDNdLCBbOCw5LDEwXSwgWzMwLDMxLDMyXSAgXVxuXG4gICAgdmFyIGN1cnJlbnRfZ3JvdXBfaWR4ID0gMFxuXG4gICAgdmFyIGxvY2FsX2dyb3VwID0gbmV3IEFycmF5KClcblxuICAgIHBlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24ocGVha19pZHgsIGlkeCl7XG5cbiAgICAgIC8vIGlmIHRoZSBNYXRoLmFicyhwZWFrX2lkeCAtIHBlYWtfcmFuZ2VzW2lkeCsxXSkgPT09IDFcbiAgICAgIC8vICAgIHB1c2ggcGVha19pZHggb24gdG8gbG9jYWxfZ3JvdXBcbiAgICAgIC8vIGVsc2VcbiAgICAgIC8vICAgIHB1c2ggbG9jYWxfZ3JvdXAgb24gdG8gZ3JvdXBzXG4gICAgICAvLyAgICBjbGVhciBsb2NhbF9ncm91cFxuICAgICAgLy8gICAgcHVzaCBwZWFrX2lkeCBvbiB0byBsb2NhbF9ncm91cFxuXG4gICAgICBpZihpZHggPT09IHBlYWtfcmFuZ2VzLmxlbmd0aC0xKXtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ2hlcmUnKVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmKE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4KzFdKSA8PSAyKXtcbiAgICAgICAgbG9jYWxfZ3JvdXAucHVzaChwZWFrX2lkeClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgICAgIGdyb3Vwcy5wdXNoKGxvY2FsX2dyb3VwKVxuICAgICAgICBsb2NhbF9ncm91cCA9IG5ldyBBcnJheSgpXG4gICAgICB9XG5cbiAgICB9KVxuXG4gICAgZ3JvdXBzLnB1c2gobG9jYWxfZ3JvdXApXG5cbiAgICBncm91cGVkX3BlYWtfcmFuZ2VzID0gZ3JvdXBzXG5cbiAgICByZXR1cm4gZ3JvdXBzXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9nYWluKGNoYW5uZWwsIHZhbHVlKXtcbiAgICBnYWluX2JhbmtbY2hhbm5lbF0uZ2Fpbi52YWx1ZSA9IHZhbHVlXG4gIH1cblxuICBmdW5jdGlvbiB2YWxpZGF0ZV9yYW5nZXMoKXtcblxuICAgIGlmKGdyb3VwZWRfcGVha19yYW5nZXMgPT09IHVuZGVmaW5lZCl7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZ2V0QnVmZmVyKClcblxuICAgIHZhciB2YWxpZF9ncm91cHMgPSBbXVxuXG4gICAgZ3JvdXBlZF9wZWFrX3Jhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGdyb3VwKXtcblxuICAgICAgLy8gZm9yIGVhY2ggZW50cnkgaW4gdGhlIGdyb3VwXG4gICAgICB2YXIgaGl0cyA9IDBcblxuICAgICAgZ3JvdXAuZm9yRWFjaChmdW5jdGlvbihpZHgpe1xuICAgICAgICBpZihhbmFseXNlckRhdGFBcnJheVtpZHhdID49IG1lYW4pe1xuICAgICAgICAgIGhpdHMgKz0gMVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICAvLyBjb25zb2xlLmxvZyhoaXRzKVxuXG4gICAgICBpZihoaXRzID49IGdyb3VwLmxlbmd0aC8yKXtcbiAgICAgICAgdmFsaWRfZ3JvdXBzLnB1c2godHJ1ZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbGlkX2dyb3Vwcy5wdXNoKGZhbHNlKVxuICAgICAgfVxuXG4gICAgfSlcblxuICAgIHJldHVybiB2YWxpZF9ncm91cHNcblxuICB9XG5cbiAgZnVuY3Rpb24gZW5jb2RlX2J5dGUoYnl0ZSl7XG5cbiAgICB2YXIgY2hhcnMgPSBnZXRfZW5jb2RlZF9ieXRlX2FycmF5KGJ5dGUpXG5cbiAgICAvLyBjb25zb2xlLmxvZyhjaGFycylcblxuICAgIGNoYXJzLmZvckVhY2goZnVuY3Rpb24oYyxpZHgpe1xuICAgICAgaWYoYyA9PT0gJzAnKXtcbiAgICAgICAgc2V0X2dhaW4oaWR4LDApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRfZ2FpbihpZHgsMS9uX29zYylcbiAgICAgIH1cbiAgICB9KVxuXG4gIH1cblxuICBmdW5jdGlvbiBwZXJmb3JtX3NpZ25hbGluZygpe1xuICAgIGZsaXBfZmxvcCA9ICFmbGlwX2Zsb3BcbiAgICBpZihmbGlwX2Zsb3Ape1xuICAgICAgc2V0X2dhaW4oOCwxL25fb3NjKVxuICAgICAgc2V0X2dhaW4oOSwwKVxuICAgIH0gZWxzZSB7XG4gICAgICBzZXRfZ2Fpbig5LDEvbl9vc2MpXG4gICAgICBzZXRfZ2Fpbig4LDApXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2VuY29kZWRfYnl0ZV9hcnJheShieXRlKXtcbiAgICByZXR1cm4gcGFkKGJ5dGUudG9TdHJpbmcoMiksOCkuc3BsaXQoJycpXG4gIH1cblxuICBmdW5jdGlvbiByZWFkX2J5dGVfZnJvbV9zaWduYWwoKXtcblxuICAgIHZhciByYW5nZXMgPSB2YWxpZGF0ZV9yYW5nZXMoKVxuXG4gICAgdmFyIGJpbmFyeV9zdHJpbmcgPSAnJ1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCA4OyBpKyspe1xuICAgICAgaWYocmFuZ2VzW2ldKXtcbiAgICAgICAgYmluYXJ5X3N0cmluZyArPSAnMSdcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJpbmFyeV9zdHJpbmcgKz0gJzAnXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnJlc2hfZGF0YSA9IGZhbHNlXG5cbiAgICByZXR1cm4gcGFyc2VJbnQoYmluYXJ5X3N0cmluZywyKVxuXG4gIH1cblxuXG4gIGZ1bmN0aW9uIHBhZChuLCB3aWR0aCwgeikge1xuICAgIHogPSB6IHx8ICcwJztcbiAgICBuID0gbiArICcnO1xuICAgIHJldHVybiBuLmxlbmd0aCA+PSB3aWR0aCA/IG4gOiBuZXcgQXJyYXkod2lkdGggLSBuLmxlbmd0aCArIDEpLmpvaW4oeikgKyBuO1xuICB9XG5cblxuICB2YXIgayA9IHtcbiAgICBpbml0OiBpbml0LFxuICAgIGNvbm5lY3Q6IGNvbm5lY3QsXG4gICAgZ2V0X2dhaW5fYmFuazogZ2V0X2dhaW5fYmFuayxcbiAgICBnZXRfYW5hbHlzZXI6IGdldF9hbmFseXNlcixcbiAgICBnZXRCdWZmZXI6IGdldEJ1ZmZlcixcbiAgICBjaGVja19wZWFrX3JhbmdlczogY2hlY2tfcGVha19yYW5nZXMsXG4gICAgZ3JvdXBfcGVha19yYW5nZXM6IGdyb3VwX3BlYWtfcmFuZ2VzLFxuICAgIHNldF9nYWluOiBzZXRfZ2FpbixcbiAgICB2YWxpZGF0ZV9yYW5nZXM6IHZhbGlkYXRlX3JhbmdlcyxcbiAgICBuX2NoYW5uZWxzOiBuX2NoYW5uZWxzLFxuICAgIGdldF9ncm91cHM6IGdldF9ncm91cHMsXG4gICAgZW5jb2RlX3JhbmdlOiBlbmNvZGVfYnl0ZSxcbiAgICBnZXRfZW5jb2RlZF9ieXRlX2FycmF5OiBnZXRfZW5jb2RlZF9ieXRlX2FycmF5LFxuICAgIHJlYWRfYnl0ZV9mcm9tX3NpZ25hbDogcmVhZF9ieXRlX2Zyb21fc2lnbmFsLFxuICAgIHRpY2s6IHRpY2tcbiAgfVxuXG4gIHJldHVybiBrXG5cbn1cbiIsIndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciB1ZHBfbW9kZSA9IHRydWVcblxuICBjb25zb2xlLmxvZygnbWFpbi5qcyAvIHdpbmRvdy5vbmxvYWQgYW5vbnltb3VzIGZ1bmN0aW9uJylcblxuICB2YXIgbWVzc2FnZV90b19zZW5kID0gJ3RoaXMgaXMgYSB0ZXN0IHRoYXQgdGhlIG1vZHVsYXRpb24gLyBkZW1vZHVsYXRpb24gd29ya3MgY29ycmVjdGx5ICdcbiAgdmFyIG1lc3NhZ2VfaWR4ID0gMFxuXG4gIHZhciBvdXRwdXRfbXNnID0gJydcblxuICB2YXIgQWdlbnQgPSByZXF1aXJlKCcuL2FnZW50LmpzJylcblxuICB3aW5kb3cuYWxpY2UgPSBBZ2VudC5hZ2VudCgpXG4gIGFsaWNlLmluaXQoe1xuICAgIHR5cGU6ICdjbGllbnQnLFxuICAgIG1lc3NhZ2U6ICdmZmZmJ1xuICB9KVxuXG4gIHdpbmRvdy5ib2IgPSBBZ2VudC5hZ2VudCgpXG4gIGJvYi5pbml0KHtcbiAgICB0eXBlOiAnc2VydmVyJyxcbiAgICBtZXNzYWdlOiAndGVzdGluZyB0aGF0IHRoZSBtb2QgLyBkZW1vZCB3b3JrcyBqdXN0IGZpbmUgJ1xuICB9KVxuXG4gIHZhciBkYXRhQXJyYXkgPSBhbGljZS5nZXRCdWZmZXIoKVxuICAvLyB2YXIgYnVmZmVyTGVuZ3RoID0gZGF0YUFycmF5Lmxlbmd0aFxuICB2YXIgYnVmZmVyTGVuZ3RoID0gNTEyXG5cbiAgdmFyIFdJRFRIID0gMTAyNFxuICB2YXIgSEVJR0hUID0gMjU2XG5cbiAgdmFyIGJhcldpZHRoID0gKFdJRFRIIC8gYnVmZmVyTGVuZ3RoKTtcblxuICB2YXIgYmFySGVpZ2h0XG4gIHZhciB4ID0gMFxuICB2YXIgbW9kID0gMC4wXG4gIHZhciBjb3VudGVyID0gMFxuICB2YXIgaVxuXG4gIHdpbmRvdy5ieXRlX3RvX2NvZGUgPSAwXG5cbiAgLy8gY3JlYXRlIHN2Z1xuICB2YXIgc3ZnID0gZDMuc2VsZWN0KCdkaXYjY29udGFpbmVyJykuYXBwZW5kKCdzdmcnKVxuICAgIC5hdHRyKCd3aWR0aCcsV0lEVEgpXG4gICAgLmF0dHIoJ2hlaWdodCcsIEhFSUdIVClcbiAgICAuc3R5bGUoJ2JhY2tncm91bmQtY29sb3InLCAncmdiYSgwLDAsMCwwLjEpJylcblxuICB2YXIgYmFycyA9IFtdXG4gIGZvcih2YXIgc3ZnYmFycyA9IDA7IHN2Z2JhcnMgPCBidWZmZXJMZW5ndGg7IHN2Z2JhcnMrKyl7XG4gICAgdmFyIGJhciA9IHN2Zy5hcHBlbmQoJ3JlY3QnKVxuICAgICAgLmF0dHIoJ3gnLCBiYXJXaWR0aCAqIHN2Z2JhcnMpXG4gICAgICAuYXR0cigneScsIDApXG4gICAgICAuYXR0cignd2lkdGgnLCBiYXJXaWR0aClcbiAgICAgIC5hdHRyKCdoZWlnaHQnLCAwKVxuXG4gICAgbGV0IGJhcl9pZHggPSBzdmdiYXJzXG4gICAgYmFyLm9uKCdtb3VzZW92ZXInLCBmdW5jdGlvbigpe1xuICAgICAgY29uc29sZS5sb2coYmFyX2lkeClcbiAgICB9KVxuXG4gICAgYmFycy5wdXNoKGJhcilcbiAgfVxuXG4gIHZhciBwcmV2X3JhbmdlcyA9IFtdXG5cbiAgYWxpY2UuY29ubmVjdChib2IpXG4gIGJvYi5jb25uZWN0KGFsaWNlKVxuXG5cbiAgc2V0VGltZW91dChkcmF3LDIwMClcbiAgLy8gZnVuY3Rpb24gc3RhcnQoKXtcbiAgLy8gICBhbGljZS5lbmNvZGVfcmFuZ2UoMjIpXG4gIC8vICAgZHJhdygpXG4gIC8vIH1cblxuICBmdW5jdGlvbiBkcmF3KCkge1xuXG4gICAgY291bnRlcisrXG4gICAgaWYoY291bnRlciAlIDIgPT09IDApe1xuXG4gICAgICAvLyB2aXN1YWxpemUgYWxpY2VzIGJ1ZmZlciBkYXRhXG4gICAgICBkYXRhQXJyYXkgPSBhbGljZS5nZXRCdWZmZXIoKVxuXG4gICAgICBmb3IoaT0wO2k8YnVmZmVyTGVuZ3RoO2krKyl7XG4gICAgICAgIGJhcnNbaV0uYXR0cignaGVpZ2h0JywgZGF0YUFycmF5W2ldKVxuICAgICAgfVxuXG4gICAgICBhbGljZS50aWNrKClcbiAgICAgIGJvYi50aWNrKClcblxuXG4gICAgICAvLyBpZihib2IucG9sbCgpIHx8IHVkcF9tb2RlKXtcbiAgICAgIC8vXG4gICAgICAvLyAgIGJvYi5yZWFkX2J5dGVfZnJvbV9zaWduYWwoKVxuICAgICAgLy8gICB3aW5kb3cuYnl0ZV90b19jb2RlID0gbWVzc2FnZV90b19zZW5kW21lc3NhZ2VfaWR4XS5jaGFyQ29kZUF0KDApXG4gICAgICAvLyAgIGJvYi5lbmNvZGVfcmFuZ2Uod2luZG93LmJ5dGVfdG9fY29kZSlcbiAgICAgIC8vICAgbWVzc2FnZV9pZHggKz0gMVxuICAgICAgLy8gICBtZXNzYWdlX2lkeCA9IG1lc3NhZ2VfaWR4ICUgbWVzc2FnZV90b19zZW5kLmxlbmd0aFxuICAgICAgLy9cbiAgICAgIC8vIH0gZWxzZSB7XG4gICAgICAvLyAgIC8vIGNvbnNvbGUubG9nKCdib2IgbWlzcycpXG4gICAgICAvLyB9XG4gICAgICAvL1xuICAgICAgLy8gaWYoYWxpY2UucG9sbCgpKXtcbiAgICAgIC8vXG4gICAgICAvLyAgIHZhciBhbGljZV9yZWFkcyA9IGFsaWNlLnJlYWRfYnl0ZV9mcm9tX3NpZ25hbCgpXG4gICAgICAvL1xuICAgICAgLy8gICBvdXRwdXRfbXNnICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYWxpY2VfcmVhZHMpXG4gICAgICAvL1xuICAgICAgLy8gICBkMy5zZWxlY3QoJ2Rpdi5vdXRwdXRfbXNnJykuaHRtbChvdXRwdXRfbXNnKVxuICAgICAgLy9cbiAgICAgIC8vICAgYWxpY2UuZW5jb2RlX3JhbmdlKDIpXG4gICAgICAvL1xuICAgICAgLy8gfSBlbHNlIHtcbiAgICAgIC8vICAgLy8gY29uc29sZS5sb2coJ2FsaWNlIG1pc3MnKVxuICAgICAgLy8gfVxuXG4gICAgfVxuXG4gICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShkcmF3KTtcblxuICB9XG5cblxuXG59XG4iXX0=
