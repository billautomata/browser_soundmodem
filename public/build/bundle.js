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

    var ret_obj = {
      new_data: false,
      data: ''
    }

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

            ret_obj.new_data = true
            ret_obj.data = String.fromCharCode(read_byte_from_signal())

            // console.log(String.fromCharCode(read_byte_from_signal()))
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

    return ret_obj

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

  var message_to_send = 'this is a test that the modulation / demodulation works correctly \nalso bumping the speed up to ~240 baud, this rules!! \n'
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
    message: message_to_send
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

      var o = alice.tick()

      if(o.new_data){
        output_msg += o.data
        d3.select('pre.output_msg').html(output_msg)
      }

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuXG5tb2R1bGUuZXhwb3J0cy5hZ2VudCA9IGFnZW50XG5cblxuZnVuY3Rpb24gYWdlbnQob3B0cyl7XG5cbiAgKGZ1bmN0aW9uIHNldHVwX2F1ZGlvX2NvbnRleHQoKXtcbiAgICBpZih3aW5kb3cuY29udGV4dCA9PT0gdW5kZWZpbmVkKXtcbiAgICAgIGNvbnNvbGUubG9nKCdjcmVhdGluZyBuZXcgd2luZG93LkF1ZGlvQ29udGV4dCgpJylcbiAgICAgIHdpbmRvdy5jb250ZXh0ID0gbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKVxuICAgIH1cbiAgICBjb25zb2xlLmxvZygnZG9uZS4nKVxuICB9KSgpXG5cbiAgdmFyIE1FU1NBR0VcbiAgdmFyIE1FU1NBR0VfSURYID0gMFxuXG4gIHZhciB0eXBlXG5cbiAgdmFyIGFuYWx5c2VyID0gY29udGV4dC5jcmVhdGVBbmFseXNlcigpXG4gIHZhciBhbmFseXNlckRhdGFBcnJheSAgIC8vIHRoZSBidWZmZXIgdGhlIGFuYWx5c2VyIHdyaXRlcyB0b1xuICB2YXIgYnVmZmVyTGVuZ3RoICAgICAgICAvLyB0aGUgbGVuZ3RoIG9mIHRoZSBhbmFseXNlckRhdGFBcnJheVxuXG4gIHZhciBwZWFrX3JhbmdlcyAgICAgICAgICAgLy8gZmxhdCBsaXN0IG9mIGluZGV4ZXMgb2YgZGV0ZWN0ZWQgcGVhayByYW5nZXNcbiAgdmFyIGdyb3VwZWRfcGVha19yYW5nZXMgICAvLyBjbHVzdGVyZWQgZ3JvdXBzIG9mIHBlYWsgcmFuZ2VzXG4gIHZhciBtZWFuICAgICAgICAgICAgICAgICAgLy8gdGhlIHRocmVzaG9sZCBmb3IgZGV0ZXJtaW5pbmcgaWYgYSBiYW5kIGlzIHBlYWtlZFxuXG4gIHZhciBmbGlwX2Zsb3AgPSB0cnVlXG5cbiAgdmFyIHByZXZfaGlnaF9jaGFubmVsID0gLTFcbiAgdmFyIGN1cnJlbnRfaGlnaF9jaGFubmVsID0gMFxuICB2YXIgZnJlc2hfZGF0YSA9IGZhbHNlXG4gIHZhciBTWU5DX0NPVU5UID0gMFxuXG4gIHZhciBvc2NfYmFuayA9IFtdXG4gIHZhciBnYWluX2JhbmsgPSBbXVxuXG4gIHZhciBuX29zYyA9IDEwXG4gIHZhciBmcmVxUmFuZ2UgPSAyNTAwXG4gIHZhciBzcHJlYWQgPSAoZnJlcVJhbmdlIC8gbl9vc2MpXG4gIHZhciBpbml0aWFsRnJlcSA9IDIwMFxuXG4gIHZhciBDVVJSRU5UX1NUQVRFID0gLTFcblxuICBmdW5jdGlvbiB0aWNrKCl7XG5cbiAgICB2YXIgcmV0X29iaiA9IHtcbiAgICAgIG5ld19kYXRhOiBmYWxzZSxcbiAgICAgIGRhdGE6ICcnXG4gICAgfVxuXG4gICAgLy8gY29uc29sZS5sb2coJ3RpY2snKVxuICAgIC8vIGNvbnNvbGUubG9nKENVUlJFTlRfU1RBVEUudG9TdHJpbmcoKSlcblxuICAgIGlmKENVUlJFTlRfU1RBVEUgPCAwKXtcbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2Uge1xuXG4gICAgICBpZihDVVJSRU5UX1NUQVRFID09PSAwKXtcblxuICAgICAgICByZWdpc3Rlcl9wZWFrX3JhbmdlcygpXG5cbiAgICAgICAgaWYoZ3JvdXBlZF9wZWFrX3Jhbmdlcy5sZW5ndGggPT09IDEwKXtcbiAgICAgICAgICBDVVJSRU5UX1NUQVRFID0gMVxuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSBpZihDVVJSRU5UX1NUQVRFID09PSAxKXtcblxuICAgICAgICBwZXJmb3JtX3NpZ25hbGluZygpXG4gICAgICAgIGxvb2tfZm9yX3NpZ25hbGluZygpXG5cbiAgICAgICAgaWYoU1lOQ19DT1VOVCA+IDUpe1xuICAgICAgICAgIENVUlJFTlRfU1RBVEUgPSAyXG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIGlmKENVUlJFTlRfU1RBVEUgPT09IDIpe1xuXG4gICAgICAgIGlmKGxvb2tfZm9yX3NpZ25hbGluZygpKXtcblxuICAgICAgICAgIC8vIHJlYWQgYnl0ZVxuICAgICAgICAgIGlmKHR5cGUgPT09ICdjbGllbnQnKXtcblxuICAgICAgICAgICAgcmV0X29iai5uZXdfZGF0YSA9IHRydWVcbiAgICAgICAgICAgIHJldF9vYmouZGF0YSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocmVhZF9ieXRlX2Zyb21fc2lnbmFsKCkpXG5cbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFN0cmluZy5mcm9tQ2hhckNvZGUocmVhZF9ieXRlX2Zyb21fc2lnbmFsKCkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIGluY3JlbWVudCBieXRlIHRvIGVuY29kZVxuICAgICAgICAgIE1FU1NBR0VfSURYICs9IDFcbiAgICAgICAgICBNRVNTQUdFX0lEWCA9IE1FU1NBR0VfSURYICUgTUVTU0FHRS5sZW5ndGhcblxuXG4gICAgICAgICAgcGVyZm9ybV9zaWduYWxpbmcoKVxuXG4gICAgICAgIH1cbiAgICAgICAgLy8gZW5jb2RlIGJ5dGVcbiAgICAgICAgdmFyIGJ5dGVfdG9fc2VuZCA9IE1FU1NBR0VbTUVTU0FHRV9JRFhdLmNoYXJDb2RlQXQoMClcbiAgICAgICAgZW5jb2RlX2J5dGUoYnl0ZV90b19zZW5kKVxuXG4gICAgICB9XG5cbiAgICB9XG5cbiAgICByZXR1cm4gcmV0X29ialxuXG4gIH1cblxuXG4gIGZ1bmN0aW9uIGxvb2tfZm9yX3NpZ25hbGluZygpe1xuXG4gICAgdmFyIHZhbGlkX3JhbmdlcyA9IHZhbGlkYXRlX3JhbmdlcygpXG4gICAgaWYodmFsaWRfcmFuZ2VzWzhdID09PSB0cnVlICYmIHZhbGlkX3Jhbmdlc1s5XSA9PT0gZmFsc2Upe1xuICAgICAgY3VycmVudF9oaWdoX2NoYW5uZWwgPSA4XG4gICAgfSBlbHNlIHtcbiAgICAgIGN1cnJlbnRfaGlnaF9jaGFubmVsID0gOVxuICAgIH1cblxuICAgIHZhciBkaWZmZXJlbmNlX2ZvdW5kID0gZmFsc2VcblxuICAgIGlmKGN1cnJlbnRfaGlnaF9jaGFubmVsICE9PSBwcmV2X2hpZ2hfY2hhbm5lbCl7XG4gICAgICBkaWZmZXJlbmNlX2ZvdW5kID0gdHJ1ZVxuICAgICAgU1lOQ19DT1VOVCArPSAxXG4gICAgfVxuXG4gICAgcHJldl9oaWdoX2NoYW5uZWwgPSBjdXJyZW50X2hpZ2hfY2hhbm5lbFxuXG4gICAgcmV0dXJuIGRpZmZlcmVuY2VfZm91bmRcblxuICB9XG5cbiAgZnVuY3Rpb24gaW5pdChvcHRzKXtcblxuICAgIE1FU1NBR0UgPSBvcHRzLm1lc3NhZ2VcbiAgICB0eXBlID0gb3B0cy50eXBlXG5cbiAgICAvLyBjcmVhdGUgb3NjICsgZ2FpbiBiYW5rc1xuICAgIGZvcih2YXIgaWR4ID0gMDsgaWR4IDwgbl9vc2M7IGlkeCsrKXtcblxuICAgICAgbGV0IGxvY2FsX29zYyA9IGNvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpXG4gICAgICBsb2NhbF9vc2MuZnJlcXVlbmN5LnZhbHVlID0gKGlkeCAqIHNwcmVhZCkgKyBpbml0aWFsRnJlcVxuXG4gICAgICBsZXQgbG9jYWxfZ2FpbiA9IGNvbnRleHQuY3JlYXRlR2FpbigpXG4gICAgICBsb2NhbF9nYWluLmdhaW4udmFsdWUgPSAxLjAgLyAobl9vc2MpXG5cbiAgICAgIGxvY2FsX29zYy5jb25uZWN0KGxvY2FsX2dhaW4pXG5cbiAgICAgIC8vIGxvY2FsX2dhaW4uY29ubmVjdChhbmFseXNlcilcbiAgICAgIGxvY2FsX2dhaW4uY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKVxuXG4gICAgICBsb2NhbF9vc2Muc3RhcnQoKVxuXG4gICAgICBvc2NfYmFuay5wdXNoKGxvY2FsX29zYylcbiAgICAgIGdhaW5fYmFuay5wdXNoKGxvY2FsX2dhaW4pXG5cbiAgICB9XG5cbiAgICAvLyBhbmFseXNlci5uYW1lID0gbmFtZVxuICAgIGFuYWx5c2VyLmZmdFNpemUgPSAxMDI0XG4gICAgYW5hbHlzZXIuc21vb3RoaW5nVGltZUNvbnN0YW50ID0gMFxuICAgIGJ1ZmZlckxlbmd0aCA9IGFuYWx5c2VyLmZyZXF1ZW5jeUJpbkNvdW50XG4gICAgYW5hbHlzZXJEYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXJMZW5ndGgpXG5cblxuXG4gIH1cblxuICBmdW5jdGlvbiBjb25uZWN0KG90aGVyX2FnZW50KXtcblxuICAgIHZhciBvdGhlcl9nYWluX2JhbmsgPSBvdGhlcl9hZ2VudC5nZXRfZ2Fpbl9iYW5rKClcblxuICAgIG90aGVyX2dhaW5fYmFuay5mb3JFYWNoKGZ1bmN0aW9uKGdhaW5Ob2RlKXtcbiAgICAgIGdhaW5Ob2RlLmNvbm5lY3QoYW5hbHlzZXIpXG4gICAgfSlcblxuICAgIGdldEJ1ZmZlcigpXG5cbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICBjb25zb2xlLmxvZygneWVwJylcbiAgICAgIENVUlJFTlRfU1RBVEUgPSAwXG4gICAgfSwyMDApXG5cblxuXG4gICAgLy8gc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgIC8vICAgcmVnaXN0ZXJfcGVha19yYW5nZXMoKVxuICAgIC8vICAgY2FsbGJhY2soKVxuICAgIC8vIH0sMTAwKVxuXG4gIH1cblxuICBmdW5jdGlvbiBuX2NoYW5uZWxzKCl7XG4gICAgcmV0dXJuIG5fb3NjXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfZ3JvdXBzKCl7XG4gICAgcmV0dXJuIGdyb3VwZWRfcGVha19yYW5nZXNcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEJ1ZmZlcigpe1xuICAgIGFuYWx5c2VyLmdldEJ5dGVGcmVxdWVuY3lEYXRhKGFuYWx5c2VyRGF0YUFycmF5KVxuICAgIHJldHVybiBhbmFseXNlckRhdGFBcnJheVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2dhaW5fYmFuaygpe1xuICAgIHJldHVybiBnYWluX2JhbmtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9hbmFseXNlcigpe1xuICAgIHJldHVybiBhbmFseXNlclxuICB9XG5cbiAgZnVuY3Rpb24gcmVnaXN0ZXJfcGVha19yYW5nZXMoKXtcblxuICAgIGNvbnNvbGUubG9nKCdyZWdpc3RlcmluZyBwZWFrIHJhbmdlcycpXG5cbiAgICBnZXRCdWZmZXIoKVxuICAgIGNvbnNvbGUubG9nKGFuYWx5c2VyRGF0YUFycmF5KVxuXG4gICAgLy8gcHVzaCBvbiB0byBuZXcgYXJyYXkgZm9yIHNvcnRpbmdcbiAgICB2YXIgZCA9IFtdXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKXtcbiAgICAgIGlmKGFuYWx5c2VyRGF0YUFycmF5W2ldID4gMCl7XG4gICAgICAgIGQucHVzaChhbmFseXNlckRhdGFBcnJheVtpXSlcbiAgICAgIH1cbiAgICB9XG4gICAgZC5zb3J0KGZ1bmN0aW9uKGEsYil7XG4gICAgICByZXR1cm4gYS1iXG4gICAgfSlcbiAgICBjb25zb2xlLmxvZygnTWVhbjogJytkW01hdGguZmxvb3IoZC5sZW5ndGgvMildKVxuXG4gICAgbWVhbiA9IGRbTWF0aC5mbG9vcihkLmxlbmd0aC8yKV1cblxuICAgIC8vXG4gICAgcGVha19yYW5nZXMgPSBbXVxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBidWZmZXJMZW5ndGg7IGkrKyl7XG4gICAgICBpZihhbmFseXNlckRhdGFBcnJheVtpXSA+IG1lYW4pe1xuICAgICAgICBwZWFrX3Jhbmdlcy5wdXNoKGkpXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gd2luZG93LnAgPSBwZWFrX3Jhbmdlc1xuXG4gICAgZ3JvdXBfcGVha19yYW5nZXMoKVxuXG4gIH1cblxuICBmdW5jdGlvbiBjaGVja19wZWFrX3Jhbmdlcygpe1xuXG4gICAgZ2V0QnVmZmVyKClcblxuICAgIHZhciBoaXRzID0gW11cbiAgICBwZWFrX3Jhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGRhdGFBcnJheV9pZHgpe1xuICAgICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbZGF0YUFycmF5X2lkeF0gPiBtZWFuKXtcbiAgICAgICAgaGl0cy5wdXNoKHRydWUpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBoaXRzLnB1c2goZmFsc2UpXG4gICAgICB9XG4gICAgfSlcblxuICAgIHJldHVybiBoaXRzXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGdyb3VwX3BlYWtfcmFuZ2VzKCl7XG5cbiAgICBpZihwZWFrX3JhbmdlcyA9PT0gdW5kZWZpbmVkIHx8IHBlYWtfcmFuZ2VzLmxlbmd0aCA9PT0gMCl7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGdyb3VwcyA9IFtdIC8vIFsgWzEsMiwzXSwgWzgsOSwxMF0sIFszMCwzMSwzMl0gIF1cblxuICAgIHZhciBjdXJyZW50X2dyb3VwX2lkeCA9IDBcblxuICAgIHZhciBsb2NhbF9ncm91cCA9IG5ldyBBcnJheSgpXG5cbiAgICBwZWFrX3Jhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKHBlYWtfaWR4LCBpZHgpe1xuXG4gICAgICAvLyBpZiB0aGUgTWF0aC5hYnMocGVha19pZHggLSBwZWFrX3Jhbmdlc1tpZHgrMV0pID09PSAxXG4gICAgICAvLyAgICBwdXNoIHBlYWtfaWR4IG9uIHRvIGxvY2FsX2dyb3VwXG4gICAgICAvLyBlbHNlXG4gICAgICAvLyAgICBwdXNoIGxvY2FsX2dyb3VwIG9uIHRvIGdyb3Vwc1xuICAgICAgLy8gICAgY2xlYXIgbG9jYWxfZ3JvdXBcbiAgICAgIC8vICAgIHB1c2ggcGVha19pZHggb24gdG8gbG9jYWxfZ3JvdXBcblxuICAgICAgaWYoaWR4ID09PSBwZWFrX3Jhbmdlcy5sZW5ndGgtMSl7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdoZXJlJylcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZihNYXRoLmFicyhwZWFrX2lkeCAtIHBlYWtfcmFuZ2VzW2lkeCsxXSkgPD0gMil7XG4gICAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2NhbF9ncm91cC5wdXNoKHBlYWtfaWR4KVxuICAgICAgICBncm91cHMucHVzaChsb2NhbF9ncm91cClcbiAgICAgICAgbG9jYWxfZ3JvdXAgPSBuZXcgQXJyYXkoKVxuICAgICAgfVxuXG4gICAgfSlcblxuICAgIGdyb3Vwcy5wdXNoKGxvY2FsX2dyb3VwKVxuXG4gICAgZ3JvdXBlZF9wZWFrX3JhbmdlcyA9IGdyb3Vwc1xuXG4gICAgcmV0dXJuIGdyb3Vwc1xuXG4gIH1cblxuICBmdW5jdGlvbiBzZXRfZ2FpbihjaGFubmVsLCB2YWx1ZSl7XG4gICAgZ2Fpbl9iYW5rW2NoYW5uZWxdLmdhaW4udmFsdWUgPSB2YWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVfcmFuZ2VzKCl7XG5cbiAgICBpZihncm91cGVkX3BlYWtfcmFuZ2VzID09PSB1bmRlZmluZWQpe1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGdldEJ1ZmZlcigpXG5cbiAgICB2YXIgdmFsaWRfZ3JvdXBzID0gW11cblxuICAgIGdyb3VwZWRfcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbihncm91cCl7XG5cbiAgICAgIC8vIGZvciBlYWNoIGVudHJ5IGluIHRoZSBncm91cFxuICAgICAgdmFyIGhpdHMgPSAwXG5cbiAgICAgIGdyb3VwLmZvckVhY2goZnVuY3Rpb24oaWR4KXtcbiAgICAgICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbaWR4XSA+PSBtZWFuKXtcbiAgICAgICAgICBoaXRzICs9IDFcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgLy8gY29uc29sZS5sb2coaGl0cylcblxuICAgICAgaWYoaGl0cyA+PSBncm91cC5sZW5ndGgvMil7XG4gICAgICAgIHZhbGlkX2dyb3Vwcy5wdXNoKHRydWUpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWxpZF9ncm91cHMucHVzaChmYWxzZSlcbiAgICAgIH1cblxuICAgIH0pXG5cbiAgICByZXR1cm4gdmFsaWRfZ3JvdXBzXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGVuY29kZV9ieXRlKGJ5dGUpe1xuXG4gICAgdmFyIGNoYXJzID0gZ2V0X2VuY29kZWRfYnl0ZV9hcnJheShieXRlKVxuXG4gICAgLy8gY29uc29sZS5sb2coY2hhcnMpXG5cbiAgICBjaGFycy5mb3JFYWNoKGZ1bmN0aW9uKGMsaWR4KXtcbiAgICAgIGlmKGMgPT09ICcwJyl7XG4gICAgICAgIHNldF9nYWluKGlkeCwwKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0X2dhaW4oaWR4LDEvbl9vc2MpXG4gICAgICB9XG4gICAgfSlcblxuICB9XG5cbiAgZnVuY3Rpb24gcGVyZm9ybV9zaWduYWxpbmcoKXtcbiAgICBmbGlwX2Zsb3AgPSAhZmxpcF9mbG9wXG4gICAgaWYoZmxpcF9mbG9wKXtcbiAgICAgIHNldF9nYWluKDgsMS9uX29zYylcbiAgICAgIHNldF9nYWluKDksMClcbiAgICB9IGVsc2Uge1xuICAgICAgc2V0X2dhaW4oOSwxL25fb3NjKVxuICAgICAgc2V0X2dhaW4oOCwwKVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9lbmNvZGVkX2J5dGVfYXJyYXkoYnl0ZSl7XG4gICAgcmV0dXJuIHBhZChieXRlLnRvU3RyaW5nKDIpLDgpLnNwbGl0KCcnKVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZF9ieXRlX2Zyb21fc2lnbmFsKCl7XG5cbiAgICB2YXIgcmFuZ2VzID0gdmFsaWRhdGVfcmFuZ2VzKClcblxuICAgIHZhciBiaW5hcnlfc3RyaW5nID0gJydcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgODsgaSsrKXtcbiAgICAgIGlmKHJhbmdlc1tpXSl7XG4gICAgICAgIGJpbmFyeV9zdHJpbmcgKz0gJzEnXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBiaW5hcnlfc3RyaW5nICs9ICcwJ1xuICAgICAgfVxuICAgIH1cblxuICAgIGZyZXNoX2RhdGEgPSBmYWxzZVxuXG4gICAgcmV0dXJuIHBhcnNlSW50KGJpbmFyeV9zdHJpbmcsMilcblxuICB9XG5cblxuICBmdW5jdGlvbiBwYWQobiwgd2lkdGgsIHopIHtcbiAgICB6ID0geiB8fCAnMCc7XG4gICAgbiA9IG4gKyAnJztcbiAgICByZXR1cm4gbi5sZW5ndGggPj0gd2lkdGggPyBuIDogbmV3IEFycmF5KHdpZHRoIC0gbi5sZW5ndGggKyAxKS5qb2luKHopICsgbjtcbiAgfVxuXG5cbiAgdmFyIGsgPSB7XG4gICAgaW5pdDogaW5pdCxcbiAgICBjb25uZWN0OiBjb25uZWN0LFxuICAgIGdldF9nYWluX2Jhbms6IGdldF9nYWluX2JhbmssXG4gICAgZ2V0X2FuYWx5c2VyOiBnZXRfYW5hbHlzZXIsXG4gICAgZ2V0QnVmZmVyOiBnZXRCdWZmZXIsXG4gICAgY2hlY2tfcGVha19yYW5nZXM6IGNoZWNrX3BlYWtfcmFuZ2VzLFxuICAgIGdyb3VwX3BlYWtfcmFuZ2VzOiBncm91cF9wZWFrX3JhbmdlcyxcbiAgICBzZXRfZ2Fpbjogc2V0X2dhaW4sXG4gICAgdmFsaWRhdGVfcmFuZ2VzOiB2YWxpZGF0ZV9yYW5nZXMsXG4gICAgbl9jaGFubmVsczogbl9jaGFubmVscyxcbiAgICBnZXRfZ3JvdXBzOiBnZXRfZ3JvdXBzLFxuICAgIGVuY29kZV9yYW5nZTogZW5jb2RlX2J5dGUsXG4gICAgZ2V0X2VuY29kZWRfYnl0ZV9hcnJheTogZ2V0X2VuY29kZWRfYnl0ZV9hcnJheSxcbiAgICByZWFkX2J5dGVfZnJvbV9zaWduYWw6IHJlYWRfYnl0ZV9mcm9tX3NpZ25hbCxcbiAgICB0aWNrOiB0aWNrXG4gIH1cblxuICByZXR1cm4ga1xuXG59XG4iLCJ3aW5kb3cub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgdWRwX21vZGUgPSB0cnVlXG5cbiAgY29uc29sZS5sb2coJ21haW4uanMgLyB3aW5kb3cub25sb2FkIGFub255bW91cyBmdW5jdGlvbicpXG5cbiAgdmFyIG1lc3NhZ2VfdG9fc2VuZCA9ICd0aGlzIGlzIGEgdGVzdCB0aGF0IHRoZSBtb2R1bGF0aW9uIC8gZGVtb2R1bGF0aW9uIHdvcmtzIGNvcnJlY3RseSBcXG5hbHNvIGJ1bXBpbmcgdGhlIHNwZWVkIHVwIHRvIH4yNDAgYmF1ZCwgdGhpcyBydWxlcyEhIFxcbidcbiAgdmFyIG91dHB1dF9tc2cgPSAnJ1xuXG4gIHZhciBBZ2VudCA9IHJlcXVpcmUoJy4vYWdlbnQuanMnKVxuXG4gIHdpbmRvdy5hbGljZSA9IEFnZW50LmFnZW50KClcbiAgYWxpY2UuaW5pdCh7XG4gICAgdHlwZTogJ2NsaWVudCcsXG4gICAgbWVzc2FnZTogJ2ZmZmYnXG4gIH0pXG5cbiAgd2luZG93LmJvYiA9IEFnZW50LmFnZW50KClcbiAgYm9iLmluaXQoe1xuICAgIHR5cGU6ICdzZXJ2ZXInLFxuICAgIG1lc3NhZ2U6IG1lc3NhZ2VfdG9fc2VuZFxuICB9KVxuXG4gIHZhciBkYXRhQXJyYXkgPSBhbGljZS5nZXRCdWZmZXIoKVxuICAvLyB2YXIgYnVmZmVyTGVuZ3RoID0gZGF0YUFycmF5Lmxlbmd0aFxuICB2YXIgYnVmZmVyTGVuZ3RoID0gNTEyXG5cbiAgdmFyIFdJRFRIID0gMTAyNFxuICB2YXIgSEVJR0hUID0gMjU2XG5cbiAgdmFyIGJhcldpZHRoID0gKFdJRFRIIC8gYnVmZmVyTGVuZ3RoKTtcblxuICB2YXIgYmFySGVpZ2h0XG4gIHZhciB4ID0gMFxuICB2YXIgbW9kID0gMC4wXG4gIHZhciBjb3VudGVyID0gMFxuICB2YXIgaVxuXG4gIHdpbmRvdy5ieXRlX3RvX2NvZGUgPSAwXG5cbiAgLy8gY3JlYXRlIHN2Z1xuICB2YXIgc3ZnID0gZDMuc2VsZWN0KCdkaXYjY29udGFpbmVyJykuYXBwZW5kKCdzdmcnKVxuICAgIC5hdHRyKCd3aWR0aCcsV0lEVEgpXG4gICAgLmF0dHIoJ2hlaWdodCcsIEhFSUdIVClcbiAgICAuc3R5bGUoJ2JhY2tncm91bmQtY29sb3InLCAncmdiYSgwLDAsMCwwLjEpJylcblxuICB2YXIgYmFycyA9IFtdXG4gIGZvcih2YXIgc3ZnYmFycyA9IDA7IHN2Z2JhcnMgPCBidWZmZXJMZW5ndGg7IHN2Z2JhcnMrKyl7XG4gICAgdmFyIGJhciA9IHN2Zy5hcHBlbmQoJ3JlY3QnKVxuICAgICAgLmF0dHIoJ3gnLCBiYXJXaWR0aCAqIHN2Z2JhcnMpXG4gICAgICAuYXR0cigneScsIDApXG4gICAgICAuYXR0cignd2lkdGgnLCBiYXJXaWR0aClcbiAgICAgIC5hdHRyKCdoZWlnaHQnLCAwKVxuXG4gICAgbGV0IGJhcl9pZHggPSBzdmdiYXJzXG4gICAgYmFyLm9uKCdtb3VzZW92ZXInLCBmdW5jdGlvbigpe1xuICAgICAgY29uc29sZS5sb2coYmFyX2lkeClcbiAgICB9KVxuXG4gICAgYmFycy5wdXNoKGJhcilcbiAgfVxuXG4gIHZhciBwcmV2X3JhbmdlcyA9IFtdXG5cbiAgYWxpY2UuY29ubmVjdChib2IpXG4gIGJvYi5jb25uZWN0KGFsaWNlKVxuXG5cbiAgc2V0VGltZW91dChkcmF3LDIwMClcbiAgLy8gZnVuY3Rpb24gc3RhcnQoKXtcbiAgLy8gICBhbGljZS5lbmNvZGVfcmFuZ2UoMjIpXG4gIC8vICAgZHJhdygpXG4gIC8vIH1cblxuICBmdW5jdGlvbiBkcmF3KCkge1xuXG4gICAgY291bnRlcisrXG4gICAgaWYoY291bnRlciAlIDIgPT09IDApe1xuXG4gICAgICAvLyB2aXN1YWxpemUgYWxpY2VzIGJ1ZmZlciBkYXRhXG4gICAgICBkYXRhQXJyYXkgPSBhbGljZS5nZXRCdWZmZXIoKVxuXG4gICAgICBmb3IoaT0wO2k8YnVmZmVyTGVuZ3RoO2krKyl7XG4gICAgICAgIGJhcnNbaV0uYXR0cignaGVpZ2h0JywgZGF0YUFycmF5W2ldKVxuICAgICAgfVxuXG4gICAgICB2YXIgbyA9IGFsaWNlLnRpY2soKVxuXG4gICAgICBpZihvLm5ld19kYXRhKXtcbiAgICAgICAgb3V0cHV0X21zZyArPSBvLmRhdGFcbiAgICAgICAgZDMuc2VsZWN0KCdwcmUub3V0cHV0X21zZycpLmh0bWwob3V0cHV0X21zZylcbiAgICAgIH1cblxuICAgICAgYm9iLnRpY2soKVxuXG5cbiAgICAgIC8vIGlmKGJvYi5wb2xsKCkgfHwgdWRwX21vZGUpe1xuICAgICAgLy9cbiAgICAgIC8vICAgYm9iLnJlYWRfYnl0ZV9mcm9tX3NpZ25hbCgpXG4gICAgICAvLyAgIHdpbmRvdy5ieXRlX3RvX2NvZGUgPSBtZXNzYWdlX3RvX3NlbmRbbWVzc2FnZV9pZHhdLmNoYXJDb2RlQXQoMClcbiAgICAgIC8vICAgYm9iLmVuY29kZV9yYW5nZSh3aW5kb3cuYnl0ZV90b19jb2RlKVxuICAgICAgLy8gICBtZXNzYWdlX2lkeCArPSAxXG4gICAgICAvLyAgIG1lc3NhZ2VfaWR4ID0gbWVzc2FnZV9pZHggJSBtZXNzYWdlX3RvX3NlbmQubGVuZ3RoXG4gICAgICAvL1xuICAgICAgLy8gfSBlbHNlIHtcbiAgICAgIC8vICAgLy8gY29uc29sZS5sb2coJ2JvYiBtaXNzJylcbiAgICAgIC8vIH1cbiAgICAgIC8vXG4gICAgICAvLyBpZihhbGljZS5wb2xsKCkpe1xuICAgICAgLy9cbiAgICAgIC8vICAgdmFyIGFsaWNlX3JlYWRzID0gYWxpY2UucmVhZF9ieXRlX2Zyb21fc2lnbmFsKClcbiAgICAgIC8vXG4gICAgICAvLyAgIG91dHB1dF9tc2cgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShhbGljZV9yZWFkcylcbiAgICAgIC8vXG4gICAgICAvLyAgIGQzLnNlbGVjdCgnZGl2Lm91dHB1dF9tc2cnKS5odG1sKG91dHB1dF9tc2cpXG4gICAgICAvL1xuICAgICAgLy8gICBhbGljZS5lbmNvZGVfcmFuZ2UoMilcbiAgICAgIC8vXG4gICAgICAvLyB9IGVsc2Uge1xuICAgICAgLy8gICAvLyBjb25zb2xlLmxvZygnYWxpY2UgbWlzcycpXG4gICAgICAvLyB9XG5cbiAgICB9XG5cbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGRyYXcpO1xuXG4gIH1cblxuXG5cbn1cbiJdfQ==
