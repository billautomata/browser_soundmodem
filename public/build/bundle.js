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

  var localAnalyser = context.createAnalyser()
  var localAnalyserDataArray // the buffer the analyser writes to

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

      local_gain.connect(localAnalyser)
      // local_gain.connect(context.destination)

      local_osc.start()

      osc_bank.push(local_osc)
      gain_bank.push(local_gain)

    }

    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0
    bufferLength = analyser.frequencyBinCount
    analyserDataArray = new Uint8Array(bufferLength)

    localAnalyser.fftSize = 1024
    localAnalyser.smoothingTimeConstant = 0
    localAnalyserDataArray = new Uint8Array(bufferLength)

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

  function set_message(msg){
    MESSAGE = msg
    MESSAGE_IDX = 0
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
  function get_local_frequency_data_buffer() {
    localAnalyser.getByteFrequencyData(localAnalyserDataArray)
    return localAnalyserDataArray
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
      local_buffer: get_local_frequency_data_buffer(),
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
    get_local_frequency_data_buffer: get_local_frequency_data_buffer,
    get_state: get_state,
    group_peak_ranges: group_peak_ranges,
    init: init,
    n_channels: n_channels,
    set_gain: set_gain,
    set_message: set_message,
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
  var View_Controller = require('./view_controller.js')

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

  var display = View_Controller.view_controller('alice_modem')
  display.connect(alice)

  var dataArray = alice.getBuffer()
    // var bufferLength = dataArray.length
  var bufferLength = 512



  window.byte_to_code = 0



  var prev_ranges = []

  alice.connect(bob)
  bob.connect(alice)

  // create alice modem elements
  // var div_alice_parent = d3.select('div#alice_modem')
  //
  // var div_state = div_alice_parent.append('div')
  // var div_baud = div_alice_parent.append('div')
  // var div_rx_buffer = div_alice_parent.append('pre')

  setTimeout(draw, 200)

  function draw() {

    var stats = alice.get_state()

    // div_state.html('STATE: ' + stats.CURRENT_STATE)
    // div_rx_buffer.html('RX BUF: ' + stats.RX_BUFFER)
    //
    // var baud = 8 * (stats.RX_BUFFER.length / ((Date.now() - stats.CONNECTED_AT) / 1000.0))
    //
    // div_baud.html('BAUD: ' + baud)

    dataArray = alice.getBuffer()


    var o = alice.tick()

    // if(o.new_data){
    //   output_msg += o.data
    //   d3.select('pre.output_msg').html(output_msg)
    // }

    bob.tick()

    display.tick()

    setTimeout(draw, 30)

    // window.requestAnimationFrame(draw);

  }



}

},{"./agent.js":1,"./view_controller.js":3}],3:[function(require,module,exports){
module.exports.view_controller = view_controller

function view_controller(div_id){

  "use strict";

  var agent
  var parent = d3.select('div#'+div_id)

  // display
  //    current state
  //    sync count
  //    oscilloscope of output & input
  //    fft bars of output & input
  //    current baud
  //    rx buffer

  var svg
  var div_sync_count
  var sync_indicator
  var div_rx_buffer
  var div_baud_meter
  var bars = []

  var WIDTH = 1024
  var HEIGHT = 256

  var barWidth
  var bufferLength
  // var barHeight

  // create svg
  function setup_svg(){

    WIDTH = bufferLength
    HEIGHT = WIDTH /4

    barWidth = (WIDTH / bufferLength)

    svg = parent.append('svg')
      .attr('class', 'img-responsive')
      .attr('width', '100%')
      // .attr('height', HEIGHT)
      .attr('preserveAspectRatio', 'xMidYMid')
      .attr('viewBox', '0 0 ' + WIDTH + ' ' + HEIGHT)
      .style('background-color', 'rgba(0,0,0,0.1)')

    bars = []
    for (var svgbars = 0; svgbars < bufferLength; svgbars++) {
      var bar = svg.append('rect')
        .attr('x', barWidth * svgbars)
        .attr('y', 0)
        .attr('width', barWidth)
        .attr('height', 0)
        .attr('fill', 'green')
        .attr('stroke', 'none')

      let bar_idx = svgbars
      bar.on('mouseover', function () {
        console.log(bar_idx)
      })

      bars.push(bar)
    }

    // sync count
    div_sync_count = parent.append('div')
      .attr('class','col-md-4')
      .style('outline', '1px dotted rgba(0,0,0,0.1)')

    div_sync_count.append('h4').attr('class', 'text-center').html('synchronization counts')
    sync_indicator = div_sync_count.append('div').attr('class', 'text-center sync_count')

    // baud meter
    var parent_baud_meter = parent.append('div').attr('class','col-md-4')
      .style('outline', '1px dotted rgba(0,0,0,0.1)')

    parent_baud_meter.append('h4').attr('class', 'text-center').html('baud')
    div_baud_meter = parent_baud_meter.append('div').attr('class', 'text-center')

    // rx buffer
    var div_rx_buffer_parent = parent.append('div')
      .attr('class', 'col-md-12')

    div_rx_buffer = div_rx_buffer_parent.append('pre').attr('class', 'rx_buffer')

  }

  function connect(remote_agent){
    agent = remote_agent
    bufferLength = remote_agent.get_state().buffer.length
  }

  function tick(){

    var state = agent.get_state()

    var dataArray = state.buffer

    if(bars.length === 0){
      console.log(Object.keys(state))
      setup_svg()
      return;
    } else {
      for (var i = 0; i < bufferLength; i++) {
        bars[i].attr('height', (dataArray[i]/255) * HEIGHT)
      }
    }

    sync_indicator.html(state.SYNC_COUNT)
    div_rx_buffer.html(state.RX_BUFFER)

    var baud = 8 * (state.RX_BUFFER.length / ((Date.now() - state.CONNECTED_AT) / 1000.0))
    div_baud_meter.html(baud.toFixed(2))

    //
    // console.log(agent.get_state().SYNC_COUNT)

  }

  return {
    tick: tick,
    connect: connect
  }

}

},{}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyIsInB1YmxpYy9qcy92aWV3X2NvbnRyb2xsZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuXG5tb2R1bGUuZXhwb3J0cy5hZ2VudCA9IGFnZW50XG5cblxuZnVuY3Rpb24gYWdlbnQob3B0cykge1xuXG4gIChmdW5jdGlvbiBzZXR1cF9hdWRpb19jb250ZXh0KCkge1xuICAgIGlmICh3aW5kb3cuY29udGV4dCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zb2xlLmxvZygnY3JlYXRpbmcgbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKScpXG4gICAgICB3aW5kb3cuY29udGV4dCA9IG5ldyB3aW5kb3cuQXVkaW9Db250ZXh0KClcbiAgICB9XG4gICAgY29uc29sZS5sb2coJ2RvbmUuJylcbiAgfSkoKVxuXG4gIHZhciBNRVNTQUdFXG4gIHZhciBNRVNTQUdFX0lEWCA9IDBcbiAgdmFyIFJYX0JVRkZFUiA9ICcnXG4gIHZhciBDT05ORUNURURfQVRcblxuICB2YXIgdHlwZVxuXG4gIHZhciBhbmFseXNlciA9IGNvbnRleHQuY3JlYXRlQW5hbHlzZXIoKVxuICB2YXIgYW5hbHlzZXJEYXRhQXJyYXkgLy8gdGhlIGJ1ZmZlciB0aGUgYW5hbHlzZXIgd3JpdGVzIHRvXG4gIHZhciBidWZmZXJMZW5ndGggLy8gdGhlIGxlbmd0aCBvZiB0aGUgYW5hbHlzZXJEYXRhQXJyYXlcblxuICB2YXIgbG9jYWxBbmFseXNlciA9IGNvbnRleHQuY3JlYXRlQW5hbHlzZXIoKVxuICB2YXIgbG9jYWxBbmFseXNlckRhdGFBcnJheSAvLyB0aGUgYnVmZmVyIHRoZSBhbmFseXNlciB3cml0ZXMgdG9cblxuICB2YXIgcGVha19yYW5nZXMgLy8gZmxhdCBsaXN0IG9mIGluZGV4ZXMgb2YgZGV0ZWN0ZWQgcGVhayByYW5nZXNcbiAgdmFyIGdyb3VwZWRfcGVha19yYW5nZXMgLy8gY2x1c3RlcmVkIGdyb3VwcyBvZiBwZWFrIHJhbmdlc1xuICB2YXIgbWVhbiAvLyB0aGUgdGhyZXNob2xkIGZvciBkZXRlcm1pbmluZyBpZiBhIGJhbmQgaXMgcGVha2VkXG5cbiAgdmFyIGZsaXBfZmxvcCA9IHRydWVcblxuICB2YXIgcHJldl9oaWdoX2NoYW5uZWwgPSAtMVxuICB2YXIgY3VycmVudF9oaWdoX2NoYW5uZWwgPSAwXG4gIHZhciBTWU5DX0NPVU5UID0gMFxuXG4gIHZhciBvc2NfYmFuayA9IFtdXG4gIHZhciBnYWluX2JhbmsgPSBbXVxuXG4gIHZhciBuX29zYyA9IDEwXG4gIHZhciBmcmVxUmFuZ2UgPSAyNTAwXG4gIHZhciBzcHJlYWQgPSAoZnJlcVJhbmdlIC8gbl9vc2MpXG4gIHZhciBpbml0aWFsRnJlcSA9IDIwMFxuXG4gIHZhciBDVVJSRU5UX1NUQVRFID0gLTFcblxuICBmdW5jdGlvbiB0aWNrKCkge1xuXG4gICAgdmFyIHJldF9vYmogPSB7XG4gICAgICBuZXdfZGF0YTogZmFsc2UsXG4gICAgICBkYXRhOiAnJ1xuICAgIH1cblxuICAgIGlmIChDVVJSRU5UX1NUQVRFIDwgMCkge1xuXG4gICAgICAvLyBwZXJmb3JtaW5nIGluaXRpYWxpemF0aW9uIHByb2Nlc3MsIGRvIG5vdGhpbmdcbiAgICAgIHJldHVybjtcblxuICAgIH0gZWxzZSB7XG5cbiAgICAgIGlmIChDVVJSRU5UX1NUQVRFID09PSAwKSB7XG5cbiAgICAgICAgcmVnaXN0ZXJfcGVha19yYW5nZXMoKVxuXG4gICAgICAgIGlmIChncm91cGVkX3BlYWtfcmFuZ2VzLmxlbmd0aCA9PT0gMTApIHtcbiAgICAgICAgICBDVVJSRU5UX1NUQVRFID0gMVxuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSBpZiAoQ1VSUkVOVF9TVEFURSA9PT0gMSkge1xuXG4gICAgICAgIHBlcmZvcm1fc2lnbmFsaW5nKClcbiAgICAgICAgbG9va19mb3Jfc2lnbmFsaW5nKClcblxuICAgICAgICBpZiAoU1lOQ19DT1VOVCA+IDIpIHtcbiAgICAgICAgICBDVVJSRU5UX1NUQVRFID0gMlxuICAgICAgICAgIENPTk5FQ1RFRF9BVCA9IERhdGUubm93KClcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2UgaWYgKENVUlJFTlRfU1RBVEUgPT09IDIpIHtcblxuICAgICAgICAvLyBlbmNvZGUgYnl0ZVxuICAgICAgICB2YXIgYnl0ZV90b19zZW5kID0gTUVTU0FHRVtNRVNTQUdFX0lEWF0uY2hhckNvZGVBdCgwKVxuICAgICAgICBlbmNvZGVfYnl0ZShieXRlX3RvX3NlbmQpXG5cbiAgICAgICAgaWYgKGxvb2tfZm9yX3NpZ25hbGluZygpKSB7XG5cbiAgICAgICAgICAvLyByZWFkIGJ5dGVcbiAgICAgICAgICBSWF9CVUZGRVIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShyZWFkX2J5dGVfZnJvbV9zaWduYWwoKSlcblxuICAgICAgICAgIGlmICh0eXBlID09PSAnY2xpZW50Jykge1xuICAgICAgICAgICAgcmV0X29iai5uZXdfZGF0YSA9IHRydWVcbiAgICAgICAgICAgIHJldF9vYmouZGF0YSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocmVhZF9ieXRlX2Zyb21fc2lnbmFsKCkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gaW5jcmVtZW50IGJ5dGUgdG8gZW5jb2RlXG4gICAgICAgICAgTUVTU0FHRV9JRFggKz0gMVxuICAgICAgICAgIE1FU1NBR0VfSURYID0gTUVTU0FHRV9JRFggJSBNRVNTQUdFLmxlbmd0aFxuXG4gICAgICAgICAgcGVyZm9ybV9zaWduYWxpbmcoKVxuXG4gICAgICAgIH1cblxuICAgICAgfSAvLyBlbmQgb2YgQ1VSUkVOVF9TVEFURSA9PT0gMlxuXG4gICAgfVxuXG4gICAgcmV0dXJuIHJldF9vYmpcblxuICB9XG5cblxuICBmdW5jdGlvbiBsb29rX2Zvcl9zaWduYWxpbmcoKSB7XG5cbiAgICB2YXIgdmFsaWRfcmFuZ2VzID0gdmFsaWRhdGVfcmFuZ2VzKClcbiAgICBpZiAodmFsaWRfcmFuZ2VzWzhdID09PSB0cnVlICYmIHZhbGlkX3Jhbmdlc1s5XSA9PT0gZmFsc2UpIHtcbiAgICAgIGN1cnJlbnRfaGlnaF9jaGFubmVsID0gOFxuICAgIH0gZWxzZSB7XG4gICAgICBjdXJyZW50X2hpZ2hfY2hhbm5lbCA9IDlcbiAgICB9XG5cbiAgICB2YXIgZGlmZmVyZW5jZV9mb3VuZCA9IGZhbHNlXG5cbiAgICBpZiAoY3VycmVudF9oaWdoX2NoYW5uZWwgIT09IHByZXZfaGlnaF9jaGFubmVsKSB7XG4gICAgICBkaWZmZXJlbmNlX2ZvdW5kID0gdHJ1ZVxuICAgICAgU1lOQ19DT1VOVCArPSAxXG4gICAgfVxuXG4gICAgcHJldl9oaWdoX2NoYW5uZWwgPSBjdXJyZW50X2hpZ2hfY2hhbm5lbFxuXG4gICAgcmV0dXJuIGRpZmZlcmVuY2VfZm91bmRcblxuICB9XG5cbiAgZnVuY3Rpb24gaW5pdChvcHRzKSB7XG5cbiAgICBNRVNTQUdFID0gb3B0cy5tZXNzYWdlXG4gICAgdHlwZSA9IG9wdHMudHlwZVxuXG4gICAgLy8gY3JlYXRlIG9zYyArIGdhaW4gYmFua3NcbiAgICBmb3IgKHZhciBpZHggPSAwOyBpZHggPCBuX29zYzsgaWR4KyspIHtcblxuICAgICAgbGV0IGxvY2FsX29zYyA9IGNvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpXG4gICAgICBsb2NhbF9vc2MuZnJlcXVlbmN5LnZhbHVlID0gKGlkeCAqIHNwcmVhZCkgKyBpbml0aWFsRnJlcVxuXG4gICAgICBsZXQgbG9jYWxfZ2FpbiA9IGNvbnRleHQuY3JlYXRlR2FpbigpXG4gICAgICBsb2NhbF9nYWluLmdhaW4udmFsdWUgPSAxLjAgLyAobl9vc2MpXG5cbiAgICAgIGxvY2FsX29zYy5jb25uZWN0KGxvY2FsX2dhaW4pXG5cbiAgICAgIGxvY2FsX2dhaW4uY29ubmVjdChsb2NhbEFuYWx5c2VyKVxuICAgICAgLy8gbG9jYWxfZ2Fpbi5jb25uZWN0KGNvbnRleHQuZGVzdGluYXRpb24pXG5cbiAgICAgIGxvY2FsX29zYy5zdGFydCgpXG5cbiAgICAgIG9zY19iYW5rLnB1c2gobG9jYWxfb3NjKVxuICAgICAgZ2Fpbl9iYW5rLnB1c2gobG9jYWxfZ2FpbilcblxuICAgIH1cblxuICAgIGFuYWx5c2VyLmZmdFNpemUgPSAxMDI0XG4gICAgYW5hbHlzZXIuc21vb3RoaW5nVGltZUNvbnN0YW50ID0gMFxuICAgIGJ1ZmZlckxlbmd0aCA9IGFuYWx5c2VyLmZyZXF1ZW5jeUJpbkNvdW50XG4gICAgYW5hbHlzZXJEYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXJMZW5ndGgpXG5cbiAgICBsb2NhbEFuYWx5c2VyLmZmdFNpemUgPSAxMDI0XG4gICAgbG9jYWxBbmFseXNlci5zbW9vdGhpbmdUaW1lQ29uc3RhbnQgPSAwXG4gICAgbG9jYWxBbmFseXNlckRhdGFBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlckxlbmd0aClcblxuICB9XG5cbiAgZnVuY3Rpb24gY29ubmVjdChvdGhlcl9hZ2VudCkge1xuXG4gICAgdmFyIG90aGVyX2dhaW5fYmFuayA9IG90aGVyX2FnZW50LmdldF9nYWluX2JhbmsoKVxuXG4gICAgb3RoZXJfZ2Fpbl9iYW5rLmZvckVhY2goZnVuY3Rpb24gKGdhaW5Ob2RlKSB7XG4gICAgICBnYWluTm9kZS5jb25uZWN0KGFuYWx5c2VyKVxuICAgIH0pXG5cbiAgICBnZXRCdWZmZXIoKVxuXG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICBjb25zb2xlLmxvZygnZG9uZSBjb25uZWN0aW5nJylcbiAgICAgIENVUlJFTlRfU1RBVEUgPSAwXG4gICAgfSwgMjAwKVxuXG4gIH1cblxuICBmdW5jdGlvbiBzZXRfbWVzc2FnZShtc2cpe1xuICAgIE1FU1NBR0UgPSBtc2dcbiAgICBNRVNTQUdFX0lEWCA9IDBcbiAgfVxuXG4gIGZ1bmN0aW9uIG5fY2hhbm5lbHMoKSB7XG4gICAgcmV0dXJuIG5fb3NjXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfZ3JvdXBzKCkge1xuICAgIHJldHVybiBncm91cGVkX3BlYWtfcmFuZ2VzXG4gIH1cblxuICBmdW5jdGlvbiBnZXRCdWZmZXIoKSB7XG4gICAgYW5hbHlzZXIuZ2V0Qnl0ZUZyZXF1ZW5jeURhdGEoYW5hbHlzZXJEYXRhQXJyYXkpXG4gICAgcmV0dXJuIGFuYWx5c2VyRGF0YUFycmF5XG4gIH1cbiAgZnVuY3Rpb24gZ2V0X2xvY2FsX2ZyZXF1ZW5jeV9kYXRhX2J1ZmZlcigpIHtcbiAgICBsb2NhbEFuYWx5c2VyLmdldEJ5dGVGcmVxdWVuY3lEYXRhKGxvY2FsQW5hbHlzZXJEYXRhQXJyYXkpXG4gICAgcmV0dXJuIGxvY2FsQW5hbHlzZXJEYXRhQXJyYXlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9nYWluX2JhbmsoKSB7XG4gICAgcmV0dXJuIGdhaW5fYmFua1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2FuYWx5c2VyKCkge1xuICAgIHJldHVybiBhbmFseXNlclxuICB9XG5cblxuICBmdW5jdGlvbiByZWFkX2J5dGVfZnJvbV9zaWduYWwoKSB7XG5cbiAgICB2YXIgcmFuZ2VzID0gdmFsaWRhdGVfcmFuZ2VzKClcblxuICAgIHZhciBiaW5hcnlfc3RyaW5nID0gJydcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IDg7IGkrKykge1xuICAgICAgaWYgKHJhbmdlc1tpXSkge1xuICAgICAgICBiaW5hcnlfc3RyaW5nICs9ICcxJ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYmluYXJ5X3N0cmluZyArPSAnMCdcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcGFyc2VJbnQoYmluYXJ5X3N0cmluZywgMilcblxuICB9XG5cbiAgZnVuY3Rpb24gcmVnaXN0ZXJfcGVha19yYW5nZXMoKSB7XG5cbiAgICBjb25zb2xlLmxvZygncmVnaXN0ZXJpbmcgcGVhayByYW5nZXMnKVxuXG4gICAgZ2V0QnVmZmVyKClcbiAgICBjb25zb2xlLmxvZyhhbmFseXNlckRhdGFBcnJheSlcblxuICAgIC8vIHB1c2ggb24gdG8gbmV3IGFycmF5IGZvciBzb3J0aW5nXG4gICAgdmFyIGQgPSBbXVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyTGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhbmFseXNlckRhdGFBcnJheVtpXSA+IDApIHtcbiAgICAgICAgZC5wdXNoKGFuYWx5c2VyRGF0YUFycmF5W2ldKVxuICAgICAgfVxuICAgIH1cbiAgICBkLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIHJldHVybiBhIC0gYlxuICAgIH0pXG4gICAgY29uc29sZS5sb2coJ01lYW46ICcgKyBkW01hdGguZmxvb3IoZC5sZW5ndGggLyAyKV0pXG5cbiAgICBtZWFuID0gZFtNYXRoLmZsb29yKGQubGVuZ3RoIC8gMildXG5cbiAgICAvL1xuICAgIHBlYWtfcmFuZ2VzID0gW11cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYW5hbHlzZXJEYXRhQXJyYXlbaV0gPiBtZWFuKSB7XG4gICAgICAgIHBlYWtfcmFuZ2VzLnB1c2goaSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB3aW5kb3cucCA9IHBlYWtfcmFuZ2VzXG5cbiAgICBncm91cF9wZWFrX3JhbmdlcygpXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNoZWNrX3BlYWtfcmFuZ2VzKCkge1xuXG4gICAgZ2V0QnVmZmVyKClcblxuICAgIHZhciBoaXRzID0gW11cbiAgICBwZWFrX3Jhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uIChkYXRhQXJyYXlfaWR4KSB7XG4gICAgICBpZiAoYW5hbHlzZXJEYXRhQXJyYXlbZGF0YUFycmF5X2lkeF0gPiBtZWFuKSB7XG4gICAgICAgIGhpdHMucHVzaCh0cnVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaGl0cy5wdXNoKGZhbHNlKVxuICAgICAgfVxuICAgIH0pXG5cbiAgICByZXR1cm4gaGl0c1xuXG4gIH1cblxuICBmdW5jdGlvbiBncm91cF9wZWFrX3JhbmdlcygpIHtcblxuICAgIGlmIChwZWFrX3JhbmdlcyA9PT0gdW5kZWZpbmVkIHx8IHBlYWtfcmFuZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBncm91cHMgPSBbXSAvLyBbIFsxLDIsM10sIFs4LDksMTBdLCBbMzAsMzEsMzJdICBdXG5cbiAgICB2YXIgY3VycmVudF9ncm91cF9pZHggPSAwXG5cbiAgICB2YXIgbG9jYWxfZ3JvdXAgPSBuZXcgQXJyYXkoKVxuXG4gICAgcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbiAocGVha19pZHgsIGlkeCkge1xuXG4gICAgICAvLyBpZiB0aGUgTWF0aC5hYnMocGVha19pZHggLSBwZWFrX3Jhbmdlc1tpZHgrMV0pID09PSAxXG4gICAgICAvLyAgICBwdXNoIHBlYWtfaWR4IG9uIHRvIGxvY2FsX2dyb3VwXG4gICAgICAvLyBlbHNlXG4gICAgICAvLyAgICBwdXNoIGxvY2FsX2dyb3VwIG9uIHRvIGdyb3Vwc1xuICAgICAgLy8gICAgY2xlYXIgbG9jYWxfZ3JvdXBcbiAgICAgIC8vICAgIHB1c2ggcGVha19pZHggb24gdG8gbG9jYWxfZ3JvdXBcblxuICAgICAgaWYgKGlkeCA9PT0gcGVha19yYW5nZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZygnaGVyZScpXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4ICsgMV0pIDw9IDIpIHtcbiAgICAgICAgbG9jYWxfZ3JvdXAucHVzaChwZWFrX2lkeClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgICAgIGdyb3Vwcy5wdXNoKGxvY2FsX2dyb3VwKVxuICAgICAgICBsb2NhbF9ncm91cCA9IG5ldyBBcnJheSgpXG4gICAgICB9XG5cbiAgICB9KVxuXG4gICAgZ3JvdXBzLnB1c2gobG9jYWxfZ3JvdXApXG5cbiAgICBncm91cGVkX3BlYWtfcmFuZ2VzID0gZ3JvdXBzXG5cbiAgICByZXR1cm4gZ3JvdXBzXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9nYWluKGNoYW5uZWwsIHZhbHVlKSB7XG4gICAgZ2Fpbl9iYW5rW2NoYW5uZWxdLmdhaW4udmFsdWUgPSB2YWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVfcmFuZ2VzKCkge1xuXG4gICAgaWYgKGdyb3VwZWRfcGVha19yYW5nZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGdldEJ1ZmZlcigpXG5cbiAgICB2YXIgdmFsaWRfZ3JvdXBzID0gW11cblxuICAgIGdyb3VwZWRfcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbiAoZ3JvdXApIHtcblxuICAgICAgdmFyIGhpdHMgPSAwXG5cbiAgICAgIGdyb3VwLmZvckVhY2goZnVuY3Rpb24gKGlkeCkge1xuICAgICAgICBpZiAoYW5hbHlzZXJEYXRhQXJyYXlbaWR4XSA+PSBtZWFuKSB7XG4gICAgICAgICAgaGl0cyArPSAxXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIGlmIChoaXRzID49IGdyb3VwLmxlbmd0aCAvIDIpIHtcbiAgICAgICAgdmFsaWRfZ3JvdXBzLnB1c2godHJ1ZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbGlkX2dyb3Vwcy5wdXNoKGZhbHNlKVxuICAgICAgfVxuXG4gICAgfSlcblxuICAgIHJldHVybiB2YWxpZF9ncm91cHNcblxuICB9XG5cbiAgZnVuY3Rpb24gZW5jb2RlX2J5dGUoYnl0ZSkge1xuXG4gICAgdmFyIGNoYXJzID0gZ2V0X2VuY29kZWRfYnl0ZV9hcnJheShieXRlKVxuXG4gICAgLy8gY29uc29sZS5sb2coY2hhcnMpXG5cbiAgICBjaGFycy5mb3JFYWNoKGZ1bmN0aW9uIChjLCBpZHgpIHtcbiAgICAgIGlmIChjID09PSAnMCcpIHtcbiAgICAgICAgc2V0X2dhaW4oaWR4LCAwKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0X2dhaW4oaWR4LCAxIC8gbl9vc2MpXG4gICAgICB9XG4gICAgfSlcblxuICB9XG5cbiAgZnVuY3Rpb24gcGVyZm9ybV9zaWduYWxpbmcoKSB7XG4gICAgZmxpcF9mbG9wID0gIWZsaXBfZmxvcFxuICAgIGlmIChmbGlwX2Zsb3ApIHtcbiAgICAgIHNldF9nYWluKDgsIDEgLyBuX29zYylcbiAgICAgIHNldF9nYWluKDksIDApXG4gICAgfSBlbHNlIHtcbiAgICAgIHNldF9nYWluKDksIDEgLyBuX29zYylcbiAgICAgIHNldF9nYWluKDgsIDApXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2VuY29kZWRfYnl0ZV9hcnJheShieXRlKSB7XG4gICAgcmV0dXJuIHBhZChieXRlLnRvU3RyaW5nKDIpLCA4KS5zcGxpdCgnJylcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhZChuLCB3aWR0aCwgeikge1xuICAgIHogPSB6IHx8ICcwJztcbiAgICBuID0gbiArICcnO1xuICAgIHJldHVybiBuLmxlbmd0aCA+PSB3aWR0aCA/IG4gOiBuZXcgQXJyYXkod2lkdGggLSBuLmxlbmd0aCArIDEpLmpvaW4oeikgKyBuO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X3N0YXRlKCkge1xuICAgIHJldHVybiB7XG4gICAgICBidWZmZXI6IGdldEJ1ZmZlcigpLFxuICAgICAgbG9jYWxfYnVmZmVyOiBnZXRfbG9jYWxfZnJlcXVlbmN5X2RhdGFfYnVmZmVyKCksXG4gICAgICBSWF9CVUZGRVI6IFJYX0JVRkZFUixcbiAgICAgIENVUlJFTlRfU1RBVEU6IENVUlJFTlRfU1RBVEUsXG4gICAgICBTWU5DX0NPVU5UOiBTWU5DX0NPVU5ULFxuICAgICAgTUVTU0FHRTogTUVTU0FHRSxcbiAgICAgIE1FU1NBR0VfSURYOiBNRVNTQUdFX0lEWCxcbiAgICAgIENPTk5FQ1RFRF9BVDogQ09OTkVDVEVEX0FUXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBjaGVja19wZWFrX3JhbmdlczogY2hlY2tfcGVha19yYW5nZXMsXG4gICAgY29ubmVjdDogY29ubmVjdCxcbiAgICBlbmNvZGVfcmFuZ2U6IGVuY29kZV9ieXRlLFxuICAgIGdldEJ1ZmZlcjogZ2V0QnVmZmVyLFxuICAgIGdldF9hbmFseXNlcjogZ2V0X2FuYWx5c2VyLFxuICAgIGdldF9lbmNvZGVkX2J5dGVfYXJyYXk6IGdldF9lbmNvZGVkX2J5dGVfYXJyYXksXG4gICAgZ2V0X2dhaW5fYmFuazogZ2V0X2dhaW5fYmFuayxcbiAgICBnZXRfZ3JvdXBzOiBnZXRfZ3JvdXBzLFxuICAgIGdldF9sb2NhbF9mcmVxdWVuY3lfZGF0YV9idWZmZXI6IGdldF9sb2NhbF9mcmVxdWVuY3lfZGF0YV9idWZmZXIsXG4gICAgZ2V0X3N0YXRlOiBnZXRfc3RhdGUsXG4gICAgZ3JvdXBfcGVha19yYW5nZXM6IGdyb3VwX3BlYWtfcmFuZ2VzLFxuICAgIGluaXQ6IGluaXQsXG4gICAgbl9jaGFubmVsczogbl9jaGFubmVscyxcbiAgICBzZXRfZ2Fpbjogc2V0X2dhaW4sXG4gICAgc2V0X21lc3NhZ2U6IHNldF9tZXNzYWdlLFxuICAgIHJlYWRfYnl0ZV9mcm9tX3NpZ25hbDogcmVhZF9ieXRlX2Zyb21fc2lnbmFsLFxuICAgIHRpY2s6IHRpY2ssXG4gICAgdmFsaWRhdGVfcmFuZ2VzOiB2YWxpZGF0ZV9yYW5nZXMsXG4gIH07XG5cbn1cbiIsIndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciB1ZHBfbW9kZSA9IHRydWVcblxuICBjb25zb2xlLmxvZygnbWFpbi5qcyAvIHdpbmRvdy5vbmxvYWQgYW5vbnltb3VzIGZ1bmN0aW9uJylcblxuICB2YXIgbWVzc2FnZV90b19zZW5kID0gJ3RoaXMgaXMgYSB0ZXN0IHRoYXQgdGhlIG1vZHVsYXRpb24gLyBkZW1vZHVsYXRpb24gd29ya3MgY29ycmVjdGx5IFxcbmFsc28gYnVtcGluZyB0aGUgc3BlZWQgdXAgdG8gPjIwMCBiYXVkLCB0aGlzIHJ1bGVzISEgXFxuJ1xuICB2YXIgb3V0cHV0X21zZyA9ICcnXG5cbiAgdmFyIEFnZW50ID0gcmVxdWlyZSgnLi9hZ2VudC5qcycpXG4gIHZhciBWaWV3X0NvbnRyb2xsZXIgPSByZXF1aXJlKCcuL3ZpZXdfY29udHJvbGxlci5qcycpXG5cbiAgd2luZG93LmFsaWNlID0gQWdlbnQuYWdlbnQoKVxuICBhbGljZS5pbml0KHtcbiAgICB0eXBlOiAnY2xpZW50JyxcbiAgICBtZXNzYWdlOiAnZmZmZidcbiAgfSlcblxuICB3aW5kb3cuYm9iID0gQWdlbnQuYWdlbnQoKVxuICBib2IuaW5pdCh7XG4gICAgdHlwZTogJ3NlcnZlcicsXG4gICAgbWVzc2FnZTogbWVzc2FnZV90b19zZW5kXG4gIH0pXG5cbiAgdmFyIGRpc3BsYXkgPSBWaWV3X0NvbnRyb2xsZXIudmlld19jb250cm9sbGVyKCdhbGljZV9tb2RlbScpXG4gIGRpc3BsYXkuY29ubmVjdChhbGljZSlcblxuICB2YXIgZGF0YUFycmF5ID0gYWxpY2UuZ2V0QnVmZmVyKClcbiAgICAvLyB2YXIgYnVmZmVyTGVuZ3RoID0gZGF0YUFycmF5Lmxlbmd0aFxuICB2YXIgYnVmZmVyTGVuZ3RoID0gNTEyXG5cblxuXG4gIHdpbmRvdy5ieXRlX3RvX2NvZGUgPSAwXG5cblxuXG4gIHZhciBwcmV2X3JhbmdlcyA9IFtdXG5cbiAgYWxpY2UuY29ubmVjdChib2IpXG4gIGJvYi5jb25uZWN0KGFsaWNlKVxuXG4gIC8vIGNyZWF0ZSBhbGljZSBtb2RlbSBlbGVtZW50c1xuICAvLyB2YXIgZGl2X2FsaWNlX3BhcmVudCA9IGQzLnNlbGVjdCgnZGl2I2FsaWNlX21vZGVtJylcbiAgLy9cbiAgLy8gdmFyIGRpdl9zdGF0ZSA9IGRpdl9hbGljZV9wYXJlbnQuYXBwZW5kKCdkaXYnKVxuICAvLyB2YXIgZGl2X2JhdWQgPSBkaXZfYWxpY2VfcGFyZW50LmFwcGVuZCgnZGl2JylcbiAgLy8gdmFyIGRpdl9yeF9idWZmZXIgPSBkaXZfYWxpY2VfcGFyZW50LmFwcGVuZCgncHJlJylcblxuICBzZXRUaW1lb3V0KGRyYXcsIDIwMClcblxuICBmdW5jdGlvbiBkcmF3KCkge1xuXG4gICAgdmFyIHN0YXRzID0gYWxpY2UuZ2V0X3N0YXRlKClcblxuICAgIC8vIGRpdl9zdGF0ZS5odG1sKCdTVEFURTogJyArIHN0YXRzLkNVUlJFTlRfU1RBVEUpXG4gICAgLy8gZGl2X3J4X2J1ZmZlci5odG1sKCdSWCBCVUY6ICcgKyBzdGF0cy5SWF9CVUZGRVIpXG4gICAgLy9cbiAgICAvLyB2YXIgYmF1ZCA9IDggKiAoc3RhdHMuUlhfQlVGRkVSLmxlbmd0aCAvICgoRGF0ZS5ub3coKSAtIHN0YXRzLkNPTk5FQ1RFRF9BVCkgLyAxMDAwLjApKVxuICAgIC8vXG4gICAgLy8gZGl2X2JhdWQuaHRtbCgnQkFVRDogJyArIGJhdWQpXG5cbiAgICBkYXRhQXJyYXkgPSBhbGljZS5nZXRCdWZmZXIoKVxuXG5cbiAgICB2YXIgbyA9IGFsaWNlLnRpY2soKVxuXG4gICAgLy8gaWYoby5uZXdfZGF0YSl7XG4gICAgLy8gICBvdXRwdXRfbXNnICs9IG8uZGF0YVxuICAgIC8vICAgZDMuc2VsZWN0KCdwcmUub3V0cHV0X21zZycpLmh0bWwob3V0cHV0X21zZylcbiAgICAvLyB9XG5cbiAgICBib2IudGljaygpXG5cbiAgICBkaXNwbGF5LnRpY2soKVxuXG4gICAgc2V0VGltZW91dChkcmF3LCAzMClcblxuICAgIC8vIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZHJhdyk7XG5cbiAgfVxuXG5cblxufVxuIiwibW9kdWxlLmV4cG9ydHMudmlld19jb250cm9sbGVyID0gdmlld19jb250cm9sbGVyXG5cbmZ1bmN0aW9uIHZpZXdfY29udHJvbGxlcihkaXZfaWQpe1xuXG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBhZ2VudFxuICB2YXIgcGFyZW50ID0gZDMuc2VsZWN0KCdkaXYjJytkaXZfaWQpXG5cbiAgLy8gZGlzcGxheVxuICAvLyAgICBjdXJyZW50IHN0YXRlXG4gIC8vICAgIHN5bmMgY291bnRcbiAgLy8gICAgb3NjaWxsb3Njb3BlIG9mIG91dHB1dCAmIGlucHV0XG4gIC8vICAgIGZmdCBiYXJzIG9mIG91dHB1dCAmIGlucHV0XG4gIC8vICAgIGN1cnJlbnQgYmF1ZFxuICAvLyAgICByeCBidWZmZXJcblxuICB2YXIgc3ZnXG4gIHZhciBkaXZfc3luY19jb3VudFxuICB2YXIgc3luY19pbmRpY2F0b3JcbiAgdmFyIGRpdl9yeF9idWZmZXJcbiAgdmFyIGRpdl9iYXVkX21ldGVyXG4gIHZhciBiYXJzID0gW11cblxuICB2YXIgV0lEVEggPSAxMDI0XG4gIHZhciBIRUlHSFQgPSAyNTZcblxuICB2YXIgYmFyV2lkdGhcbiAgdmFyIGJ1ZmZlckxlbmd0aFxuICAvLyB2YXIgYmFySGVpZ2h0XG5cbiAgLy8gY3JlYXRlIHN2Z1xuICBmdW5jdGlvbiBzZXR1cF9zdmcoKXtcblxuICAgIFdJRFRIID0gYnVmZmVyTGVuZ3RoXG4gICAgSEVJR0hUID0gV0lEVEggLzRcblxuICAgIGJhcldpZHRoID0gKFdJRFRIIC8gYnVmZmVyTGVuZ3RoKVxuXG4gICAgc3ZnID0gcGFyZW50LmFwcGVuZCgnc3ZnJylcbiAgICAgIC5hdHRyKCdjbGFzcycsICdpbWctcmVzcG9uc2l2ZScpXG4gICAgICAuYXR0cignd2lkdGgnLCAnMTAwJScpXG4gICAgICAvLyAuYXR0cignaGVpZ2h0JywgSEVJR0hUKVxuICAgICAgLmF0dHIoJ3ByZXNlcnZlQXNwZWN0UmF0aW8nLCAneE1pZFlNaWQnKVxuICAgICAgLmF0dHIoJ3ZpZXdCb3gnLCAnMCAwICcgKyBXSURUSCArICcgJyArIEhFSUdIVClcbiAgICAgIC5zdHlsZSgnYmFja2dyb3VuZC1jb2xvcicsICdyZ2JhKDAsMCwwLDAuMSknKVxuXG4gICAgYmFycyA9IFtdXG4gICAgZm9yICh2YXIgc3ZnYmFycyA9IDA7IHN2Z2JhcnMgPCBidWZmZXJMZW5ndGg7IHN2Z2JhcnMrKykge1xuICAgICAgdmFyIGJhciA9IHN2Zy5hcHBlbmQoJ3JlY3QnKVxuICAgICAgICAuYXR0cigneCcsIGJhcldpZHRoICogc3ZnYmFycylcbiAgICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgICAuYXR0cignd2lkdGgnLCBiYXJXaWR0aClcbiAgICAgICAgLmF0dHIoJ2hlaWdodCcsIDApXG4gICAgICAgIC5hdHRyKCdmaWxsJywgJ2dyZWVuJylcbiAgICAgICAgLmF0dHIoJ3N0cm9rZScsICdub25lJylcblxuICAgICAgbGV0IGJhcl9pZHggPSBzdmdiYXJzXG4gICAgICBiYXIub24oJ21vdXNlb3ZlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYmFyX2lkeClcbiAgICAgIH0pXG5cbiAgICAgIGJhcnMucHVzaChiYXIpXG4gICAgfVxuXG4gICAgLy8gc3luYyBjb3VudFxuICAgIGRpdl9zeW5jX2NvdW50ID0gcGFyZW50LmFwcGVuZCgnZGl2JylcbiAgICAgIC5hdHRyKCdjbGFzcycsJ2NvbC1tZC00JylcbiAgICAgIC5zdHlsZSgnb3V0bGluZScsICcxcHggZG90dGVkIHJnYmEoMCwwLDAsMC4xKScpXG5cbiAgICBkaXZfc3luY19jb3VudC5hcHBlbmQoJ2g0JykuYXR0cignY2xhc3MnLCAndGV4dC1jZW50ZXInKS5odG1sKCdzeW5jaHJvbml6YXRpb24gY291bnRzJylcbiAgICBzeW5jX2luZGljYXRvciA9IGRpdl9zeW5jX2NvdW50LmFwcGVuZCgnZGl2JykuYXR0cignY2xhc3MnLCAndGV4dC1jZW50ZXIgc3luY19jb3VudCcpXG5cbiAgICAvLyBiYXVkIG1ldGVyXG4gICAgdmFyIHBhcmVudF9iYXVkX21ldGVyID0gcGFyZW50LmFwcGVuZCgnZGl2JykuYXR0cignY2xhc3MnLCdjb2wtbWQtNCcpXG4gICAgICAuc3R5bGUoJ291dGxpbmUnLCAnMXB4IGRvdHRlZCByZ2JhKDAsMCwwLDAuMSknKVxuXG4gICAgcGFyZW50X2JhdWRfbWV0ZXIuYXBwZW5kKCdoNCcpLmF0dHIoJ2NsYXNzJywgJ3RleHQtY2VudGVyJykuaHRtbCgnYmF1ZCcpXG4gICAgZGl2X2JhdWRfbWV0ZXIgPSBwYXJlbnRfYmF1ZF9tZXRlci5hcHBlbmQoJ2RpdicpLmF0dHIoJ2NsYXNzJywgJ3RleHQtY2VudGVyJylcblxuICAgIC8vIHJ4IGJ1ZmZlclxuICAgIHZhciBkaXZfcnhfYnVmZmVyX3BhcmVudCA9IHBhcmVudC5hcHBlbmQoJ2RpdicpXG4gICAgICAuYXR0cignY2xhc3MnLCAnY29sLW1kLTEyJylcblxuICAgIGRpdl9yeF9idWZmZXIgPSBkaXZfcnhfYnVmZmVyX3BhcmVudC5hcHBlbmQoJ3ByZScpLmF0dHIoJ2NsYXNzJywgJ3J4X2J1ZmZlcicpXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbm5lY3QocmVtb3RlX2FnZW50KXtcbiAgICBhZ2VudCA9IHJlbW90ZV9hZ2VudFxuICAgIGJ1ZmZlckxlbmd0aCA9IHJlbW90ZV9hZ2VudC5nZXRfc3RhdGUoKS5idWZmZXIubGVuZ3RoXG4gIH1cblxuICBmdW5jdGlvbiB0aWNrKCl7XG5cbiAgICB2YXIgc3RhdGUgPSBhZ2VudC5nZXRfc3RhdGUoKVxuXG4gICAgdmFyIGRhdGFBcnJheSA9IHN0YXRlLmJ1ZmZlclxuXG4gICAgaWYoYmFycy5sZW5ndGggPT09IDApe1xuICAgICAgY29uc29sZS5sb2coT2JqZWN0LmtleXMoc3RhdGUpKVxuICAgICAgc2V0dXBfc3ZnKClcbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXJMZW5ndGg7IGkrKykge1xuICAgICAgICBiYXJzW2ldLmF0dHIoJ2hlaWdodCcsIChkYXRhQXJyYXlbaV0vMjU1KSAqIEhFSUdIVClcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzeW5jX2luZGljYXRvci5odG1sKHN0YXRlLlNZTkNfQ09VTlQpXG4gICAgZGl2X3J4X2J1ZmZlci5odG1sKHN0YXRlLlJYX0JVRkZFUilcblxuICAgIHZhciBiYXVkID0gOCAqIChzdGF0ZS5SWF9CVUZGRVIubGVuZ3RoIC8gKChEYXRlLm5vdygpIC0gc3RhdGUuQ09OTkVDVEVEX0FUKSAvIDEwMDAuMCkpXG4gICAgZGl2X2JhdWRfbWV0ZXIuaHRtbChiYXVkLnRvRml4ZWQoMikpXG5cbiAgICAvL1xuICAgIC8vIGNvbnNvbGUubG9nKGFnZW50LmdldF9zdGF0ZSgpLlNZTkNfQ09VTlQpXG5cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgdGljazogdGljayxcbiAgICBjb25uZWN0OiBjb25uZWN0XG4gIH1cblxufVxuIl19
