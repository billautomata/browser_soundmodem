(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

module.exports.agent = agent


function agent(opts) {

  (function setup_audio_context() {
    if (window.context === undefined) {
      console.log('creating new window.AudioContext()')
      window.context = new window.AudioContext()
    }
    console.log('done.')
  })()

  var MESSAGE
  var MESSAGE_IDX = 0
  var RX_BUFFER = ''
  var CONNECTED_AT

  var type

  var analyser = context.createAnalyser()
  var analyserDataArray // the buffer the analyser writes to
  var bufferLength // the length of the analyserDataArray

  var peak_ranges // flat list of indexes of detected peak ranges
  var grouped_peak_ranges // clustered groups of peak ranges
  var mean // the threshold for determining if a band is peaked

  var flip_flop = true

  var prev_high_channel = -1
  var current_high_channel = 0
  var SYNC_COUNT = 0

  var osc_bank = []
  var gain_bank = []

  var n_osc = 10
  var freqRange = 2500
  var spread = (freqRange / n_osc)
  var initialFreq = 200

  var CURRENT_STATE = -1

  function tick() {

    var ret_obj = {
      new_data: false,
      data: ''
    }

    if (CURRENT_STATE < 0) {

      // performing initialization process, do nothing
      return;

    } else {

      if (CURRENT_STATE === 0) {

        register_peak_ranges()

        if (grouped_peak_ranges.length === 10) {
          CURRENT_STATE = 1
        }

      } else if (CURRENT_STATE === 1) {

        perform_signaling()
        look_for_signaling()

        if (SYNC_COUNT > 2) {
          CURRENT_STATE = 2
          CONNECTED_AT = Date.now()
        }

      } else if (CURRENT_STATE === 2) {

        // encode byte
        var byte_to_send = MESSAGE[MESSAGE_IDX].charCodeAt(0)
        encode_byte(byte_to_send)

        if (look_for_signaling()) {

          // read byte
          RX_BUFFER += String.fromCharCode(read_byte_from_signal())

          if (type === 'client') {
            ret_obj.new_data = true
            ret_obj.data = String.fromCharCode(read_byte_from_signal())
          }

          // increment byte to encode
          MESSAGE_IDX += 1
          MESSAGE_IDX = MESSAGE_IDX % MESSAGE.length

          perform_signaling()

        }

      } // end of CURRENT_STATE === 2

    }

    return ret_obj

  }


  function look_for_signaling() {

    var valid_ranges = validate_ranges()
    if (valid_ranges[8] === true && valid_ranges[9] === false) {
      current_high_channel = 8
    } else {
      current_high_channel = 9
    }

    var difference_found = false

    if (current_high_channel !== prev_high_channel) {
      difference_found = true
      SYNC_COUNT += 1
    }

    prev_high_channel = current_high_channel

    return difference_found

  }

  function init(opts) {

    MESSAGE = opts.message
    type = opts.type

    // create osc + gain banks
    for (var idx = 0; idx < n_osc; idx++) {

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

  function connect(other_agent) {

    var other_gain_bank = other_agent.get_gain_bank()

    other_gain_bank.forEach(function (gainNode) {
      gainNode.connect(analyser)
    })

    getBuffer()

    setTimeout(function () {
      console.log('done connecting')
      CURRENT_STATE = 0
    }, 200)

  }

  function n_channels() {
    return n_osc
  }

  function get_groups() {
    return grouped_peak_ranges
  }

  function getBuffer() {
    analyser.getByteFrequencyData(analyserDataArray)
    return analyserDataArray
  }

  function get_gain_bank() {
    return gain_bank
  }

  function get_analyser() {
    return analyser
  }


  function read_byte_from_signal() {

    var ranges = validate_ranges()

    var binary_string = ''
    for (var i = 0; i < 8; i++) {
      if (ranges[i]) {
        binary_string += '1'
      } else {
        binary_string += '0'
      }
    }

    return parseInt(binary_string, 2)

  }

  function register_peak_ranges() {

    console.log('registering peak ranges')

    getBuffer()
    console.log(analyserDataArray)

    // push on to new array for sorting
    var d = []
    for (var i = 0; i < bufferLength; i++) {
      if (analyserDataArray[i] > 0) {
        d.push(analyserDataArray[i])
      }
    }
    d.sort(function (a, b) {
      return a - b
    })
    console.log('Mean: ' + d[Math.floor(d.length / 2)])

    mean = d[Math.floor(d.length / 2)]

    //
    peak_ranges = []
    for (var i = 0; i < bufferLength; i++) {
      if (analyserDataArray[i] > mean) {
        peak_ranges.push(i)
      }
    }

    // window.p = peak_ranges

    group_peak_ranges()

  }

  function check_peak_ranges() {

    getBuffer()

    var hits = []
    peak_ranges.forEach(function (dataArray_idx) {
      if (analyserDataArray[dataArray_idx] > mean) {
        hits.push(true)
      } else {
        hits.push(false)
      }
    })

    return hits

  }

  function group_peak_ranges() {

    if (peak_ranges === undefined || peak_ranges.length === 0) {
      return;
    }

    var groups = [] // [ [1,2,3], [8,9,10], [30,31,32]  ]

    var current_group_idx = 0

    var local_group = new Array()

    peak_ranges.forEach(function (peak_idx, idx) {

      // if the Math.abs(peak_idx - peak_ranges[idx+1]) === 1
      //    push peak_idx on to local_group
      // else
      //    push local_group on to groups
      //    clear local_group
      //    push peak_idx on to local_group

      if (idx === peak_ranges.length - 1) {
        // console.log('here')
        return;
      }

      if (Math.abs(peak_idx - peak_ranges[idx + 1]) <= 2) {
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

  function set_gain(channel, value) {
    gain_bank[channel].gain.value = value
  }

  function validate_ranges() {

    if (grouped_peak_ranges === undefined) {
      return;
    }

    getBuffer()

    var valid_groups = []

    grouped_peak_ranges.forEach(function (group) {

      var hits = 0

      group.forEach(function (idx) {
        if (analyserDataArray[idx] >= mean) {
          hits += 1
        }
      })

      if (hits >= group.length / 2) {
        valid_groups.push(true)
      } else {
        valid_groups.push(false)
      }

    })

    return valid_groups

  }

  function encode_byte(byte) {

    var chars = get_encoded_byte_array(byte)

    // console.log(chars)

    chars.forEach(function (c, idx) {
      if (c === '0') {
        set_gain(idx, 0)
      } else {
        set_gain(idx, 1 / n_osc)
      }
    })

  }

  function perform_signaling() {
    flip_flop = !flip_flop
    if (flip_flop) {
      set_gain(8, 1 / n_osc)
      set_gain(9, 0)
    } else {
      set_gain(9, 1 / n_osc)
      set_gain(8, 0)
    }
  }

  function get_encoded_byte_array(byte) {
    return pad(byte.toString(2), 8).split('')
  }

  function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }

  function get_state() {
    return {
      buffer: getBuffer(),
      RX_BUFFER: RX_BUFFER,
      CURRENT_STATE: CURRENT_STATE,
      SYNC_COUNT: SYNC_COUNT,
      MESSAGE: MESSAGE,
      MESSAGE_IDX: MESSAGE_IDX,
      CONNECTED_AT: CONNECTED_AT
    }
  }

  return {
    check_peak_ranges: check_peak_ranges,
    connect: connect,
    encode_range: encode_byte,
    getBuffer: getBuffer,
    get_analyser: get_analyser,
    get_encoded_byte_array: get_encoded_byte_array,
    get_gain_bank: get_gain_bank,
    get_groups: get_groups,
    get_state: get_state,
    group_peak_ranges: group_peak_ranges,
    init: init,
    n_channels: n_channels,
    set_gain: set_gain,
    read_byte_from_signal: read_byte_from_signal,
    tick: tick,
    validate_ranges: validate_ranges,
  };

}

},{}],2:[function(require,module,exports){
window.onload = function () {
  "use strict";

  var udp_mode = true

  console.log('main.js / window.onload anonymous function')

  var message_to_send = 'this is a test that the modulation / demodulation works correctly \nalso bumping the speed up to >200 baud, this rules!! \n'
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


  // create alice modem elements
  var div_alice_parent = d3.select('div#alice_modem')

  var div_state = div_alice_parent.append('div')
  var div_baud = div_alice_parent.append('div')
  var div_rx_buffer = div_alice_parent.append('pre')

  setTimeout(draw,200)

  function draw() {

    // counter++
    // if(counter % 2 === 0){

      var stats = alice.get_state()

      div_state.html('STATE: ' + stats.CURRENT_STATE)
      div_rx_buffer.html('RX BUF: ' + stats.RX_BUFFER)


      var baud = 8*(stats.RX_BUFFER.length / ((Date.now()-stats.CONNECTED_AT)/1000.0))

      div_baud.html('BAUD: ' + baud)

      dataArray = alice.getBuffer()

      for(i=0;i<bufferLength;i++){
        bars[i].attr('height', dataArray[i])
      }

      var o = alice.tick()

      // if(o.new_data){
      //   output_msg += o.data
      //   d3.select('pre.output_msg').html(output_msg)
      // }

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

    // }

    setTimeout(draw, 30)

    // window.requestAnimationFrame(draw);

  }



}

},{"./agent.js":1}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzLmFnZW50ID0gYWdlbnRcblxuXG5mdW5jdGlvbiBhZ2VudChvcHRzKSB7XG5cbiAgKGZ1bmN0aW9uIHNldHVwX2F1ZGlvX2NvbnRleHQoKSB7XG4gICAgaWYgKHdpbmRvdy5jb250ZXh0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdjcmVhdGluZyBuZXcgd2luZG93LkF1ZGlvQ29udGV4dCgpJylcbiAgICAgIHdpbmRvdy5jb250ZXh0ID0gbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKVxuICAgIH1cbiAgICBjb25zb2xlLmxvZygnZG9uZS4nKVxuICB9KSgpXG5cbiAgdmFyIE1FU1NBR0VcbiAgdmFyIE1FU1NBR0VfSURYID0gMFxuICB2YXIgUlhfQlVGRkVSID0gJydcbiAgdmFyIENPTk5FQ1RFRF9BVFxuXG4gIHZhciB0eXBlXG5cbiAgdmFyIGFuYWx5c2VyID0gY29udGV4dC5jcmVhdGVBbmFseXNlcigpXG4gIHZhciBhbmFseXNlckRhdGFBcnJheSAvLyB0aGUgYnVmZmVyIHRoZSBhbmFseXNlciB3cml0ZXMgdG9cbiAgdmFyIGJ1ZmZlckxlbmd0aCAvLyB0aGUgbGVuZ3RoIG9mIHRoZSBhbmFseXNlckRhdGFBcnJheVxuXG4gIHZhciBwZWFrX3JhbmdlcyAvLyBmbGF0IGxpc3Qgb2YgaW5kZXhlcyBvZiBkZXRlY3RlZCBwZWFrIHJhbmdlc1xuICB2YXIgZ3JvdXBlZF9wZWFrX3JhbmdlcyAvLyBjbHVzdGVyZWQgZ3JvdXBzIG9mIHBlYWsgcmFuZ2VzXG4gIHZhciBtZWFuIC8vIHRoZSB0aHJlc2hvbGQgZm9yIGRldGVybWluaW5nIGlmIGEgYmFuZCBpcyBwZWFrZWRcblxuICB2YXIgZmxpcF9mbG9wID0gdHJ1ZVxuXG4gIHZhciBwcmV2X2hpZ2hfY2hhbm5lbCA9IC0xXG4gIHZhciBjdXJyZW50X2hpZ2hfY2hhbm5lbCA9IDBcbiAgdmFyIFNZTkNfQ09VTlQgPSAwXG5cbiAgdmFyIG9zY19iYW5rID0gW11cbiAgdmFyIGdhaW5fYmFuayA9IFtdXG5cbiAgdmFyIG5fb3NjID0gMTBcbiAgdmFyIGZyZXFSYW5nZSA9IDI1MDBcbiAgdmFyIHNwcmVhZCA9IChmcmVxUmFuZ2UgLyBuX29zYylcbiAgdmFyIGluaXRpYWxGcmVxID0gMjAwXG5cbiAgdmFyIENVUlJFTlRfU1RBVEUgPSAtMVxuXG4gIGZ1bmN0aW9uIHRpY2soKSB7XG5cbiAgICB2YXIgcmV0X29iaiA9IHtcbiAgICAgIG5ld19kYXRhOiBmYWxzZSxcbiAgICAgIGRhdGE6ICcnXG4gICAgfVxuXG4gICAgaWYgKENVUlJFTlRfU1RBVEUgPCAwKSB7XG5cbiAgICAgIC8vIHBlcmZvcm1pbmcgaW5pdGlhbGl6YXRpb24gcHJvY2VzcywgZG8gbm90aGluZ1xuICAgICAgcmV0dXJuO1xuXG4gICAgfSBlbHNlIHtcblxuICAgICAgaWYgKENVUlJFTlRfU1RBVEUgPT09IDApIHtcblxuICAgICAgICByZWdpc3Rlcl9wZWFrX3JhbmdlcygpXG5cbiAgICAgICAgaWYgKGdyb3VwZWRfcGVha19yYW5nZXMubGVuZ3RoID09PSAxMCkge1xuICAgICAgICAgIENVUlJFTlRfU1RBVEUgPSAxXG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIGlmIChDVVJSRU5UX1NUQVRFID09PSAxKSB7XG5cbiAgICAgICAgcGVyZm9ybV9zaWduYWxpbmcoKVxuICAgICAgICBsb29rX2Zvcl9zaWduYWxpbmcoKVxuXG4gICAgICAgIGlmIChTWU5DX0NPVU5UID4gMikge1xuICAgICAgICAgIENVUlJFTlRfU1RBVEUgPSAyXG4gICAgICAgICAgQ09OTkVDVEVEX0FUID0gRGF0ZS5ub3coKVxuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSBpZiAoQ1VSUkVOVF9TVEFURSA9PT0gMikge1xuXG4gICAgICAgIC8vIGVuY29kZSBieXRlXG4gICAgICAgIHZhciBieXRlX3RvX3NlbmQgPSBNRVNTQUdFW01FU1NBR0VfSURYXS5jaGFyQ29kZUF0KDApXG4gICAgICAgIGVuY29kZV9ieXRlKGJ5dGVfdG9fc2VuZClcblxuICAgICAgICBpZiAobG9va19mb3Jfc2lnbmFsaW5nKCkpIHtcblxuICAgICAgICAgIC8vIHJlYWQgYnl0ZVxuICAgICAgICAgIFJYX0JVRkZFUiArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHJlYWRfYnl0ZV9mcm9tX3NpZ25hbCgpKVxuXG4gICAgICAgICAgaWYgKHR5cGUgPT09ICdjbGllbnQnKSB7XG4gICAgICAgICAgICByZXRfb2JqLm5ld19kYXRhID0gdHJ1ZVxuICAgICAgICAgICAgcmV0X29iai5kYXRhID0gU3RyaW5nLmZyb21DaGFyQ29kZShyZWFkX2J5dGVfZnJvbV9zaWduYWwoKSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBpbmNyZW1lbnQgYnl0ZSB0byBlbmNvZGVcbiAgICAgICAgICBNRVNTQUdFX0lEWCArPSAxXG4gICAgICAgICAgTUVTU0FHRV9JRFggPSBNRVNTQUdFX0lEWCAlIE1FU1NBR0UubGVuZ3RoXG5cbiAgICAgICAgICBwZXJmb3JtX3NpZ25hbGluZygpXG5cbiAgICAgICAgfVxuXG4gICAgICB9IC8vIGVuZCBvZiBDVVJSRU5UX1NUQVRFID09PSAyXG5cbiAgICB9XG5cbiAgICByZXR1cm4gcmV0X29ialxuXG4gIH1cblxuXG4gIGZ1bmN0aW9uIGxvb2tfZm9yX3NpZ25hbGluZygpIHtcblxuICAgIHZhciB2YWxpZF9yYW5nZXMgPSB2YWxpZGF0ZV9yYW5nZXMoKVxuICAgIGlmICh2YWxpZF9yYW5nZXNbOF0gPT09IHRydWUgJiYgdmFsaWRfcmFuZ2VzWzldID09PSBmYWxzZSkge1xuICAgICAgY3VycmVudF9oaWdoX2NoYW5uZWwgPSA4XG4gICAgfSBlbHNlIHtcbiAgICAgIGN1cnJlbnRfaGlnaF9jaGFubmVsID0gOVxuICAgIH1cblxuICAgIHZhciBkaWZmZXJlbmNlX2ZvdW5kID0gZmFsc2VcblxuICAgIGlmIChjdXJyZW50X2hpZ2hfY2hhbm5lbCAhPT0gcHJldl9oaWdoX2NoYW5uZWwpIHtcbiAgICAgIGRpZmZlcmVuY2VfZm91bmQgPSB0cnVlXG4gICAgICBTWU5DX0NPVU5UICs9IDFcbiAgICB9XG5cbiAgICBwcmV2X2hpZ2hfY2hhbm5lbCA9IGN1cnJlbnRfaGlnaF9jaGFubmVsXG5cbiAgICByZXR1cm4gZGlmZmVyZW5jZV9mb3VuZFxuXG4gIH1cblxuICBmdW5jdGlvbiBpbml0KG9wdHMpIHtcblxuICAgIE1FU1NBR0UgPSBvcHRzLm1lc3NhZ2VcbiAgICB0eXBlID0gb3B0cy50eXBlXG5cbiAgICAvLyBjcmVhdGUgb3NjICsgZ2FpbiBiYW5rc1xuICAgIGZvciAodmFyIGlkeCA9IDA7IGlkeCA8IG5fb3NjOyBpZHgrKykge1xuXG4gICAgICBsZXQgbG9jYWxfb3NjID0gY29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKClcbiAgICAgIGxvY2FsX29zYy5mcmVxdWVuY3kudmFsdWUgPSAoaWR4ICogc3ByZWFkKSArIGluaXRpYWxGcmVxXG5cbiAgICAgIGxldCBsb2NhbF9nYWluID0gY29udGV4dC5jcmVhdGVHYWluKClcbiAgICAgIGxvY2FsX2dhaW4uZ2Fpbi52YWx1ZSA9IDEuMCAvIChuX29zYylcblxuICAgICAgbG9jYWxfb3NjLmNvbm5lY3QobG9jYWxfZ2FpbilcblxuICAgICAgLy8gbG9jYWxfZ2Fpbi5jb25uZWN0KGFuYWx5c2VyKVxuICAgICAgbG9jYWxfZ2Fpbi5jb25uZWN0KGNvbnRleHQuZGVzdGluYXRpb24pXG5cbiAgICAgIGxvY2FsX29zYy5zdGFydCgpXG5cbiAgICAgIG9zY19iYW5rLnB1c2gobG9jYWxfb3NjKVxuICAgICAgZ2Fpbl9iYW5rLnB1c2gobG9jYWxfZ2FpbilcblxuICAgIH1cblxuICAgIC8vIGFuYWx5c2VyLm5hbWUgPSBuYW1lXG4gICAgYW5hbHlzZXIuZmZ0U2l6ZSA9IDEwMjRcbiAgICBhbmFseXNlci5zbW9vdGhpbmdUaW1lQ29uc3RhbnQgPSAwXG4gICAgYnVmZmVyTGVuZ3RoID0gYW5hbHlzZXIuZnJlcXVlbmN5QmluQ291bnRcbiAgICBhbmFseXNlckRhdGFBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlckxlbmd0aClcblxuXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbm5lY3Qob3RoZXJfYWdlbnQpIHtcblxuICAgIHZhciBvdGhlcl9nYWluX2JhbmsgPSBvdGhlcl9hZ2VudC5nZXRfZ2Fpbl9iYW5rKClcblxuICAgIG90aGVyX2dhaW5fYmFuay5mb3JFYWNoKGZ1bmN0aW9uIChnYWluTm9kZSkge1xuICAgICAgZ2Fpbk5vZGUuY29ubmVjdChhbmFseXNlcilcbiAgICB9KVxuXG4gICAgZ2V0QnVmZmVyKClcblxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgY29uc29sZS5sb2coJ2RvbmUgY29ubmVjdGluZycpXG4gICAgICBDVVJSRU5UX1NUQVRFID0gMFxuICAgIH0sIDIwMClcblxuICB9XG5cbiAgZnVuY3Rpb24gbl9jaGFubmVscygpIHtcbiAgICByZXR1cm4gbl9vc2NcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9ncm91cHMoKSB7XG4gICAgcmV0dXJuIGdyb3VwZWRfcGVha19yYW5nZXNcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEJ1ZmZlcigpIHtcbiAgICBhbmFseXNlci5nZXRCeXRlRnJlcXVlbmN5RGF0YShhbmFseXNlckRhdGFBcnJheSlcbiAgICByZXR1cm4gYW5hbHlzZXJEYXRhQXJyYXlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9nYWluX2JhbmsoKSB7XG4gICAgcmV0dXJuIGdhaW5fYmFua1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2FuYWx5c2VyKCkge1xuICAgIHJldHVybiBhbmFseXNlclxuICB9XG5cblxuICBmdW5jdGlvbiByZWFkX2J5dGVfZnJvbV9zaWduYWwoKSB7XG5cbiAgICB2YXIgcmFuZ2VzID0gdmFsaWRhdGVfcmFuZ2VzKClcblxuICAgIHZhciBiaW5hcnlfc3RyaW5nID0gJydcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IDg7IGkrKykge1xuICAgICAgaWYgKHJhbmdlc1tpXSkge1xuICAgICAgICBiaW5hcnlfc3RyaW5nICs9ICcxJ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYmluYXJ5X3N0cmluZyArPSAnMCdcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcGFyc2VJbnQoYmluYXJ5X3N0cmluZywgMilcblxuICB9XG5cbiAgZnVuY3Rpb24gcmVnaXN0ZXJfcGVha19yYW5nZXMoKSB7XG5cbiAgICBjb25zb2xlLmxvZygncmVnaXN0ZXJpbmcgcGVhayByYW5nZXMnKVxuXG4gICAgZ2V0QnVmZmVyKClcbiAgICBjb25zb2xlLmxvZyhhbmFseXNlckRhdGFBcnJheSlcblxuICAgIC8vIHB1c2ggb24gdG8gbmV3IGFycmF5IGZvciBzb3J0aW5nXG4gICAgdmFyIGQgPSBbXVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyTGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhbmFseXNlckRhdGFBcnJheVtpXSA+IDApIHtcbiAgICAgICAgZC5wdXNoKGFuYWx5c2VyRGF0YUFycmF5W2ldKVxuICAgICAgfVxuICAgIH1cbiAgICBkLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIHJldHVybiBhIC0gYlxuICAgIH0pXG4gICAgY29uc29sZS5sb2coJ01lYW46ICcgKyBkW01hdGguZmxvb3IoZC5sZW5ndGggLyAyKV0pXG5cbiAgICBtZWFuID0gZFtNYXRoLmZsb29yKGQubGVuZ3RoIC8gMildXG5cbiAgICAvL1xuICAgIHBlYWtfcmFuZ2VzID0gW11cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYW5hbHlzZXJEYXRhQXJyYXlbaV0gPiBtZWFuKSB7XG4gICAgICAgIHBlYWtfcmFuZ2VzLnB1c2goaSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB3aW5kb3cucCA9IHBlYWtfcmFuZ2VzXG5cbiAgICBncm91cF9wZWFrX3JhbmdlcygpXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNoZWNrX3BlYWtfcmFuZ2VzKCkge1xuXG4gICAgZ2V0QnVmZmVyKClcblxuICAgIHZhciBoaXRzID0gW11cbiAgICBwZWFrX3Jhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uIChkYXRhQXJyYXlfaWR4KSB7XG4gICAgICBpZiAoYW5hbHlzZXJEYXRhQXJyYXlbZGF0YUFycmF5X2lkeF0gPiBtZWFuKSB7XG4gICAgICAgIGhpdHMucHVzaCh0cnVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaGl0cy5wdXNoKGZhbHNlKVxuICAgICAgfVxuICAgIH0pXG5cbiAgICByZXR1cm4gaGl0c1xuXG4gIH1cblxuICBmdW5jdGlvbiBncm91cF9wZWFrX3JhbmdlcygpIHtcblxuICAgIGlmIChwZWFrX3JhbmdlcyA9PT0gdW5kZWZpbmVkIHx8IHBlYWtfcmFuZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBncm91cHMgPSBbXSAvLyBbIFsxLDIsM10sIFs4LDksMTBdLCBbMzAsMzEsMzJdICBdXG5cbiAgICB2YXIgY3VycmVudF9ncm91cF9pZHggPSAwXG5cbiAgICB2YXIgbG9jYWxfZ3JvdXAgPSBuZXcgQXJyYXkoKVxuXG4gICAgcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbiAocGVha19pZHgsIGlkeCkge1xuXG4gICAgICAvLyBpZiB0aGUgTWF0aC5hYnMocGVha19pZHggLSBwZWFrX3Jhbmdlc1tpZHgrMV0pID09PSAxXG4gICAgICAvLyAgICBwdXNoIHBlYWtfaWR4IG9uIHRvIGxvY2FsX2dyb3VwXG4gICAgICAvLyBlbHNlXG4gICAgICAvLyAgICBwdXNoIGxvY2FsX2dyb3VwIG9uIHRvIGdyb3Vwc1xuICAgICAgLy8gICAgY2xlYXIgbG9jYWxfZ3JvdXBcbiAgICAgIC8vICAgIHB1c2ggcGVha19pZHggb24gdG8gbG9jYWxfZ3JvdXBcblxuICAgICAgaWYgKGlkeCA9PT0gcGVha19yYW5nZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZygnaGVyZScpXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4ICsgMV0pIDw9IDIpIHtcbiAgICAgICAgbG9jYWxfZ3JvdXAucHVzaChwZWFrX2lkeClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgICAgIGdyb3Vwcy5wdXNoKGxvY2FsX2dyb3VwKVxuICAgICAgICBsb2NhbF9ncm91cCA9IG5ldyBBcnJheSgpXG4gICAgICB9XG5cbiAgICB9KVxuXG4gICAgZ3JvdXBzLnB1c2gobG9jYWxfZ3JvdXApXG5cbiAgICBncm91cGVkX3BlYWtfcmFuZ2VzID0gZ3JvdXBzXG5cbiAgICByZXR1cm4gZ3JvdXBzXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9nYWluKGNoYW5uZWwsIHZhbHVlKSB7XG4gICAgZ2Fpbl9iYW5rW2NoYW5uZWxdLmdhaW4udmFsdWUgPSB2YWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVfcmFuZ2VzKCkge1xuXG4gICAgaWYgKGdyb3VwZWRfcGVha19yYW5nZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGdldEJ1ZmZlcigpXG5cbiAgICB2YXIgdmFsaWRfZ3JvdXBzID0gW11cblxuICAgIGdyb3VwZWRfcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbiAoZ3JvdXApIHtcblxuICAgICAgdmFyIGhpdHMgPSAwXG5cbiAgICAgIGdyb3VwLmZvckVhY2goZnVuY3Rpb24gKGlkeCkge1xuICAgICAgICBpZiAoYW5hbHlzZXJEYXRhQXJyYXlbaWR4XSA+PSBtZWFuKSB7XG4gICAgICAgICAgaGl0cyArPSAxXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIGlmIChoaXRzID49IGdyb3VwLmxlbmd0aCAvIDIpIHtcbiAgICAgICAgdmFsaWRfZ3JvdXBzLnB1c2godHJ1ZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbGlkX2dyb3Vwcy5wdXNoKGZhbHNlKVxuICAgICAgfVxuXG4gICAgfSlcblxuICAgIHJldHVybiB2YWxpZF9ncm91cHNcblxuICB9XG5cbiAgZnVuY3Rpb24gZW5jb2RlX2J5dGUoYnl0ZSkge1xuXG4gICAgdmFyIGNoYXJzID0gZ2V0X2VuY29kZWRfYnl0ZV9hcnJheShieXRlKVxuXG4gICAgLy8gY29uc29sZS5sb2coY2hhcnMpXG5cbiAgICBjaGFycy5mb3JFYWNoKGZ1bmN0aW9uIChjLCBpZHgpIHtcbiAgICAgIGlmIChjID09PSAnMCcpIHtcbiAgICAgICAgc2V0X2dhaW4oaWR4LCAwKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0X2dhaW4oaWR4LCAxIC8gbl9vc2MpXG4gICAgICB9XG4gICAgfSlcblxuICB9XG5cbiAgZnVuY3Rpb24gcGVyZm9ybV9zaWduYWxpbmcoKSB7XG4gICAgZmxpcF9mbG9wID0gIWZsaXBfZmxvcFxuICAgIGlmIChmbGlwX2Zsb3ApIHtcbiAgICAgIHNldF9nYWluKDgsIDEgLyBuX29zYylcbiAgICAgIHNldF9nYWluKDksIDApXG4gICAgfSBlbHNlIHtcbiAgICAgIHNldF9nYWluKDksIDEgLyBuX29zYylcbiAgICAgIHNldF9nYWluKDgsIDApXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2VuY29kZWRfYnl0ZV9hcnJheShieXRlKSB7XG4gICAgcmV0dXJuIHBhZChieXRlLnRvU3RyaW5nKDIpLCA4KS5zcGxpdCgnJylcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhZChuLCB3aWR0aCwgeikge1xuICAgIHogPSB6IHx8ICcwJztcbiAgICBuID0gbiArICcnO1xuICAgIHJldHVybiBuLmxlbmd0aCA+PSB3aWR0aCA/IG4gOiBuZXcgQXJyYXkod2lkdGggLSBuLmxlbmd0aCArIDEpLmpvaW4oeikgKyBuO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3N0YXRlKCkge1xuICAgIHJldHVybiB7XG4gICAgICBidWZmZXI6IGdldEJ1ZmZlcigpLFxuICAgICAgUlhfQlVGRkVSOiBSWF9CVUZGRVIsXG4gICAgICBDVVJSRU5UX1NUQVRFOiBDVVJSRU5UX1NUQVRFLFxuICAgICAgU1lOQ19DT1VOVDogU1lOQ19DT1VOVCxcbiAgICAgIE1FU1NBR0U6IE1FU1NBR0UsXG4gICAgICBNRVNTQUdFX0lEWDogTUVTU0FHRV9JRFgsXG4gICAgICBDT05ORUNURURfQVQ6IENPTk5FQ1RFRF9BVFxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY2hlY2tfcGVha19yYW5nZXM6IGNoZWNrX3BlYWtfcmFuZ2VzLFxuICAgIGNvbm5lY3Q6IGNvbm5lY3QsXG4gICAgZW5jb2RlX3JhbmdlOiBlbmNvZGVfYnl0ZSxcbiAgICBnZXRCdWZmZXI6IGdldEJ1ZmZlcixcbiAgICBnZXRfYW5hbHlzZXI6IGdldF9hbmFseXNlcixcbiAgICBnZXRfZW5jb2RlZF9ieXRlX2FycmF5OiBnZXRfZW5jb2RlZF9ieXRlX2FycmF5LFxuICAgIGdldF9nYWluX2Jhbms6IGdldF9nYWluX2JhbmssXG4gICAgZ2V0X2dyb3VwczogZ2V0X2dyb3VwcyxcbiAgICBnZXRfc3RhdGU6IGdldF9zdGF0ZSxcbiAgICBncm91cF9wZWFrX3JhbmdlczogZ3JvdXBfcGVha19yYW5nZXMsXG4gICAgaW5pdDogaW5pdCxcbiAgICBuX2NoYW5uZWxzOiBuX2NoYW5uZWxzLFxuICAgIHNldF9nYWluOiBzZXRfZ2FpbixcbiAgICByZWFkX2J5dGVfZnJvbV9zaWduYWw6IHJlYWRfYnl0ZV9mcm9tX3NpZ25hbCxcbiAgICB0aWNrOiB0aWNrLFxuICAgIHZhbGlkYXRlX3JhbmdlczogdmFsaWRhdGVfcmFuZ2VzLFxuICB9O1xuXG59XG4iLCJ3aW5kb3cub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgdWRwX21vZGUgPSB0cnVlXG5cbiAgY29uc29sZS5sb2coJ21haW4uanMgLyB3aW5kb3cub25sb2FkIGFub255bW91cyBmdW5jdGlvbicpXG5cbiAgdmFyIG1lc3NhZ2VfdG9fc2VuZCA9ICd0aGlzIGlzIGEgdGVzdCB0aGF0IHRoZSBtb2R1bGF0aW9uIC8gZGVtb2R1bGF0aW9uIHdvcmtzIGNvcnJlY3RseSBcXG5hbHNvIGJ1bXBpbmcgdGhlIHNwZWVkIHVwIHRvID4yMDAgYmF1ZCwgdGhpcyBydWxlcyEhIFxcbidcbiAgdmFyIG91dHB1dF9tc2cgPSAnJ1xuXG4gIHZhciBBZ2VudCA9IHJlcXVpcmUoJy4vYWdlbnQuanMnKVxuXG4gIHdpbmRvdy5hbGljZSA9IEFnZW50LmFnZW50KClcbiAgYWxpY2UuaW5pdCh7XG4gICAgdHlwZTogJ2NsaWVudCcsXG4gICAgbWVzc2FnZTogJ2ZmZmYnXG4gIH0pXG5cbiAgd2luZG93LmJvYiA9IEFnZW50LmFnZW50KClcbiAgYm9iLmluaXQoe1xuICAgIHR5cGU6ICdzZXJ2ZXInLFxuICAgIG1lc3NhZ2U6IG1lc3NhZ2VfdG9fc2VuZFxuICB9KVxuXG4gIHZhciBkYXRhQXJyYXkgPSBhbGljZS5nZXRCdWZmZXIoKVxuICAvLyB2YXIgYnVmZmVyTGVuZ3RoID0gZGF0YUFycmF5Lmxlbmd0aFxuICB2YXIgYnVmZmVyTGVuZ3RoID0gNTEyXG5cbiAgdmFyIFdJRFRIID0gMTAyNFxuICB2YXIgSEVJR0hUID0gMjU2XG5cbiAgdmFyIGJhcldpZHRoID0gKFdJRFRIIC8gYnVmZmVyTGVuZ3RoKTtcblxuICB2YXIgYmFySGVpZ2h0XG4gIHZhciB4ID0gMFxuICB2YXIgbW9kID0gMC4wXG4gIHZhciBjb3VudGVyID0gMFxuICB2YXIgaVxuXG4gIHdpbmRvdy5ieXRlX3RvX2NvZGUgPSAwXG5cbiAgLy8gY3JlYXRlIHN2Z1xuICB2YXIgc3ZnID0gZDMuc2VsZWN0KCdkaXYjY29udGFpbmVyJykuYXBwZW5kKCdzdmcnKVxuICAgIC5hdHRyKCd3aWR0aCcsV0lEVEgpXG4gICAgLmF0dHIoJ2hlaWdodCcsIEhFSUdIVClcbiAgICAuc3R5bGUoJ2JhY2tncm91bmQtY29sb3InLCAncmdiYSgwLDAsMCwwLjEpJylcblxuICB2YXIgYmFycyA9IFtdXG4gIGZvcih2YXIgc3ZnYmFycyA9IDA7IHN2Z2JhcnMgPCBidWZmZXJMZW5ndGg7IHN2Z2JhcnMrKyl7XG4gICAgdmFyIGJhciA9IHN2Zy5hcHBlbmQoJ3JlY3QnKVxuICAgICAgLmF0dHIoJ3gnLCBiYXJXaWR0aCAqIHN2Z2JhcnMpXG4gICAgICAuYXR0cigneScsIDApXG4gICAgICAuYXR0cignd2lkdGgnLCBiYXJXaWR0aClcbiAgICAgIC5hdHRyKCdoZWlnaHQnLCAwKVxuXG4gICAgbGV0IGJhcl9pZHggPSBzdmdiYXJzXG4gICAgYmFyLm9uKCdtb3VzZW92ZXInLCBmdW5jdGlvbigpe1xuICAgICAgY29uc29sZS5sb2coYmFyX2lkeClcbiAgICB9KVxuXG4gICAgYmFycy5wdXNoKGJhcilcbiAgfVxuXG4gIHZhciBwcmV2X3JhbmdlcyA9IFtdXG5cbiAgYWxpY2UuY29ubmVjdChib2IpXG4gIGJvYi5jb25uZWN0KGFsaWNlKVxuXG5cbiAgLy8gY3JlYXRlIGFsaWNlIG1vZGVtIGVsZW1lbnRzXG4gIHZhciBkaXZfYWxpY2VfcGFyZW50ID0gZDMuc2VsZWN0KCdkaXYjYWxpY2VfbW9kZW0nKVxuXG4gIHZhciBkaXZfc3RhdGUgPSBkaXZfYWxpY2VfcGFyZW50LmFwcGVuZCgnZGl2JylcbiAgdmFyIGRpdl9iYXVkID0gZGl2X2FsaWNlX3BhcmVudC5hcHBlbmQoJ2RpdicpXG4gIHZhciBkaXZfcnhfYnVmZmVyID0gZGl2X2FsaWNlX3BhcmVudC5hcHBlbmQoJ3ByZScpXG5cbiAgc2V0VGltZW91dChkcmF3LDIwMClcblxuICBmdW5jdGlvbiBkcmF3KCkge1xuXG4gICAgLy8gY291bnRlcisrXG4gICAgLy8gaWYoY291bnRlciAlIDIgPT09IDApe1xuXG4gICAgICB2YXIgc3RhdHMgPSBhbGljZS5nZXRfc3RhdGUoKVxuXG4gICAgICBkaXZfc3RhdGUuaHRtbCgnU1RBVEU6ICcgKyBzdGF0cy5DVVJSRU5UX1NUQVRFKVxuICAgICAgZGl2X3J4X2J1ZmZlci5odG1sKCdSWCBCVUY6ICcgKyBzdGF0cy5SWF9CVUZGRVIpXG5cblxuICAgICAgdmFyIGJhdWQgPSA4KihzdGF0cy5SWF9CVUZGRVIubGVuZ3RoIC8gKChEYXRlLm5vdygpLXN0YXRzLkNPTk5FQ1RFRF9BVCkvMTAwMC4wKSlcblxuICAgICAgZGl2X2JhdWQuaHRtbCgnQkFVRDogJyArIGJhdWQpXG5cbiAgICAgIGRhdGFBcnJheSA9IGFsaWNlLmdldEJ1ZmZlcigpXG5cbiAgICAgIGZvcihpPTA7aTxidWZmZXJMZW5ndGg7aSsrKXtcbiAgICAgICAgYmFyc1tpXS5hdHRyKCdoZWlnaHQnLCBkYXRhQXJyYXlbaV0pXG4gICAgICB9XG5cbiAgICAgIHZhciBvID0gYWxpY2UudGljaygpXG5cbiAgICAgIC8vIGlmKG8ubmV3X2RhdGEpe1xuICAgICAgLy8gICBvdXRwdXRfbXNnICs9IG8uZGF0YVxuICAgICAgLy8gICBkMy5zZWxlY3QoJ3ByZS5vdXRwdXRfbXNnJykuaHRtbChvdXRwdXRfbXNnKVxuICAgICAgLy8gfVxuXG4gICAgICBib2IudGljaygpXG5cblxuICAgICAgLy8gaWYoYm9iLnBvbGwoKSB8fCB1ZHBfbW9kZSl7XG4gICAgICAvL1xuICAgICAgLy8gICBib2IucmVhZF9ieXRlX2Zyb21fc2lnbmFsKClcbiAgICAgIC8vICAgd2luZG93LmJ5dGVfdG9fY29kZSA9IG1lc3NhZ2VfdG9fc2VuZFttZXNzYWdlX2lkeF0uY2hhckNvZGVBdCgwKVxuICAgICAgLy8gICBib2IuZW5jb2RlX3JhbmdlKHdpbmRvdy5ieXRlX3RvX2NvZGUpXG4gICAgICAvLyAgIG1lc3NhZ2VfaWR4ICs9IDFcbiAgICAgIC8vICAgbWVzc2FnZV9pZHggPSBtZXNzYWdlX2lkeCAlIG1lc3NhZ2VfdG9fc2VuZC5sZW5ndGhcbiAgICAgIC8vXG4gICAgICAvLyB9IGVsc2Uge1xuICAgICAgLy8gICAvLyBjb25zb2xlLmxvZygnYm9iIG1pc3MnKVxuICAgICAgLy8gfVxuICAgICAgLy9cbiAgICAgIC8vIGlmKGFsaWNlLnBvbGwoKSl7XG4gICAgICAvL1xuICAgICAgLy8gICB2YXIgYWxpY2VfcmVhZHMgPSBhbGljZS5yZWFkX2J5dGVfZnJvbV9zaWduYWwoKVxuICAgICAgLy9cbiAgICAgIC8vICAgb3V0cHV0X21zZyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGFsaWNlX3JlYWRzKVxuICAgICAgLy9cbiAgICAgIC8vICAgZDMuc2VsZWN0KCdkaXYub3V0cHV0X21zZycpLmh0bWwob3V0cHV0X21zZylcbiAgICAgIC8vXG4gICAgICAvLyAgIGFsaWNlLmVuY29kZV9yYW5nZSgyKVxuICAgICAgLy9cbiAgICAgIC8vIH0gZWxzZSB7XG4gICAgICAvLyAgIC8vIGNvbnNvbGUubG9nKCdhbGljZSBtaXNzJylcbiAgICAgIC8vIH1cblxuICAgIC8vIH1cblxuICAgIHNldFRpbWVvdXQoZHJhdywgMzApXG5cbiAgICAvLyB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGRyYXcpO1xuXG4gIH1cblxuXG5cbn1cbiJdfQ==
