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

  var master_gain

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

    master_gain = context.createGain()
    master_gain.gain.value = 0
    master_gain.connect(context.destination)

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
      local_gain.connect(master_gain)
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

  function set_volume(v){
    if(v >= 1){
      v=1.0
    }
    master_gain.gain.value = v
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
    set_volume: set_volume,
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

  var message_to_send = 'this is a test that the modulation / demodulation works correctly'
  var output_msg = ''

  var Agent = require('./agent.js')
  var View_Controller = require('./view_controller.js')

  window.alice = Agent.agent()
  alice.init({
    type: 'client',
    message: '... =) ... '
  })

  window.bob = Agent.agent()
  bob.init({
    type: 'server',
    message: message_to_send
  })

  var display = View_Controller.view_controller('alice_modem')
  display.connect(alice)

  var display_bob = View_Controller.view_controller('bob_modem')
  display_bob.connect(bob)

  alice.connect(bob)
  bob.connect(alice)

  setTimeout(draw, 200)

  function draw() {

    var o = alice.tick()
    bob.tick()

    display.tick()
    display_bob.tick()

    setTimeout(draw, 40)
    // window.requestAnimationFrame(draw);

  }

}

},{"./agent.js":1,"./view_controller.js":3}],3:[function(require,module,exports){
module.exports.view_controller = view_controller

function view_controller(div_id){

  "use strict";

  var name = div_id

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

    var state = agent.get_state()

    WIDTH = bufferLength
    HEIGHT = WIDTH /4

    barWidth = (WIDTH / bufferLength)

    parent.append('h1').attr('class','text-center').html(name)

    svg = parent.append('svg')
      .attr('class', 'img-responsive')
      .attr('width', '100%')
      // .attr('height', HEIGHT)
      .attr('preserveAspectRatio', 'xMidYMid')
      .attr('viewBox', '0 0 ' + WIDTH + ' ' + HEIGHT)
      .style('background-color', 'rgba(0,0,0,0.1)')

    svg.append('text')
      .text('receiver spectrum')
      .attr('x', WIDTH)
      .attr('y', 12)
      .attr('dx', '-4px')
      .style('font-size', 12)
      .style('text-anchor', 'end')
      .attr('fill', 'rgba(0,0,0,0.1)')


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

    div_rx_buffer_parent.append('h4').attr('class','text-left').html('rx buffer')

    div_rx_buffer = div_rx_buffer_parent.append('pre').attr('class', 'rx_buffer')

    // message to send
    var parent_message_to_send = parent.append('div').attr('class', 'col-md-12')

    parent_message_to_send.append('div').attr('class','text-center').html('sending this message:')

    var input_field = parent_message_to_send.append('input')
      .attr('type', 'text')
      .attr('class', 'msg_input')

    input_field.node().value = state.MESSAGE

    input_field.on('keyup', function(){
      agent.set_message(input_field.node().value)
    })

    //

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyIsInB1YmxpYy9qcy92aWV3X2NvbnRyb2xsZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMuYWdlbnQgPSBhZ2VudFxuXG5cbmZ1bmN0aW9uIGFnZW50KG9wdHMpIHtcblxuICAoZnVuY3Rpb24gc2V0dXBfYXVkaW9fY29udGV4dCgpIHtcbiAgICBpZiAod2luZG93LmNvbnRleHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc29sZS5sb2coJ2NyZWF0aW5nIG5ldyB3aW5kb3cuQXVkaW9Db250ZXh0KCknKVxuICAgICAgd2luZG93LmNvbnRleHQgPSBuZXcgd2luZG93LkF1ZGlvQ29udGV4dCgpXG4gICAgfVxuICAgIGNvbnNvbGUubG9nKCdkb25lLicpXG4gIH0pKClcblxuICB2YXIgTUVTU0FHRVxuICB2YXIgTUVTU0FHRV9JRFggPSAwXG4gIHZhciBSWF9CVUZGRVIgPSAnJ1xuICB2YXIgQ09OTkVDVEVEX0FUXG5cbiAgdmFyIHR5cGVcblxuICB2YXIgYW5hbHlzZXIgPSBjb250ZXh0LmNyZWF0ZUFuYWx5c2VyKClcbiAgdmFyIGFuYWx5c2VyRGF0YUFycmF5IC8vIHRoZSBidWZmZXIgdGhlIGFuYWx5c2VyIHdyaXRlcyB0b1xuICB2YXIgYnVmZmVyTGVuZ3RoIC8vIHRoZSBsZW5ndGggb2YgdGhlIGFuYWx5c2VyRGF0YUFycmF5XG5cbiAgdmFyIGxvY2FsQW5hbHlzZXIgPSBjb250ZXh0LmNyZWF0ZUFuYWx5c2VyKClcbiAgdmFyIGxvY2FsQW5hbHlzZXJEYXRhQXJyYXkgLy8gdGhlIGJ1ZmZlciB0aGUgYW5hbHlzZXIgd3JpdGVzIHRvXG5cbiAgdmFyIHBlYWtfcmFuZ2VzIC8vIGZsYXQgbGlzdCBvZiBpbmRleGVzIG9mIGRldGVjdGVkIHBlYWsgcmFuZ2VzXG4gIHZhciBncm91cGVkX3BlYWtfcmFuZ2VzIC8vIGNsdXN0ZXJlZCBncm91cHMgb2YgcGVhayByYW5nZXNcbiAgdmFyIG1lYW4gLy8gdGhlIHRocmVzaG9sZCBmb3IgZGV0ZXJtaW5pbmcgaWYgYSBiYW5kIGlzIHBlYWtlZFxuXG4gIHZhciBmbGlwX2Zsb3AgPSB0cnVlXG5cbiAgdmFyIHByZXZfaGlnaF9jaGFubmVsID0gLTFcbiAgdmFyIGN1cnJlbnRfaGlnaF9jaGFubmVsID0gMFxuICB2YXIgU1lOQ19DT1VOVCA9IDBcblxuICB2YXIgb3NjX2JhbmsgPSBbXVxuICB2YXIgZ2Fpbl9iYW5rID0gW11cblxuICB2YXIgbWFzdGVyX2dhaW5cblxuICB2YXIgbl9vc2MgPSAxMFxuICB2YXIgZnJlcVJhbmdlID0gMjUwMFxuICB2YXIgc3ByZWFkID0gKGZyZXFSYW5nZSAvIG5fb3NjKVxuICB2YXIgaW5pdGlhbEZyZXEgPSAyMDBcblxuICB2YXIgQ1VSUkVOVF9TVEFURSA9IC0xXG5cbiAgZnVuY3Rpb24gdGljaygpIHtcblxuICAgIHZhciByZXRfb2JqID0ge1xuICAgICAgbmV3X2RhdGE6IGZhbHNlLFxuICAgICAgZGF0YTogJydcbiAgICB9XG5cbiAgICBpZiAoQ1VSUkVOVF9TVEFURSA8IDApIHtcblxuICAgICAgLy8gcGVyZm9ybWluZyBpbml0aWFsaXphdGlvbiBwcm9jZXNzLCBkbyBub3RoaW5nXG4gICAgICByZXR1cm47XG5cbiAgICB9IGVsc2Uge1xuXG4gICAgICBpZiAoQ1VSUkVOVF9TVEFURSA9PT0gMCkge1xuXG4gICAgICAgIHJlZ2lzdGVyX3BlYWtfcmFuZ2VzKClcblxuICAgICAgICBpZiAoZ3JvdXBlZF9wZWFrX3Jhbmdlcy5sZW5ndGggPT09IDEwKSB7XG4gICAgICAgICAgQ1VSUkVOVF9TVEFURSA9IDFcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2UgaWYgKENVUlJFTlRfU1RBVEUgPT09IDEpIHtcblxuICAgICAgICBwZXJmb3JtX3NpZ25hbGluZygpXG4gICAgICAgIGxvb2tfZm9yX3NpZ25hbGluZygpXG5cbiAgICAgICAgaWYgKFNZTkNfQ09VTlQgPiAyKSB7XG4gICAgICAgICAgQ1VSUkVOVF9TVEFURSA9IDJcbiAgICAgICAgICBDT05ORUNURURfQVQgPSBEYXRlLm5vdygpXG4gICAgICAgIH1cblxuICAgICAgfSBlbHNlIGlmIChDVVJSRU5UX1NUQVRFID09PSAyKSB7XG5cbiAgICAgICAgLy8gZW5jb2RlIGJ5dGVcbiAgICAgICAgdmFyIGJ5dGVfdG9fc2VuZCA9IE1FU1NBR0VbTUVTU0FHRV9JRFhdLmNoYXJDb2RlQXQoMClcbiAgICAgICAgZW5jb2RlX2J5dGUoYnl0ZV90b19zZW5kKVxuXG4gICAgICAgIGlmIChsb29rX2Zvcl9zaWduYWxpbmcoKSkge1xuXG4gICAgICAgICAgLy8gcmVhZCBieXRlXG4gICAgICAgICAgUlhfQlVGRkVSICs9IFN0cmluZy5mcm9tQ2hhckNvZGUocmVhZF9ieXRlX2Zyb21fc2lnbmFsKCkpXG5cbiAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NsaWVudCcpIHtcbiAgICAgICAgICAgIHJldF9vYmoubmV3X2RhdGEgPSB0cnVlXG4gICAgICAgICAgICByZXRfb2JqLmRhdGEgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHJlYWRfYnl0ZV9mcm9tX3NpZ25hbCgpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIGluY3JlbWVudCBieXRlIHRvIGVuY29kZVxuICAgICAgICAgIE1FU1NBR0VfSURYICs9IDFcbiAgICAgICAgICBNRVNTQUdFX0lEWCA9IE1FU1NBR0VfSURYICUgTUVTU0FHRS5sZW5ndGhcblxuICAgICAgICAgIHBlcmZvcm1fc2lnbmFsaW5nKClcblxuICAgICAgICB9XG5cbiAgICAgIH0gLy8gZW5kIG9mIENVUlJFTlRfU1RBVEUgPT09IDJcblxuICAgIH1cblxuICAgIHJldHVybiByZXRfb2JqXG5cbiAgfVxuXG5cbiAgZnVuY3Rpb24gbG9va19mb3Jfc2lnbmFsaW5nKCkge1xuXG4gICAgdmFyIHZhbGlkX3JhbmdlcyA9IHZhbGlkYXRlX3JhbmdlcygpXG4gICAgaWYgKHZhbGlkX3Jhbmdlc1s4XSA9PT0gdHJ1ZSAmJiB2YWxpZF9yYW5nZXNbOV0gPT09IGZhbHNlKSB7XG4gICAgICBjdXJyZW50X2hpZ2hfY2hhbm5lbCA9IDhcbiAgICB9IGVsc2Uge1xuICAgICAgY3VycmVudF9oaWdoX2NoYW5uZWwgPSA5XG4gICAgfVxuXG4gICAgdmFyIGRpZmZlcmVuY2VfZm91bmQgPSBmYWxzZVxuXG4gICAgaWYgKGN1cnJlbnRfaGlnaF9jaGFubmVsICE9PSBwcmV2X2hpZ2hfY2hhbm5lbCkge1xuICAgICAgZGlmZmVyZW5jZV9mb3VuZCA9IHRydWVcbiAgICAgIFNZTkNfQ09VTlQgKz0gMVxuICAgIH1cblxuICAgIHByZXZfaGlnaF9jaGFubmVsID0gY3VycmVudF9oaWdoX2NoYW5uZWxcblxuICAgIHJldHVybiBkaWZmZXJlbmNlX2ZvdW5kXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGluaXQob3B0cykge1xuXG4gICAgbWFzdGVyX2dhaW4gPSBjb250ZXh0LmNyZWF0ZUdhaW4oKVxuICAgIG1hc3Rlcl9nYWluLmdhaW4udmFsdWUgPSAwXG4gICAgbWFzdGVyX2dhaW4uY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKVxuXG4gICAgTUVTU0FHRSA9IG9wdHMubWVzc2FnZVxuICAgIHR5cGUgPSBvcHRzLnR5cGVcblxuICAgIC8vIGNyZWF0ZSBvc2MgKyBnYWluIGJhbmtzXG4gICAgZm9yICh2YXIgaWR4ID0gMDsgaWR4IDwgbl9vc2M7IGlkeCsrKSB7XG5cbiAgICAgIGxldCBsb2NhbF9vc2MgPSBjb250ZXh0LmNyZWF0ZU9zY2lsbGF0b3IoKVxuICAgICAgbG9jYWxfb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IChpZHggKiBzcHJlYWQpICsgaW5pdGlhbEZyZXFcblxuICAgICAgbGV0IGxvY2FsX2dhaW4gPSBjb250ZXh0LmNyZWF0ZUdhaW4oKVxuICAgICAgbG9jYWxfZ2Fpbi5nYWluLnZhbHVlID0gMS4wIC8gKG5fb3NjKVxuXG4gICAgICBsb2NhbF9vc2MuY29ubmVjdChsb2NhbF9nYWluKVxuXG4gICAgICBsb2NhbF9nYWluLmNvbm5lY3QobG9jYWxBbmFseXNlcilcbiAgICAgIGxvY2FsX2dhaW4uY29ubmVjdChtYXN0ZXJfZ2FpbilcbiAgICAgIC8vIGxvY2FsX2dhaW4uY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKVxuXG4gICAgICBsb2NhbF9vc2Muc3RhcnQoKVxuXG4gICAgICBvc2NfYmFuay5wdXNoKGxvY2FsX29zYylcbiAgICAgIGdhaW5fYmFuay5wdXNoKGxvY2FsX2dhaW4pXG5cbiAgICB9XG5cbiAgICBhbmFseXNlci5mZnRTaXplID0gMTAyNFxuICAgIGFuYWx5c2VyLnNtb290aGluZ1RpbWVDb25zdGFudCA9IDBcbiAgICBidWZmZXJMZW5ndGggPSBhbmFseXNlci5mcmVxdWVuY3lCaW5Db3VudFxuICAgIGFuYWx5c2VyRGF0YUFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyTGVuZ3RoKVxuXG4gICAgbG9jYWxBbmFseXNlci5mZnRTaXplID0gMTAyNFxuICAgIGxvY2FsQW5hbHlzZXIuc21vb3RoaW5nVGltZUNvbnN0YW50ID0gMFxuICAgIGxvY2FsQW5hbHlzZXJEYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXJMZW5ndGgpXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbm5lY3Qob3RoZXJfYWdlbnQpIHtcblxuICAgIHZhciBvdGhlcl9nYWluX2JhbmsgPSBvdGhlcl9hZ2VudC5nZXRfZ2Fpbl9iYW5rKClcblxuICAgIG90aGVyX2dhaW5fYmFuay5mb3JFYWNoKGZ1bmN0aW9uIChnYWluTm9kZSkge1xuICAgICAgZ2Fpbk5vZGUuY29ubmVjdChhbmFseXNlcilcbiAgICB9KVxuXG4gICAgZ2V0QnVmZmVyKClcblxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgY29uc29sZS5sb2coJ2RvbmUgY29ubmVjdGluZycpXG4gICAgICBDVVJSRU5UX1NUQVRFID0gMFxuICAgIH0sIDIwMClcblxuICB9XG5cbiAgZnVuY3Rpb24gc2V0X21lc3NhZ2UobXNnKXtcbiAgICBNRVNTQUdFID0gbXNnXG4gICAgTUVTU0FHRV9JRFggPSAwXG4gIH1cblxuICBmdW5jdGlvbiBuX2NoYW5uZWxzKCkge1xuICAgIHJldHVybiBuX29zY1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2dyb3VwcygpIHtcbiAgICByZXR1cm4gZ3JvdXBlZF9wZWFrX3Jhbmdlc1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0QnVmZmVyKCkge1xuICAgIGFuYWx5c2VyLmdldEJ5dGVGcmVxdWVuY3lEYXRhKGFuYWx5c2VyRGF0YUFycmF5KVxuICAgIHJldHVybiBhbmFseXNlckRhdGFBcnJheVxuICB9XG4gIGZ1bmN0aW9uIGdldF9sb2NhbF9mcmVxdWVuY3lfZGF0YV9idWZmZXIoKSB7XG4gICAgbG9jYWxBbmFseXNlci5nZXRCeXRlRnJlcXVlbmN5RGF0YShsb2NhbEFuYWx5c2VyRGF0YUFycmF5KVxuICAgIHJldHVybiBsb2NhbEFuYWx5c2VyRGF0YUFycmF5XG4gIH1cblxuICBmdW5jdGlvbiBnZXRfZ2Fpbl9iYW5rKCkge1xuICAgIHJldHVybiBnYWluX2JhbmtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9hbmFseXNlcigpIHtcbiAgICByZXR1cm4gYW5hbHlzZXJcbiAgfVxuXG5cbiAgZnVuY3Rpb24gcmVhZF9ieXRlX2Zyb21fc2lnbmFsKCkge1xuXG4gICAgdmFyIHJhbmdlcyA9IHZhbGlkYXRlX3JhbmdlcygpXG5cbiAgICB2YXIgYmluYXJ5X3N0cmluZyA9ICcnXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCA4OyBpKyspIHtcbiAgICAgIGlmIChyYW5nZXNbaV0pIHtcbiAgICAgICAgYmluYXJ5X3N0cmluZyArPSAnMSdcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJpbmFyeV9zdHJpbmcgKz0gJzAnXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcnNlSW50KGJpbmFyeV9zdHJpbmcsIDIpXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlZ2lzdGVyX3BlYWtfcmFuZ2VzKCkge1xuXG4gICAgY29uc29sZS5sb2coJ3JlZ2lzdGVyaW5nIHBlYWsgcmFuZ2VzJylcblxuICAgIGdldEJ1ZmZlcigpXG4gICAgY29uc29sZS5sb2coYW5hbHlzZXJEYXRhQXJyYXkpXG5cbiAgICAvLyBwdXNoIG9uIHRvIG5ldyBhcnJheSBmb3Igc29ydGluZ1xuICAgIHZhciBkID0gW11cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYW5hbHlzZXJEYXRhQXJyYXlbaV0gPiAwKSB7XG4gICAgICAgIGQucHVzaChhbmFseXNlckRhdGFBcnJheVtpXSlcbiAgICAgIH1cbiAgICB9XG4gICAgZC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICByZXR1cm4gYSAtIGJcbiAgICB9KVxuICAgIGNvbnNvbGUubG9nKCdNZWFuOiAnICsgZFtNYXRoLmZsb29yKGQubGVuZ3RoIC8gMildKVxuXG4gICAgbWVhbiA9IGRbTWF0aC5mbG9vcihkLmxlbmd0aCAvIDIpXVxuXG4gICAgLy9cbiAgICBwZWFrX3JhbmdlcyA9IFtdXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXJMZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFuYWx5c2VyRGF0YUFycmF5W2ldID4gbWVhbikge1xuICAgICAgICBwZWFrX3Jhbmdlcy5wdXNoKGkpXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gd2luZG93LnAgPSBwZWFrX3Jhbmdlc1xuXG4gICAgZ3JvdXBfcGVha19yYW5nZXMoKVxuXG4gIH1cblxuICBmdW5jdGlvbiBjaGVja19wZWFrX3JhbmdlcygpIHtcblxuICAgIGdldEJ1ZmZlcigpXG5cbiAgICB2YXIgaGl0cyA9IFtdXG4gICAgcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbiAoZGF0YUFycmF5X2lkeCkge1xuICAgICAgaWYgKGFuYWx5c2VyRGF0YUFycmF5W2RhdGFBcnJheV9pZHhdID4gbWVhbikge1xuICAgICAgICBoaXRzLnB1c2godHJ1ZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGhpdHMucHVzaChmYWxzZSlcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIGhpdHNcblxuICB9XG5cbiAgZnVuY3Rpb24gZ3JvdXBfcGVha19yYW5nZXMoKSB7XG5cbiAgICBpZiAocGVha19yYW5nZXMgPT09IHVuZGVmaW5lZCB8fCBwZWFrX3Jhbmdlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZ3JvdXBzID0gW10gLy8gWyBbMSwyLDNdLCBbOCw5LDEwXSwgWzMwLDMxLDMyXSAgXVxuXG4gICAgdmFyIGN1cnJlbnRfZ3JvdXBfaWR4ID0gMFxuXG4gICAgdmFyIGxvY2FsX2dyb3VwID0gbmV3IEFycmF5KClcblxuICAgIHBlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24gKHBlYWtfaWR4LCBpZHgpIHtcblxuICAgICAgLy8gaWYgdGhlIE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4KzFdKSA9PT0gMVxuICAgICAgLy8gICAgcHVzaCBwZWFrX2lkeCBvbiB0byBsb2NhbF9ncm91cFxuICAgICAgLy8gZWxzZVxuICAgICAgLy8gICAgcHVzaCBsb2NhbF9ncm91cCBvbiB0byBncm91cHNcbiAgICAgIC8vICAgIGNsZWFyIGxvY2FsX2dyb3VwXG4gICAgICAvLyAgICBwdXNoIHBlYWtfaWR4IG9uIHRvIGxvY2FsX2dyb3VwXG5cbiAgICAgIGlmIChpZHggPT09IHBlYWtfcmFuZ2VzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ2hlcmUnKVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChNYXRoLmFicyhwZWFrX2lkeCAtIHBlYWtfcmFuZ2VzW2lkeCArIDFdKSA8PSAyKSB7XG4gICAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2NhbF9ncm91cC5wdXNoKHBlYWtfaWR4KVxuICAgICAgICBncm91cHMucHVzaChsb2NhbF9ncm91cClcbiAgICAgICAgbG9jYWxfZ3JvdXAgPSBuZXcgQXJyYXkoKVxuICAgICAgfVxuXG4gICAgfSlcblxuICAgIGdyb3Vwcy5wdXNoKGxvY2FsX2dyb3VwKVxuXG4gICAgZ3JvdXBlZF9wZWFrX3JhbmdlcyA9IGdyb3Vwc1xuXG4gICAgcmV0dXJuIGdyb3Vwc1xuXG4gIH1cblxuICBmdW5jdGlvbiBzZXRfZ2FpbihjaGFubmVsLCB2YWx1ZSkge1xuICAgIGdhaW5fYmFua1tjaGFubmVsXS5nYWluLnZhbHVlID0gdmFsdWVcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF92b2x1bWUodil7XG4gICAgaWYodiA+PSAxKXtcbiAgICAgIHY9MS4wXG4gICAgfVxuICAgIG1hc3Rlcl9nYWluLmdhaW4udmFsdWUgPSB2XG4gIH1cblxuICBmdW5jdGlvbiB2YWxpZGF0ZV9yYW5nZXMoKSB7XG5cbiAgICBpZiAoZ3JvdXBlZF9wZWFrX3JhbmdlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZ2V0QnVmZmVyKClcblxuICAgIHZhciB2YWxpZF9ncm91cHMgPSBbXVxuXG4gICAgZ3JvdXBlZF9wZWFrX3Jhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uIChncm91cCkge1xuXG4gICAgICB2YXIgaGl0cyA9IDBcblxuICAgICAgZ3JvdXAuZm9yRWFjaChmdW5jdGlvbiAoaWR4KSB7XG4gICAgICAgIGlmIChhbmFseXNlckRhdGFBcnJheVtpZHhdID49IG1lYW4pIHtcbiAgICAgICAgICBoaXRzICs9IDFcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgaWYgKGhpdHMgPj0gZ3JvdXAubGVuZ3RoIC8gMikge1xuICAgICAgICB2YWxpZF9ncm91cHMucHVzaCh0cnVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsaWRfZ3JvdXBzLnB1c2goZmFsc2UpXG4gICAgICB9XG5cbiAgICB9KVxuXG4gICAgcmV0dXJuIHZhbGlkX2dyb3Vwc1xuXG4gIH1cblxuICBmdW5jdGlvbiBlbmNvZGVfYnl0ZShieXRlKSB7XG5cbiAgICB2YXIgY2hhcnMgPSBnZXRfZW5jb2RlZF9ieXRlX2FycmF5KGJ5dGUpXG5cbiAgICAvLyBjb25zb2xlLmxvZyhjaGFycylcblxuICAgIGNoYXJzLmZvckVhY2goZnVuY3Rpb24gKGMsIGlkeCkge1xuICAgICAgaWYgKGMgPT09ICcwJykge1xuICAgICAgICBzZXRfZ2FpbihpZHgsIDApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRfZ2FpbihpZHgsIDEgLyBuX29zYylcbiAgICAgIH1cbiAgICB9KVxuXG4gIH1cblxuICBmdW5jdGlvbiBwZXJmb3JtX3NpZ25hbGluZygpIHtcbiAgICBmbGlwX2Zsb3AgPSAhZmxpcF9mbG9wXG4gICAgaWYgKGZsaXBfZmxvcCkge1xuICAgICAgc2V0X2dhaW4oOCwgMSAvIG5fb3NjKVxuICAgICAgc2V0X2dhaW4oOSwgMClcbiAgICB9IGVsc2Uge1xuICAgICAgc2V0X2dhaW4oOSwgMSAvIG5fb3NjKVxuICAgICAgc2V0X2dhaW4oOCwgMClcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBnZXRfZW5jb2RlZF9ieXRlX2FycmF5KGJ5dGUpIHtcbiAgICByZXR1cm4gcGFkKGJ5dGUudG9TdHJpbmcoMiksIDgpLnNwbGl0KCcnKVxuICB9XG5cbiAgZnVuY3Rpb24gcGFkKG4sIHdpZHRoLCB6KSB7XG4gICAgeiA9IHogfHwgJzAnO1xuICAgIG4gPSBuICsgJyc7XG4gICAgcmV0dXJuIG4ubGVuZ3RoID49IHdpZHRoID8gbiA6IG5ldyBBcnJheSh3aWR0aCAtIG4ubGVuZ3RoICsgMSkuam9pbih6KSArIG47XG4gIH1cblxuICBmdW5jdGlvbiBnZXRfc3RhdGUoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGJ1ZmZlcjogZ2V0QnVmZmVyKCksXG4gICAgICBsb2NhbF9idWZmZXI6IGdldF9sb2NhbF9mcmVxdWVuY3lfZGF0YV9idWZmZXIoKSxcbiAgICAgIFJYX0JVRkZFUjogUlhfQlVGRkVSLFxuICAgICAgQ1VSUkVOVF9TVEFURTogQ1VSUkVOVF9TVEFURSxcbiAgICAgIFNZTkNfQ09VTlQ6IFNZTkNfQ09VTlQsXG4gICAgICBNRVNTQUdFOiBNRVNTQUdFLFxuICAgICAgTUVTU0FHRV9JRFg6IE1FU1NBR0VfSURYLFxuICAgICAgQ09OTkVDVEVEX0FUOiBDT05ORUNURURfQVRcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGNoZWNrX3BlYWtfcmFuZ2VzOiBjaGVja19wZWFrX3JhbmdlcyxcbiAgICBjb25uZWN0OiBjb25uZWN0LFxuICAgIGVuY29kZV9yYW5nZTogZW5jb2RlX2J5dGUsXG4gICAgZ2V0QnVmZmVyOiBnZXRCdWZmZXIsXG4gICAgZ2V0X2FuYWx5c2VyOiBnZXRfYW5hbHlzZXIsXG4gICAgZ2V0X2VuY29kZWRfYnl0ZV9hcnJheTogZ2V0X2VuY29kZWRfYnl0ZV9hcnJheSxcbiAgICBnZXRfZ2Fpbl9iYW5rOiBnZXRfZ2Fpbl9iYW5rLFxuICAgIGdldF9ncm91cHM6IGdldF9ncm91cHMsXG4gICAgZ2V0X2xvY2FsX2ZyZXF1ZW5jeV9kYXRhX2J1ZmZlcjogZ2V0X2xvY2FsX2ZyZXF1ZW5jeV9kYXRhX2J1ZmZlcixcbiAgICBnZXRfc3RhdGU6IGdldF9zdGF0ZSxcbiAgICBncm91cF9wZWFrX3JhbmdlczogZ3JvdXBfcGVha19yYW5nZXMsXG4gICAgaW5pdDogaW5pdCxcbiAgICBuX2NoYW5uZWxzOiBuX2NoYW5uZWxzLFxuICAgIHNldF9nYWluOiBzZXRfZ2FpbixcbiAgICBzZXRfbWVzc2FnZTogc2V0X21lc3NhZ2UsXG4gICAgc2V0X3ZvbHVtZTogc2V0X3ZvbHVtZSxcbiAgICByZWFkX2J5dGVfZnJvbV9zaWduYWw6IHJlYWRfYnl0ZV9mcm9tX3NpZ25hbCxcbiAgICB0aWNrOiB0aWNrLFxuICAgIHZhbGlkYXRlX3JhbmdlczogdmFsaWRhdGVfcmFuZ2VzLFxuICB9O1xuXG59XG4iLCJ3aW5kb3cub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgdWRwX21vZGUgPSB0cnVlXG5cbiAgY29uc29sZS5sb2coJ21haW4uanMgLyB3aW5kb3cub25sb2FkIGFub255bW91cyBmdW5jdGlvbicpXG5cbiAgdmFyIG1lc3NhZ2VfdG9fc2VuZCA9ICd0aGlzIGlzIGEgdGVzdCB0aGF0IHRoZSBtb2R1bGF0aW9uIC8gZGVtb2R1bGF0aW9uIHdvcmtzIGNvcnJlY3RseSdcbiAgdmFyIG91dHB1dF9tc2cgPSAnJ1xuXG4gIHZhciBBZ2VudCA9IHJlcXVpcmUoJy4vYWdlbnQuanMnKVxuICB2YXIgVmlld19Db250cm9sbGVyID0gcmVxdWlyZSgnLi92aWV3X2NvbnRyb2xsZXIuanMnKVxuXG4gIHdpbmRvdy5hbGljZSA9IEFnZW50LmFnZW50KClcbiAgYWxpY2UuaW5pdCh7XG4gICAgdHlwZTogJ2NsaWVudCcsXG4gICAgbWVzc2FnZTogJy4uLiA9KSAuLi4gJ1xuICB9KVxuXG4gIHdpbmRvdy5ib2IgPSBBZ2VudC5hZ2VudCgpXG4gIGJvYi5pbml0KHtcbiAgICB0eXBlOiAnc2VydmVyJyxcbiAgICBtZXNzYWdlOiBtZXNzYWdlX3RvX3NlbmRcbiAgfSlcblxuICB2YXIgZGlzcGxheSA9IFZpZXdfQ29udHJvbGxlci52aWV3X2NvbnRyb2xsZXIoJ2FsaWNlX21vZGVtJylcbiAgZGlzcGxheS5jb25uZWN0KGFsaWNlKVxuXG4gIHZhciBkaXNwbGF5X2JvYiA9IFZpZXdfQ29udHJvbGxlci52aWV3X2NvbnRyb2xsZXIoJ2JvYl9tb2RlbScpXG4gIGRpc3BsYXlfYm9iLmNvbm5lY3QoYm9iKVxuXG4gIGFsaWNlLmNvbm5lY3QoYm9iKVxuICBib2IuY29ubmVjdChhbGljZSlcblxuICBzZXRUaW1lb3V0KGRyYXcsIDIwMClcblxuICBmdW5jdGlvbiBkcmF3KCkge1xuXG4gICAgdmFyIG8gPSBhbGljZS50aWNrKClcbiAgICBib2IudGljaygpXG5cbiAgICBkaXNwbGF5LnRpY2soKVxuICAgIGRpc3BsYXlfYm9iLnRpY2soKVxuXG4gICAgc2V0VGltZW91dChkcmF3LCA0MClcbiAgICAvLyB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGRyYXcpO1xuXG4gIH1cblxufVxuIiwibW9kdWxlLmV4cG9ydHMudmlld19jb250cm9sbGVyID0gdmlld19jb250cm9sbGVyXG5cbmZ1bmN0aW9uIHZpZXdfY29udHJvbGxlcihkaXZfaWQpe1xuXG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBuYW1lID0gZGl2X2lkXG5cbiAgdmFyIGFnZW50XG4gIHZhciBwYXJlbnQgPSBkMy5zZWxlY3QoJ2RpdiMnK2Rpdl9pZClcblxuICAvLyBkaXNwbGF5XG4gIC8vICAgIGN1cnJlbnQgc3RhdGVcbiAgLy8gICAgc3luYyBjb3VudFxuICAvLyAgICBvc2NpbGxvc2NvcGUgb2Ygb3V0cHV0ICYgaW5wdXRcbiAgLy8gICAgZmZ0IGJhcnMgb2Ygb3V0cHV0ICYgaW5wdXRcbiAgLy8gICAgY3VycmVudCBiYXVkXG4gIC8vICAgIHJ4IGJ1ZmZlclxuXG4gIHZhciBzdmdcbiAgdmFyIGRpdl9zeW5jX2NvdW50XG4gIHZhciBzeW5jX2luZGljYXRvclxuICB2YXIgZGl2X3J4X2J1ZmZlclxuICB2YXIgZGl2X2JhdWRfbWV0ZXJcbiAgdmFyIGJhcnMgPSBbXVxuXG4gIHZhciBXSURUSCA9IDEwMjRcbiAgdmFyIEhFSUdIVCA9IDI1NlxuXG4gIHZhciBiYXJXaWR0aFxuICB2YXIgYnVmZmVyTGVuZ3RoXG4gIC8vIHZhciBiYXJIZWlnaHRcblxuICAvLyBjcmVhdGUgc3ZnXG4gIGZ1bmN0aW9uIHNldHVwX3N2Zygpe1xuXG4gICAgdmFyIHN0YXRlID0gYWdlbnQuZ2V0X3N0YXRlKClcblxuICAgIFdJRFRIID0gYnVmZmVyTGVuZ3RoXG4gICAgSEVJR0hUID0gV0lEVEggLzRcblxuICAgIGJhcldpZHRoID0gKFdJRFRIIC8gYnVmZmVyTGVuZ3RoKVxuXG4gICAgcGFyZW50LmFwcGVuZCgnaDEnKS5hdHRyKCdjbGFzcycsJ3RleHQtY2VudGVyJykuaHRtbChuYW1lKVxuXG4gICAgc3ZnID0gcGFyZW50LmFwcGVuZCgnc3ZnJylcbiAgICAgIC5hdHRyKCdjbGFzcycsICdpbWctcmVzcG9uc2l2ZScpXG4gICAgICAuYXR0cignd2lkdGgnLCAnMTAwJScpXG4gICAgICAvLyAuYXR0cignaGVpZ2h0JywgSEVJR0hUKVxuICAgICAgLmF0dHIoJ3ByZXNlcnZlQXNwZWN0UmF0aW8nLCAneE1pZFlNaWQnKVxuICAgICAgLmF0dHIoJ3ZpZXdCb3gnLCAnMCAwICcgKyBXSURUSCArICcgJyArIEhFSUdIVClcbiAgICAgIC5zdHlsZSgnYmFja2dyb3VuZC1jb2xvcicsICdyZ2JhKDAsMCwwLDAuMSknKVxuXG4gICAgc3ZnLmFwcGVuZCgndGV4dCcpXG4gICAgICAudGV4dCgncmVjZWl2ZXIgc3BlY3RydW0nKVxuICAgICAgLmF0dHIoJ3gnLCBXSURUSClcbiAgICAgIC5hdHRyKCd5JywgMTIpXG4gICAgICAuYXR0cignZHgnLCAnLTRweCcpXG4gICAgICAuc3R5bGUoJ2ZvbnQtc2l6ZScsIDEyKVxuICAgICAgLnN0eWxlKCd0ZXh0LWFuY2hvcicsICdlbmQnKVxuICAgICAgLmF0dHIoJ2ZpbGwnLCAncmdiYSgwLDAsMCwwLjEpJylcblxuXG4gICAgYmFycyA9IFtdXG4gICAgZm9yICh2YXIgc3ZnYmFycyA9IDA7IHN2Z2JhcnMgPCBidWZmZXJMZW5ndGg7IHN2Z2JhcnMrKykge1xuICAgICAgdmFyIGJhciA9IHN2Zy5hcHBlbmQoJ3JlY3QnKVxuICAgICAgICAuYXR0cigneCcsIGJhcldpZHRoICogc3ZnYmFycylcbiAgICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgICAuYXR0cignd2lkdGgnLCBiYXJXaWR0aClcbiAgICAgICAgLmF0dHIoJ2hlaWdodCcsIDApXG4gICAgICAgIC5hdHRyKCdmaWxsJywgJ2dyZWVuJylcbiAgICAgICAgLmF0dHIoJ3N0cm9rZScsICdub25lJylcblxuICAgICAgbGV0IGJhcl9pZHggPSBzdmdiYXJzXG4gICAgICBiYXIub24oJ21vdXNlb3ZlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc29sZS5sb2coYmFyX2lkeClcbiAgICAgIH0pXG5cbiAgICAgIGJhcnMucHVzaChiYXIpXG4gICAgfVxuXG4gICAgLy8gc3luYyBjb3VudFxuICAgIGRpdl9zeW5jX2NvdW50ID0gcGFyZW50LmFwcGVuZCgnZGl2JylcbiAgICAgIC5hdHRyKCdjbGFzcycsJ2NvbC1tZC00JylcbiAgICAgIC5zdHlsZSgnb3V0bGluZScsICcxcHggZG90dGVkIHJnYmEoMCwwLDAsMC4xKScpXG5cbiAgICBkaXZfc3luY19jb3VudC5hcHBlbmQoJ2g0JykuYXR0cignY2xhc3MnLCAndGV4dC1jZW50ZXInKS5odG1sKCdzeW5jaHJvbml6YXRpb24gY291bnRzJylcbiAgICBzeW5jX2luZGljYXRvciA9IGRpdl9zeW5jX2NvdW50LmFwcGVuZCgnZGl2JykuYXR0cignY2xhc3MnLCAndGV4dC1jZW50ZXIgc3luY19jb3VudCcpXG5cbiAgICAvLyBiYXVkIG1ldGVyXG4gICAgdmFyIHBhcmVudF9iYXVkX21ldGVyID0gcGFyZW50LmFwcGVuZCgnZGl2JykuYXR0cignY2xhc3MnLCdjb2wtbWQtNCcpXG4gICAgICAuc3R5bGUoJ291dGxpbmUnLCAnMXB4IGRvdHRlZCByZ2JhKDAsMCwwLDAuMSknKVxuXG4gICAgcGFyZW50X2JhdWRfbWV0ZXIuYXBwZW5kKCdoNCcpLmF0dHIoJ2NsYXNzJywgJ3RleHQtY2VudGVyJykuaHRtbCgnYmF1ZCcpXG4gICAgZGl2X2JhdWRfbWV0ZXIgPSBwYXJlbnRfYmF1ZF9tZXRlci5hcHBlbmQoJ2RpdicpLmF0dHIoJ2NsYXNzJywgJ3RleHQtY2VudGVyJylcblxuICAgIC8vIHJ4IGJ1ZmZlclxuICAgIHZhciBkaXZfcnhfYnVmZmVyX3BhcmVudCA9IHBhcmVudC5hcHBlbmQoJ2RpdicpXG4gICAgICAuYXR0cignY2xhc3MnLCAnY29sLW1kLTEyJylcblxuICAgIGRpdl9yeF9idWZmZXJfcGFyZW50LmFwcGVuZCgnaDQnKS5hdHRyKCdjbGFzcycsJ3RleHQtbGVmdCcpLmh0bWwoJ3J4IGJ1ZmZlcicpXG5cbiAgICBkaXZfcnhfYnVmZmVyID0gZGl2X3J4X2J1ZmZlcl9wYXJlbnQuYXBwZW5kKCdwcmUnKS5hdHRyKCdjbGFzcycsICdyeF9idWZmZXInKVxuXG4gICAgLy8gbWVzc2FnZSB0byBzZW5kXG4gICAgdmFyIHBhcmVudF9tZXNzYWdlX3RvX3NlbmQgPSBwYXJlbnQuYXBwZW5kKCdkaXYnKS5hdHRyKCdjbGFzcycsICdjb2wtbWQtMTInKVxuXG4gICAgcGFyZW50X21lc3NhZ2VfdG9fc2VuZC5hcHBlbmQoJ2RpdicpLmF0dHIoJ2NsYXNzJywndGV4dC1jZW50ZXInKS5odG1sKCdzZW5kaW5nIHRoaXMgbWVzc2FnZTonKVxuXG4gICAgdmFyIGlucHV0X2ZpZWxkID0gcGFyZW50X21lc3NhZ2VfdG9fc2VuZC5hcHBlbmQoJ2lucHV0JylcbiAgICAgIC5hdHRyKCd0eXBlJywgJ3RleHQnKVxuICAgICAgLmF0dHIoJ2NsYXNzJywgJ21zZ19pbnB1dCcpXG5cbiAgICBpbnB1dF9maWVsZC5ub2RlKCkudmFsdWUgPSBzdGF0ZS5NRVNTQUdFXG5cbiAgICBpbnB1dF9maWVsZC5vbigna2V5dXAnLCBmdW5jdGlvbigpe1xuICAgICAgYWdlbnQuc2V0X21lc3NhZ2UoaW5wdXRfZmllbGQubm9kZSgpLnZhbHVlKVxuICAgIH0pXG5cbiAgICAvL1xuXG4gIH1cblxuICBmdW5jdGlvbiBjb25uZWN0KHJlbW90ZV9hZ2VudCl7XG4gICAgYWdlbnQgPSByZW1vdGVfYWdlbnRcbiAgICBidWZmZXJMZW5ndGggPSByZW1vdGVfYWdlbnQuZ2V0X3N0YXRlKCkuYnVmZmVyLmxlbmd0aFxuICB9XG5cbiAgZnVuY3Rpb24gdGljaygpe1xuXG4gICAgdmFyIHN0YXRlID0gYWdlbnQuZ2V0X3N0YXRlKClcblxuICAgIHZhciBkYXRhQXJyYXkgPSBzdGF0ZS5idWZmZXJcblxuICAgIGlmKGJhcnMubGVuZ3RoID09PSAwKXtcbiAgICAgIGNvbnNvbGUubG9nKE9iamVjdC5rZXlzKHN0YXRlKSlcbiAgICAgIHNldHVwX3N2ZygpXG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYmFyc1tpXS5hdHRyKCdoZWlnaHQnLCAoZGF0YUFycmF5W2ldLzI1NSkgKiBIRUlHSFQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgc3luY19pbmRpY2F0b3IuaHRtbChzdGF0ZS5TWU5DX0NPVU5UKVxuICAgIGRpdl9yeF9idWZmZXIuaHRtbChzdGF0ZS5SWF9CVUZGRVIpXG5cbiAgICB2YXIgYmF1ZCA9IDggKiAoc3RhdGUuUlhfQlVGRkVSLmxlbmd0aCAvICgoRGF0ZS5ub3coKSAtIHN0YXRlLkNPTk5FQ1RFRF9BVCkgLyAxMDAwLjApKVxuICAgIGRpdl9iYXVkX21ldGVyLmh0bWwoYmF1ZC50b0ZpeGVkKDIpKVxuXG4gICAgLy9cbiAgICAvLyBjb25zb2xlLmxvZyhhZ2VudC5nZXRfc3RhdGUoKS5TWU5DX0NPVU5UKVxuXG4gIH1cblxuICByZXR1cm4ge1xuICAgIHRpY2s6IHRpY2ssXG4gICAgY29ubmVjdDogY29ubmVjdFxuICB9XG5cbn1cbiJdfQ==
