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

  var BAUD_RATE = 40
  var parent_baud_rate = d3.select('div#baud_rate').append('div').attr('class','col-md-8 col-md-offset-2')

  parent_baud_rate.append('h4').attr('class', 'text-center').html('modem speed')
  var baud_scale = d3.scale.linear().domain([100,0]).range([16,200])
  var baud_slider = parent_baud_rate.append('input').attr('type','range')
    .attr('min', 0.0)
    .attr('max', 100.0)
    .attr('value', 80.0)

    baud_slider.on('input', function(){
    // console.log(d3.event)
    var v = d3.select(this).node().value

    BAUD_RATE = baud_scale(v)

  })


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

  setTimeout(draw, 500)

  function draw() {

    var o = alice.tick()
    bob.tick()

    display.tick()
    display_bob.tick()

    setTimeout(draw, BAUD_RATE)
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


    var parent_input_slider = parent.append('div').attr('class','col-md-4')

    parent_input_slider.append('h4').attr('class', 'text-center').html('transmitter volume')

    var slider_itself = parent_input_slider.append('input').attr('type','range')
      .attr('min', 0.0)
      .attr('max', 100.0)
      .attr('value', 0.0)

    slider_itself.on('input', function(){
      // console.log(d3.event)
      var v = d3.select(this).node().value
      agent.set_volume(v/100.0)
    })

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
      var v = input_field.node().value
      if(v === ''){
        v = ' '
      }

      agent.set_message(v)
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyIsInB1YmxpYy9qcy92aWV3X2NvbnRyb2xsZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xuXG5tb2R1bGUuZXhwb3J0cy5hZ2VudCA9IGFnZW50XG5cblxuZnVuY3Rpb24gYWdlbnQob3B0cykge1xuXG4gIChmdW5jdGlvbiBzZXR1cF9hdWRpb19jb250ZXh0KCkge1xuICAgIGlmICh3aW5kb3cuY29udGV4dCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zb2xlLmxvZygnY3JlYXRpbmcgbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKScpXG4gICAgICB3aW5kb3cuY29udGV4dCA9IG5ldyB3aW5kb3cuQXVkaW9Db250ZXh0KClcbiAgICB9XG4gICAgY29uc29sZS5sb2coJ2RvbmUuJylcbiAgfSkoKVxuXG4gIHZhciBNRVNTQUdFXG4gIHZhciBNRVNTQUdFX0lEWCA9IDBcbiAgdmFyIFJYX0JVRkZFUiA9ICcnXG4gIHZhciBDT05ORUNURURfQVRcblxuICB2YXIgdHlwZVxuXG4gIHZhciBhbmFseXNlciA9IGNvbnRleHQuY3JlYXRlQW5hbHlzZXIoKVxuICB2YXIgYW5hbHlzZXJEYXRhQXJyYXkgLy8gdGhlIGJ1ZmZlciB0aGUgYW5hbHlzZXIgd3JpdGVzIHRvXG4gIHZhciBidWZmZXJMZW5ndGggLy8gdGhlIGxlbmd0aCBvZiB0aGUgYW5hbHlzZXJEYXRhQXJyYXlcblxuICB2YXIgbG9jYWxBbmFseXNlciA9IGNvbnRleHQuY3JlYXRlQW5hbHlzZXIoKVxuICB2YXIgbG9jYWxBbmFseXNlckRhdGFBcnJheSAvLyB0aGUgYnVmZmVyIHRoZSBhbmFseXNlciB3cml0ZXMgdG9cblxuICB2YXIgcGVha19yYW5nZXMgLy8gZmxhdCBsaXN0IG9mIGluZGV4ZXMgb2YgZGV0ZWN0ZWQgcGVhayByYW5nZXNcbiAgdmFyIGdyb3VwZWRfcGVha19yYW5nZXMgLy8gY2x1c3RlcmVkIGdyb3VwcyBvZiBwZWFrIHJhbmdlc1xuICB2YXIgbWVhbiAvLyB0aGUgdGhyZXNob2xkIGZvciBkZXRlcm1pbmluZyBpZiBhIGJhbmQgaXMgcGVha2VkXG5cbiAgdmFyIGZsaXBfZmxvcCA9IHRydWVcblxuICB2YXIgcHJldl9oaWdoX2NoYW5uZWwgPSAtMVxuICB2YXIgY3VycmVudF9oaWdoX2NoYW5uZWwgPSAwXG4gIHZhciBTWU5DX0NPVU5UID0gMFxuXG4gIHZhciBvc2NfYmFuayA9IFtdXG4gIHZhciBnYWluX2JhbmsgPSBbXVxuXG4gIHZhciBtYXN0ZXJfZ2FpblxuXG4gIHZhciBuX29zYyA9IDEwXG4gIHZhciBmcmVxUmFuZ2UgPSAyNTAwXG4gIHZhciBzcHJlYWQgPSAoZnJlcVJhbmdlIC8gbl9vc2MpXG4gIHZhciBpbml0aWFsRnJlcSA9IDIwMFxuXG4gIHZhciBDVVJSRU5UX1NUQVRFID0gLTFcblxuICBmdW5jdGlvbiB0aWNrKCkge1xuXG4gICAgdmFyIHJldF9vYmogPSB7XG4gICAgICBuZXdfZGF0YTogZmFsc2UsXG4gICAgICBkYXRhOiAnJ1xuICAgIH1cblxuICAgIGlmIChDVVJSRU5UX1NUQVRFIDwgMCkge1xuXG4gICAgICAvLyBwZXJmb3JtaW5nIGluaXRpYWxpemF0aW9uIHByb2Nlc3MsIGRvIG5vdGhpbmdcbiAgICAgIHJldHVybjtcblxuICAgIH0gZWxzZSB7XG5cbiAgICAgIGlmIChDVVJSRU5UX1NUQVRFID09PSAwKSB7XG5cbiAgICAgICAgcmVnaXN0ZXJfcGVha19yYW5nZXMoKVxuXG4gICAgICAgIGlmIChncm91cGVkX3BlYWtfcmFuZ2VzLmxlbmd0aCA9PT0gMTApIHtcbiAgICAgICAgICBDVVJSRU5UX1NUQVRFID0gMVxuICAgICAgICB9XG5cbiAgICAgIH0gZWxzZSBpZiAoQ1VSUkVOVF9TVEFURSA9PT0gMSkge1xuXG4gICAgICAgIHBlcmZvcm1fc2lnbmFsaW5nKClcbiAgICAgICAgbG9va19mb3Jfc2lnbmFsaW5nKClcblxuICAgICAgICBpZiAoU1lOQ19DT1VOVCA+IDIpIHtcbiAgICAgICAgICBDVVJSRU5UX1NUQVRFID0gMlxuICAgICAgICAgIENPTk5FQ1RFRF9BVCA9IERhdGUubm93KClcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2UgaWYgKENVUlJFTlRfU1RBVEUgPT09IDIpIHtcblxuICAgICAgICAvLyBlbmNvZGUgYnl0ZVxuICAgICAgICB2YXIgYnl0ZV90b19zZW5kID0gTUVTU0FHRVtNRVNTQUdFX0lEWF0uY2hhckNvZGVBdCgwKVxuICAgICAgICBlbmNvZGVfYnl0ZShieXRlX3RvX3NlbmQpXG5cbiAgICAgICAgaWYgKGxvb2tfZm9yX3NpZ25hbGluZygpKSB7XG5cbiAgICAgICAgICAvLyByZWFkIGJ5dGVcbiAgICAgICAgICBSWF9CVUZGRVIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShyZWFkX2J5dGVfZnJvbV9zaWduYWwoKSlcblxuICAgICAgICAgIGlmICh0eXBlID09PSAnY2xpZW50Jykge1xuICAgICAgICAgICAgcmV0X29iai5uZXdfZGF0YSA9IHRydWVcbiAgICAgICAgICAgIHJldF9vYmouZGF0YSA9IFN0cmluZy5mcm9tQ2hhckNvZGUocmVhZF9ieXRlX2Zyb21fc2lnbmFsKCkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gaW5jcmVtZW50IGJ5dGUgdG8gZW5jb2RlXG4gICAgICAgICAgTUVTU0FHRV9JRFggKz0gMVxuICAgICAgICAgIE1FU1NBR0VfSURYID0gTUVTU0FHRV9JRFggJSBNRVNTQUdFLmxlbmd0aFxuXG4gICAgICAgICAgcGVyZm9ybV9zaWduYWxpbmcoKVxuXG4gICAgICAgIH1cblxuICAgICAgfSAvLyBlbmQgb2YgQ1VSUkVOVF9TVEFURSA9PT0gMlxuXG4gICAgfVxuXG4gICAgcmV0dXJuIHJldF9vYmpcblxuICB9XG5cblxuICBmdW5jdGlvbiBsb29rX2Zvcl9zaWduYWxpbmcoKSB7XG5cbiAgICB2YXIgdmFsaWRfcmFuZ2VzID0gdmFsaWRhdGVfcmFuZ2VzKClcbiAgICBpZiAodmFsaWRfcmFuZ2VzWzhdID09PSB0cnVlICYmIHZhbGlkX3Jhbmdlc1s5XSA9PT0gZmFsc2UpIHtcbiAgICAgIGN1cnJlbnRfaGlnaF9jaGFubmVsID0gOFxuICAgIH0gZWxzZSB7XG4gICAgICBjdXJyZW50X2hpZ2hfY2hhbm5lbCA9IDlcbiAgICB9XG5cbiAgICB2YXIgZGlmZmVyZW5jZV9mb3VuZCA9IGZhbHNlXG5cbiAgICBpZiAoY3VycmVudF9oaWdoX2NoYW5uZWwgIT09IHByZXZfaGlnaF9jaGFubmVsKSB7XG4gICAgICBkaWZmZXJlbmNlX2ZvdW5kID0gdHJ1ZVxuICAgICAgU1lOQ19DT1VOVCArPSAxXG4gICAgfVxuXG4gICAgcHJldl9oaWdoX2NoYW5uZWwgPSBjdXJyZW50X2hpZ2hfY2hhbm5lbFxuXG4gICAgcmV0dXJuIGRpZmZlcmVuY2VfZm91bmRcblxuICB9XG5cbiAgZnVuY3Rpb24gaW5pdChvcHRzKSB7XG5cbiAgICBtYXN0ZXJfZ2FpbiA9IGNvbnRleHQuY3JlYXRlR2FpbigpXG4gICAgbWFzdGVyX2dhaW4uZ2Fpbi52YWx1ZSA9IDBcbiAgICBtYXN0ZXJfZ2Fpbi5jb25uZWN0KGNvbnRleHQuZGVzdGluYXRpb24pXG5cbiAgICBNRVNTQUdFID0gb3B0cy5tZXNzYWdlXG4gICAgdHlwZSA9IG9wdHMudHlwZVxuXG4gICAgLy8gY3JlYXRlIG9zYyArIGdhaW4gYmFua3NcbiAgICBmb3IgKHZhciBpZHggPSAwOyBpZHggPCBuX29zYzsgaWR4KyspIHtcblxuICAgICAgbGV0IGxvY2FsX29zYyA9IGNvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpXG4gICAgICBsb2NhbF9vc2MuZnJlcXVlbmN5LnZhbHVlID0gKGlkeCAqIHNwcmVhZCkgKyBpbml0aWFsRnJlcVxuXG4gICAgICBsZXQgbG9jYWxfZ2FpbiA9IGNvbnRleHQuY3JlYXRlR2FpbigpXG4gICAgICBsb2NhbF9nYWluLmdhaW4udmFsdWUgPSAxLjAgLyAobl9vc2MpXG5cbiAgICAgIGxvY2FsX29zYy5jb25uZWN0KGxvY2FsX2dhaW4pXG5cbiAgICAgIGxvY2FsX2dhaW4uY29ubmVjdChsb2NhbEFuYWx5c2VyKVxuICAgICAgbG9jYWxfZ2Fpbi5jb25uZWN0KG1hc3Rlcl9nYWluKVxuICAgICAgLy8gbG9jYWxfZ2Fpbi5jb25uZWN0KGNvbnRleHQuZGVzdGluYXRpb24pXG5cbiAgICAgIGxvY2FsX29zYy5zdGFydCgpXG5cbiAgICAgIG9zY19iYW5rLnB1c2gobG9jYWxfb3NjKVxuICAgICAgZ2Fpbl9iYW5rLnB1c2gobG9jYWxfZ2FpbilcblxuICAgIH1cblxuICAgIGFuYWx5c2VyLmZmdFNpemUgPSAxMDI0XG4gICAgYW5hbHlzZXIuc21vb3RoaW5nVGltZUNvbnN0YW50ID0gMFxuICAgIGJ1ZmZlckxlbmd0aCA9IGFuYWx5c2VyLmZyZXF1ZW5jeUJpbkNvdW50XG4gICAgYW5hbHlzZXJEYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXJMZW5ndGgpXG5cbiAgICBsb2NhbEFuYWx5c2VyLmZmdFNpemUgPSAxMDI0XG4gICAgbG9jYWxBbmFseXNlci5zbW9vdGhpbmdUaW1lQ29uc3RhbnQgPSAwXG4gICAgbG9jYWxBbmFseXNlckRhdGFBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlckxlbmd0aClcblxuICB9XG5cbiAgZnVuY3Rpb24gY29ubmVjdChvdGhlcl9hZ2VudCkge1xuXG4gICAgdmFyIG90aGVyX2dhaW5fYmFuayA9IG90aGVyX2FnZW50LmdldF9nYWluX2JhbmsoKVxuXG4gICAgb3RoZXJfZ2Fpbl9iYW5rLmZvckVhY2goZnVuY3Rpb24gKGdhaW5Ob2RlKSB7XG4gICAgICBnYWluTm9kZS5jb25uZWN0KGFuYWx5c2VyKVxuICAgIH0pXG5cbiAgICBnZXRCdWZmZXIoKVxuXG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICBjb25zb2xlLmxvZygnZG9uZSBjb25uZWN0aW5nJylcbiAgICAgIENVUlJFTlRfU1RBVEUgPSAwXG4gICAgfSwgMjAwKVxuXG4gIH1cblxuICBmdW5jdGlvbiBzZXRfbWVzc2FnZShtc2cpe1xuICAgIE1FU1NBR0UgPSBtc2dcbiAgICBNRVNTQUdFX0lEWCA9IDBcbiAgfVxuXG4gIGZ1bmN0aW9uIG5fY2hhbm5lbHMoKSB7XG4gICAgcmV0dXJuIG5fb3NjXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfZ3JvdXBzKCkge1xuICAgIHJldHVybiBncm91cGVkX3BlYWtfcmFuZ2VzXG4gIH1cblxuICBmdW5jdGlvbiBnZXRCdWZmZXIoKSB7XG4gICAgYW5hbHlzZXIuZ2V0Qnl0ZUZyZXF1ZW5jeURhdGEoYW5hbHlzZXJEYXRhQXJyYXkpXG4gICAgcmV0dXJuIGFuYWx5c2VyRGF0YUFycmF5XG4gIH1cbiAgZnVuY3Rpb24gZ2V0X2xvY2FsX2ZyZXF1ZW5jeV9kYXRhX2J1ZmZlcigpIHtcbiAgICBsb2NhbEFuYWx5c2VyLmdldEJ5dGVGcmVxdWVuY3lEYXRhKGxvY2FsQW5hbHlzZXJEYXRhQXJyYXkpXG4gICAgcmV0dXJuIGxvY2FsQW5hbHlzZXJEYXRhQXJyYXlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9nYWluX2JhbmsoKSB7XG4gICAgcmV0dXJuIGdhaW5fYmFua1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2FuYWx5c2VyKCkge1xuICAgIHJldHVybiBhbmFseXNlclxuICB9XG5cblxuICBmdW5jdGlvbiByZWFkX2J5dGVfZnJvbV9zaWduYWwoKSB7XG5cbiAgICB2YXIgcmFuZ2VzID0gdmFsaWRhdGVfcmFuZ2VzKClcblxuICAgIHZhciBiaW5hcnlfc3RyaW5nID0gJydcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IDg7IGkrKykge1xuICAgICAgaWYgKHJhbmdlc1tpXSkge1xuICAgICAgICBiaW5hcnlfc3RyaW5nICs9ICcxJ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYmluYXJ5X3N0cmluZyArPSAnMCdcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcGFyc2VJbnQoYmluYXJ5X3N0cmluZywgMilcblxuICB9XG5cbiAgZnVuY3Rpb24gcmVnaXN0ZXJfcGVha19yYW5nZXMoKSB7XG5cbiAgICBjb25zb2xlLmxvZygncmVnaXN0ZXJpbmcgcGVhayByYW5nZXMnKVxuXG4gICAgZ2V0QnVmZmVyKClcbiAgICBjb25zb2xlLmxvZyhhbmFseXNlckRhdGFBcnJheSlcblxuICAgIC8vIHB1c2ggb24gdG8gbmV3IGFycmF5IGZvciBzb3J0aW5nXG4gICAgdmFyIGQgPSBbXVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyTGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhbmFseXNlckRhdGFBcnJheVtpXSA+IDApIHtcbiAgICAgICAgZC5wdXNoKGFuYWx5c2VyRGF0YUFycmF5W2ldKVxuICAgICAgfVxuICAgIH1cbiAgICBkLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIHJldHVybiBhIC0gYlxuICAgIH0pXG4gICAgY29uc29sZS5sb2coJ01lYW46ICcgKyBkW01hdGguZmxvb3IoZC5sZW5ndGggLyAyKV0pXG5cbiAgICBtZWFuID0gZFtNYXRoLmZsb29yKGQubGVuZ3RoIC8gMildXG5cbiAgICAvL1xuICAgIHBlYWtfcmFuZ2VzID0gW11cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlckxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYW5hbHlzZXJEYXRhQXJyYXlbaV0gPiBtZWFuKSB7XG4gICAgICAgIHBlYWtfcmFuZ2VzLnB1c2goaSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB3aW5kb3cucCA9IHBlYWtfcmFuZ2VzXG5cbiAgICBncm91cF9wZWFrX3JhbmdlcygpXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNoZWNrX3BlYWtfcmFuZ2VzKCkge1xuXG4gICAgZ2V0QnVmZmVyKClcblxuICAgIHZhciBoaXRzID0gW11cbiAgICBwZWFrX3Jhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uIChkYXRhQXJyYXlfaWR4KSB7XG4gICAgICBpZiAoYW5hbHlzZXJEYXRhQXJyYXlbZGF0YUFycmF5X2lkeF0gPiBtZWFuKSB7XG4gICAgICAgIGhpdHMucHVzaCh0cnVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaGl0cy5wdXNoKGZhbHNlKVxuICAgICAgfVxuICAgIH0pXG5cbiAgICByZXR1cm4gaGl0c1xuXG4gIH1cblxuICBmdW5jdGlvbiBncm91cF9wZWFrX3JhbmdlcygpIHtcblxuICAgIGlmIChwZWFrX3JhbmdlcyA9PT0gdW5kZWZpbmVkIHx8IHBlYWtfcmFuZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBncm91cHMgPSBbXSAvLyBbIFsxLDIsM10sIFs4LDksMTBdLCBbMzAsMzEsMzJdICBdXG5cbiAgICB2YXIgY3VycmVudF9ncm91cF9pZHggPSAwXG5cbiAgICB2YXIgbG9jYWxfZ3JvdXAgPSBuZXcgQXJyYXkoKVxuXG4gICAgcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbiAocGVha19pZHgsIGlkeCkge1xuXG4gICAgICAvLyBpZiB0aGUgTWF0aC5hYnMocGVha19pZHggLSBwZWFrX3Jhbmdlc1tpZHgrMV0pID09PSAxXG4gICAgICAvLyAgICBwdXNoIHBlYWtfaWR4IG9uIHRvIGxvY2FsX2dyb3VwXG4gICAgICAvLyBlbHNlXG4gICAgICAvLyAgICBwdXNoIGxvY2FsX2dyb3VwIG9uIHRvIGdyb3Vwc1xuICAgICAgLy8gICAgY2xlYXIgbG9jYWxfZ3JvdXBcbiAgICAgIC8vICAgIHB1c2ggcGVha19pZHggb24gdG8gbG9jYWxfZ3JvdXBcblxuICAgICAgaWYgKGlkeCA9PT0gcGVha19yYW5nZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICAvLyBjb25zb2xlLmxvZygnaGVyZScpXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4ICsgMV0pIDw9IDIpIHtcbiAgICAgICAgbG9jYWxfZ3JvdXAucHVzaChwZWFrX2lkeClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvY2FsX2dyb3VwLnB1c2gocGVha19pZHgpXG4gICAgICAgIGdyb3Vwcy5wdXNoKGxvY2FsX2dyb3VwKVxuICAgICAgICBsb2NhbF9ncm91cCA9IG5ldyBBcnJheSgpXG4gICAgICB9XG5cbiAgICB9KVxuXG4gICAgZ3JvdXBzLnB1c2gobG9jYWxfZ3JvdXApXG5cbiAgICBncm91cGVkX3BlYWtfcmFuZ2VzID0gZ3JvdXBzXG5cbiAgICByZXR1cm4gZ3JvdXBzXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIHNldF9nYWluKGNoYW5uZWwsIHZhbHVlKSB7XG4gICAgZ2Fpbl9iYW5rW2NoYW5uZWxdLmdhaW4udmFsdWUgPSB2YWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0X3ZvbHVtZSh2KXtcbiAgICBpZih2ID49IDEpe1xuICAgICAgdj0xLjBcbiAgICB9XG4gICAgbWFzdGVyX2dhaW4uZ2Fpbi52YWx1ZSA9IHZcbiAgfVxuXG4gIGZ1bmN0aW9uIHZhbGlkYXRlX3JhbmdlcygpIHtcblxuICAgIGlmIChncm91cGVkX3BlYWtfcmFuZ2VzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBnZXRCdWZmZXIoKVxuXG4gICAgdmFyIHZhbGlkX2dyb3VwcyA9IFtdXG5cbiAgICBncm91cGVkX3BlYWtfcmFuZ2VzLmZvckVhY2goZnVuY3Rpb24gKGdyb3VwKSB7XG5cbiAgICAgIHZhciBoaXRzID0gMFxuXG4gICAgICBncm91cC5mb3JFYWNoKGZ1bmN0aW9uIChpZHgpIHtcbiAgICAgICAgaWYgKGFuYWx5c2VyRGF0YUFycmF5W2lkeF0gPj0gbWVhbikge1xuICAgICAgICAgIGhpdHMgKz0gMVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBpZiAoaGl0cyA+PSBncm91cC5sZW5ndGggLyAyKSB7XG4gICAgICAgIHZhbGlkX2dyb3Vwcy5wdXNoKHRydWUpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWxpZF9ncm91cHMucHVzaChmYWxzZSlcbiAgICAgIH1cblxuICAgIH0pXG5cbiAgICByZXR1cm4gdmFsaWRfZ3JvdXBzXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGVuY29kZV9ieXRlKGJ5dGUpIHtcblxuICAgIHZhciBjaGFycyA9IGdldF9lbmNvZGVkX2J5dGVfYXJyYXkoYnl0ZSlcblxuICAgIC8vIGNvbnNvbGUubG9nKGNoYXJzKVxuXG4gICAgY2hhcnMuZm9yRWFjaChmdW5jdGlvbiAoYywgaWR4KSB7XG4gICAgICBpZiAoYyA9PT0gJzAnKSB7XG4gICAgICAgIHNldF9nYWluKGlkeCwgMClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldF9nYWluKGlkeCwgMSAvIG5fb3NjKVxuICAgICAgfVxuICAgIH0pXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIHBlcmZvcm1fc2lnbmFsaW5nKCkge1xuICAgIGZsaXBfZmxvcCA9ICFmbGlwX2Zsb3BcbiAgICBpZiAoZmxpcF9mbG9wKSB7XG4gICAgICBzZXRfZ2Fpbig4LCAxIC8gbl9vc2MpXG4gICAgICBzZXRfZ2Fpbig5LCAwKVxuICAgIH0gZWxzZSB7XG4gICAgICBzZXRfZ2Fpbig5LCAxIC8gbl9vc2MpXG4gICAgICBzZXRfZ2Fpbig4LCAwKVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9lbmNvZGVkX2J5dGVfYXJyYXkoYnl0ZSkge1xuICAgIHJldHVybiBwYWQoYnl0ZS50b1N0cmluZygyKSwgOCkuc3BsaXQoJycpXG4gIH1cblxuICBmdW5jdGlvbiBwYWQobiwgd2lkdGgsIHopIHtcbiAgICB6ID0geiB8fCAnMCc7XG4gICAgbiA9IG4gKyAnJztcbiAgICByZXR1cm4gbi5sZW5ndGggPj0gd2lkdGggPyBuIDogbmV3IEFycmF5KHdpZHRoIC0gbi5sZW5ndGggKyAxKS5qb2luKHopICsgbjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9zdGF0ZSgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgYnVmZmVyOiBnZXRCdWZmZXIoKSxcbiAgICAgIGxvY2FsX2J1ZmZlcjogZ2V0X2xvY2FsX2ZyZXF1ZW5jeV9kYXRhX2J1ZmZlcigpLFxuICAgICAgUlhfQlVGRkVSOiBSWF9CVUZGRVIsXG4gICAgICBDVVJSRU5UX1NUQVRFOiBDVVJSRU5UX1NUQVRFLFxuICAgICAgU1lOQ19DT1VOVDogU1lOQ19DT1VOVCxcbiAgICAgIE1FU1NBR0U6IE1FU1NBR0UsXG4gICAgICBNRVNTQUdFX0lEWDogTUVTU0FHRV9JRFgsXG4gICAgICBDT05ORUNURURfQVQ6IENPTk5FQ1RFRF9BVFxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY2hlY2tfcGVha19yYW5nZXM6IGNoZWNrX3BlYWtfcmFuZ2VzLFxuICAgIGNvbm5lY3Q6IGNvbm5lY3QsXG4gICAgZW5jb2RlX3JhbmdlOiBlbmNvZGVfYnl0ZSxcbiAgICBnZXRCdWZmZXI6IGdldEJ1ZmZlcixcbiAgICBnZXRfYW5hbHlzZXI6IGdldF9hbmFseXNlcixcbiAgICBnZXRfZW5jb2RlZF9ieXRlX2FycmF5OiBnZXRfZW5jb2RlZF9ieXRlX2FycmF5LFxuICAgIGdldF9nYWluX2Jhbms6IGdldF9nYWluX2JhbmssXG4gICAgZ2V0X2dyb3VwczogZ2V0X2dyb3VwcyxcbiAgICBnZXRfbG9jYWxfZnJlcXVlbmN5X2RhdGFfYnVmZmVyOiBnZXRfbG9jYWxfZnJlcXVlbmN5X2RhdGFfYnVmZmVyLFxuICAgIGdldF9zdGF0ZTogZ2V0X3N0YXRlLFxuICAgIGdyb3VwX3BlYWtfcmFuZ2VzOiBncm91cF9wZWFrX3JhbmdlcyxcbiAgICBpbml0OiBpbml0LFxuICAgIG5fY2hhbm5lbHM6IG5fY2hhbm5lbHMsXG4gICAgc2V0X2dhaW46IHNldF9nYWluLFxuICAgIHNldF9tZXNzYWdlOiBzZXRfbWVzc2FnZSxcbiAgICBzZXRfdm9sdW1lOiBzZXRfdm9sdW1lLFxuICAgIHJlYWRfYnl0ZV9mcm9tX3NpZ25hbDogcmVhZF9ieXRlX2Zyb21fc2lnbmFsLFxuICAgIHRpY2s6IHRpY2ssXG4gICAgdmFsaWRhdGVfcmFuZ2VzOiB2YWxpZGF0ZV9yYW5nZXMsXG4gIH07XG5cbn1cbiIsIndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBCQVVEX1JBVEUgPSA0MFxuICB2YXIgcGFyZW50X2JhdWRfcmF0ZSA9IGQzLnNlbGVjdCgnZGl2I2JhdWRfcmF0ZScpLmFwcGVuZCgnZGl2JykuYXR0cignY2xhc3MnLCdjb2wtbWQtOCBjb2wtbWQtb2Zmc2V0LTInKVxuXG4gIHBhcmVudF9iYXVkX3JhdGUuYXBwZW5kKCdoNCcpLmF0dHIoJ2NsYXNzJywgJ3RleHQtY2VudGVyJykuaHRtbCgnbW9kZW0gc3BlZWQnKVxuICB2YXIgYmF1ZF9zY2FsZSA9IGQzLnNjYWxlLmxpbmVhcigpLmRvbWFpbihbMTAwLDBdKS5yYW5nZShbMTYsMjAwXSlcbiAgdmFyIGJhdWRfc2xpZGVyID0gcGFyZW50X2JhdWRfcmF0ZS5hcHBlbmQoJ2lucHV0JykuYXR0cigndHlwZScsJ3JhbmdlJylcbiAgICAuYXR0cignbWluJywgMC4wKVxuICAgIC5hdHRyKCdtYXgnLCAxMDAuMClcbiAgICAuYXR0cigndmFsdWUnLCA4MC4wKVxuXG4gICAgYmF1ZF9zbGlkZXIub24oJ2lucHV0JywgZnVuY3Rpb24oKXtcbiAgICAvLyBjb25zb2xlLmxvZyhkMy5ldmVudClcbiAgICB2YXIgdiA9IGQzLnNlbGVjdCh0aGlzKS5ub2RlKCkudmFsdWVcblxuICAgIEJBVURfUkFURSA9IGJhdWRfc2NhbGUodilcblxuICB9KVxuXG5cbiAgdmFyIHVkcF9tb2RlID0gdHJ1ZVxuXG4gIGNvbnNvbGUubG9nKCdtYWluLmpzIC8gd2luZG93Lm9ubG9hZCBhbm9ueW1vdXMgZnVuY3Rpb24nKVxuXG4gIHZhciBtZXNzYWdlX3RvX3NlbmQgPSAndGhpcyBpcyBhIHRlc3QgdGhhdCB0aGUgbW9kdWxhdGlvbiAvIGRlbW9kdWxhdGlvbiB3b3JrcyBjb3JyZWN0bHknXG4gIHZhciBvdXRwdXRfbXNnID0gJydcblxuICB2YXIgQWdlbnQgPSByZXF1aXJlKCcuL2FnZW50LmpzJylcbiAgdmFyIFZpZXdfQ29udHJvbGxlciA9IHJlcXVpcmUoJy4vdmlld19jb250cm9sbGVyLmpzJylcblxuICB3aW5kb3cuYWxpY2UgPSBBZ2VudC5hZ2VudCgpXG4gIGFsaWNlLmluaXQoe1xuICAgIHR5cGU6ICdjbGllbnQnLFxuICAgIG1lc3NhZ2U6ICcuLi4gPSkgLi4uICdcbiAgfSlcblxuICB3aW5kb3cuYm9iID0gQWdlbnQuYWdlbnQoKVxuICBib2IuaW5pdCh7XG4gICAgdHlwZTogJ3NlcnZlcicsXG4gICAgbWVzc2FnZTogbWVzc2FnZV90b19zZW5kXG4gIH0pXG5cbiAgdmFyIGRpc3BsYXkgPSBWaWV3X0NvbnRyb2xsZXIudmlld19jb250cm9sbGVyKCdhbGljZV9tb2RlbScpXG4gIGRpc3BsYXkuY29ubmVjdChhbGljZSlcblxuICB2YXIgZGlzcGxheV9ib2IgPSBWaWV3X0NvbnRyb2xsZXIudmlld19jb250cm9sbGVyKCdib2JfbW9kZW0nKVxuICBkaXNwbGF5X2JvYi5jb25uZWN0KGJvYilcblxuICBhbGljZS5jb25uZWN0KGJvYilcbiAgYm9iLmNvbm5lY3QoYWxpY2UpXG5cbiAgc2V0VGltZW91dChkcmF3LCA1MDApXG5cbiAgZnVuY3Rpb24gZHJhdygpIHtcblxuICAgIHZhciBvID0gYWxpY2UudGljaygpXG4gICAgYm9iLnRpY2soKVxuXG4gICAgZGlzcGxheS50aWNrKClcbiAgICBkaXNwbGF5X2JvYi50aWNrKClcblxuICAgIHNldFRpbWVvdXQoZHJhdywgQkFVRF9SQVRFKVxuICAgIC8vIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZHJhdyk7XG5cbiAgfVxuXG59XG4iLCJtb2R1bGUuZXhwb3J0cy52aWV3X2NvbnRyb2xsZXIgPSB2aWV3X2NvbnRyb2xsZXJcblxuZnVuY3Rpb24gdmlld19jb250cm9sbGVyKGRpdl9pZCl7XG5cbiAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgdmFyIG5hbWUgPSBkaXZfaWRcblxuICB2YXIgYWdlbnRcbiAgdmFyIHBhcmVudCA9IGQzLnNlbGVjdCgnZGl2IycrZGl2X2lkKVxuXG4gIC8vIGRpc3BsYXlcbiAgLy8gICAgY3VycmVudCBzdGF0ZVxuICAvLyAgICBzeW5jIGNvdW50XG4gIC8vICAgIG9zY2lsbG9zY29wZSBvZiBvdXRwdXQgJiBpbnB1dFxuICAvLyAgICBmZnQgYmFycyBvZiBvdXRwdXQgJiBpbnB1dFxuICAvLyAgICBjdXJyZW50IGJhdWRcbiAgLy8gICAgcnggYnVmZmVyXG5cbiAgdmFyIHN2Z1xuICB2YXIgZGl2X3N5bmNfY291bnRcbiAgdmFyIHN5bmNfaW5kaWNhdG9yXG4gIHZhciBkaXZfcnhfYnVmZmVyXG4gIHZhciBkaXZfYmF1ZF9tZXRlclxuICB2YXIgYmFycyA9IFtdXG5cbiAgdmFyIFdJRFRIID0gMTAyNFxuICB2YXIgSEVJR0hUID0gMjU2XG5cbiAgdmFyIGJhcldpZHRoXG4gIHZhciBidWZmZXJMZW5ndGhcbiAgLy8gdmFyIGJhckhlaWdodFxuXG4gIC8vIGNyZWF0ZSBzdmdcbiAgZnVuY3Rpb24gc2V0dXBfc3ZnKCl7XG5cbiAgICB2YXIgc3RhdGUgPSBhZ2VudC5nZXRfc3RhdGUoKVxuXG4gICAgV0lEVEggPSBidWZmZXJMZW5ndGhcbiAgICBIRUlHSFQgPSBXSURUSCAvNFxuXG4gICAgYmFyV2lkdGggPSAoV0lEVEggLyBidWZmZXJMZW5ndGgpXG5cbiAgICBwYXJlbnQuYXBwZW5kKCdoMScpLmF0dHIoJ2NsYXNzJywndGV4dC1jZW50ZXInKS5odG1sKG5hbWUpXG5cbiAgICBzdmcgPSBwYXJlbnQuYXBwZW5kKCdzdmcnKVxuICAgICAgLmF0dHIoJ2NsYXNzJywgJ2ltZy1yZXNwb25zaXZlJylcbiAgICAgIC5hdHRyKCd3aWR0aCcsICcxMDAlJylcbiAgICAgIC8vIC5hdHRyKCdoZWlnaHQnLCBIRUlHSFQpXG4gICAgICAuYXR0cigncHJlc2VydmVBc3BlY3RSYXRpbycsICd4TWlkWU1pZCcpXG4gICAgICAuYXR0cigndmlld0JveCcsICcwIDAgJyArIFdJRFRIICsgJyAnICsgSEVJR0hUKVxuICAgICAgLnN0eWxlKCdiYWNrZ3JvdW5kLWNvbG9yJywgJ3JnYmEoMCwwLDAsMC4xKScpXG5cbiAgICBzdmcuYXBwZW5kKCd0ZXh0JylcbiAgICAgIC50ZXh0KCdyZWNlaXZlciBzcGVjdHJ1bScpXG4gICAgICAuYXR0cigneCcsIFdJRFRIKVxuICAgICAgLmF0dHIoJ3knLCAxMilcbiAgICAgIC5hdHRyKCdkeCcsICctNHB4JylcbiAgICAgIC5zdHlsZSgnZm9udC1zaXplJywgMTIpXG4gICAgICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ2VuZCcpXG4gICAgICAuYXR0cignZmlsbCcsICdyZ2JhKDAsMCwwLDAuMSknKVxuXG5cbiAgICBiYXJzID0gW11cbiAgICBmb3IgKHZhciBzdmdiYXJzID0gMDsgc3ZnYmFycyA8IGJ1ZmZlckxlbmd0aDsgc3ZnYmFycysrKSB7XG4gICAgICB2YXIgYmFyID0gc3ZnLmFwcGVuZCgncmVjdCcpXG4gICAgICAgIC5hdHRyKCd4JywgYmFyV2lkdGggKiBzdmdiYXJzKVxuICAgICAgICAuYXR0cigneScsIDApXG4gICAgICAgIC5hdHRyKCd3aWR0aCcsIGJhcldpZHRoKVxuICAgICAgICAuYXR0cignaGVpZ2h0JywgMClcbiAgICAgICAgLmF0dHIoJ2ZpbGwnLCAnZ3JlZW4nKVxuICAgICAgICAuYXR0cignc3Ryb2tlJywgJ25vbmUnKVxuXG4gICAgICBsZXQgYmFyX2lkeCA9IHN2Z2JhcnNcbiAgICAgIGJhci5vbignbW91c2VvdmVyJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhiYXJfaWR4KVxuICAgICAgfSlcblxuICAgICAgYmFycy5wdXNoKGJhcilcbiAgICB9XG5cbiAgICAvLyBzeW5jIGNvdW50XG4gICAgZGl2X3N5bmNfY291bnQgPSBwYXJlbnQuYXBwZW5kKCdkaXYnKVxuICAgICAgLmF0dHIoJ2NsYXNzJywnY29sLW1kLTQnKVxuICAgICAgLnN0eWxlKCdvdXRsaW5lJywgJzFweCBkb3R0ZWQgcmdiYSgwLDAsMCwwLjEpJylcblxuICAgIGRpdl9zeW5jX2NvdW50LmFwcGVuZCgnaDQnKS5hdHRyKCdjbGFzcycsICd0ZXh0LWNlbnRlcicpLmh0bWwoJ3N5bmNocm9uaXphdGlvbiBjb3VudHMnKVxuICAgIHN5bmNfaW5kaWNhdG9yID0gZGl2X3N5bmNfY291bnQuYXBwZW5kKCdkaXYnKS5hdHRyKCdjbGFzcycsICd0ZXh0LWNlbnRlciBzeW5jX2NvdW50JylcblxuICAgIC8vIGJhdWQgbWV0ZXJcbiAgICB2YXIgcGFyZW50X2JhdWRfbWV0ZXIgPSBwYXJlbnQuYXBwZW5kKCdkaXYnKS5hdHRyKCdjbGFzcycsJ2NvbC1tZC00JylcbiAgICAgIC5zdHlsZSgnb3V0bGluZScsICcxcHggZG90dGVkIHJnYmEoMCwwLDAsMC4xKScpXG5cbiAgICBwYXJlbnRfYmF1ZF9tZXRlci5hcHBlbmQoJ2g0JykuYXR0cignY2xhc3MnLCAndGV4dC1jZW50ZXInKS5odG1sKCdiYXVkJylcbiAgICBkaXZfYmF1ZF9tZXRlciA9IHBhcmVudF9iYXVkX21ldGVyLmFwcGVuZCgnZGl2JykuYXR0cignY2xhc3MnLCAndGV4dC1jZW50ZXInKVxuXG5cbiAgICB2YXIgcGFyZW50X2lucHV0X3NsaWRlciA9IHBhcmVudC5hcHBlbmQoJ2RpdicpLmF0dHIoJ2NsYXNzJywnY29sLW1kLTQnKVxuXG4gICAgcGFyZW50X2lucHV0X3NsaWRlci5hcHBlbmQoJ2g0JykuYXR0cignY2xhc3MnLCAndGV4dC1jZW50ZXInKS5odG1sKCd0cmFuc21pdHRlciB2b2x1bWUnKVxuXG4gICAgdmFyIHNsaWRlcl9pdHNlbGYgPSBwYXJlbnRfaW5wdXRfc2xpZGVyLmFwcGVuZCgnaW5wdXQnKS5hdHRyKCd0eXBlJywncmFuZ2UnKVxuICAgICAgLmF0dHIoJ21pbicsIDAuMClcbiAgICAgIC5hdHRyKCdtYXgnLCAxMDAuMClcbiAgICAgIC5hdHRyKCd2YWx1ZScsIDAuMClcblxuICAgIHNsaWRlcl9pdHNlbGYub24oJ2lucHV0JywgZnVuY3Rpb24oKXtcbiAgICAgIC8vIGNvbnNvbGUubG9nKGQzLmV2ZW50KVxuICAgICAgdmFyIHYgPSBkMy5zZWxlY3QodGhpcykubm9kZSgpLnZhbHVlXG4gICAgICBhZ2VudC5zZXRfdm9sdW1lKHYvMTAwLjApXG4gICAgfSlcblxuICAgIC8vIHJ4IGJ1ZmZlclxuICAgIHZhciBkaXZfcnhfYnVmZmVyX3BhcmVudCA9IHBhcmVudC5hcHBlbmQoJ2RpdicpXG4gICAgICAuYXR0cignY2xhc3MnLCAnY29sLW1kLTEyJylcblxuICAgIGRpdl9yeF9idWZmZXJfcGFyZW50LmFwcGVuZCgnaDQnKS5hdHRyKCdjbGFzcycsJ3RleHQtbGVmdCcpLmh0bWwoJ3J4IGJ1ZmZlcicpXG5cbiAgICBkaXZfcnhfYnVmZmVyID0gZGl2X3J4X2J1ZmZlcl9wYXJlbnQuYXBwZW5kKCdwcmUnKS5hdHRyKCdjbGFzcycsICdyeF9idWZmZXInKVxuXG4gICAgLy8gbWVzc2FnZSB0byBzZW5kXG4gICAgdmFyIHBhcmVudF9tZXNzYWdlX3RvX3NlbmQgPSBwYXJlbnQuYXBwZW5kKCdkaXYnKS5hdHRyKCdjbGFzcycsICdjb2wtbWQtMTInKVxuXG4gICAgcGFyZW50X21lc3NhZ2VfdG9fc2VuZC5hcHBlbmQoJ2RpdicpLmF0dHIoJ2NsYXNzJywndGV4dC1jZW50ZXInKS5odG1sKCdzZW5kaW5nIHRoaXMgbWVzc2FnZTonKVxuXG4gICAgdmFyIGlucHV0X2ZpZWxkID0gcGFyZW50X21lc3NhZ2VfdG9fc2VuZC5hcHBlbmQoJ2lucHV0JylcbiAgICAgIC5hdHRyKCd0eXBlJywgJ3RleHQnKVxuICAgICAgLmF0dHIoJ2NsYXNzJywgJ21zZ19pbnB1dCcpXG5cbiAgICBpbnB1dF9maWVsZC5ub2RlKCkudmFsdWUgPSBzdGF0ZS5NRVNTQUdFXG5cbiAgICBpbnB1dF9maWVsZC5vbigna2V5dXAnLCBmdW5jdGlvbigpe1xuICAgICAgdmFyIHYgPSBpbnB1dF9maWVsZC5ub2RlKCkudmFsdWVcbiAgICAgIGlmKHYgPT09ICcnKXtcbiAgICAgICAgdiA9ICcgJ1xuICAgICAgfVxuXG4gICAgICBhZ2VudC5zZXRfbWVzc2FnZSh2KVxuICAgIH0pXG5cbiAgICAvL1xuXG4gIH1cblxuICBmdW5jdGlvbiBjb25uZWN0KHJlbW90ZV9hZ2VudCl7XG4gICAgYWdlbnQgPSByZW1vdGVfYWdlbnRcbiAgICBidWZmZXJMZW5ndGggPSByZW1vdGVfYWdlbnQuZ2V0X3N0YXRlKCkuYnVmZmVyLmxlbmd0aFxuICB9XG5cbiAgZnVuY3Rpb24gdGljaygpe1xuXG4gICAgdmFyIHN0YXRlID0gYWdlbnQuZ2V0X3N0YXRlKClcblxuICAgIHZhciBkYXRhQXJyYXkgPSBzdGF0ZS5idWZmZXJcblxuICAgIGlmKGJhcnMubGVuZ3RoID09PSAwKXtcbiAgICAgIGNvbnNvbGUubG9nKE9iamVjdC5rZXlzKHN0YXRlKSlcbiAgICAgIHNldHVwX3N2ZygpXG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYmFyc1tpXS5hdHRyKCdoZWlnaHQnLCAoZGF0YUFycmF5W2ldLzI1NSkgKiBIRUlHSFQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgc3luY19pbmRpY2F0b3IuaHRtbChzdGF0ZS5TWU5DX0NPVU5UKVxuICAgIGRpdl9yeF9idWZmZXIuaHRtbChzdGF0ZS5SWF9CVUZGRVIpXG5cbiAgICB2YXIgYmF1ZCA9IDggKiAoc3RhdGUuUlhfQlVGRkVSLmxlbmd0aCAvICgoRGF0ZS5ub3coKSAtIHN0YXRlLkNPTk5FQ1RFRF9BVCkgLyAxMDAwLjApKVxuICAgIGRpdl9iYXVkX21ldGVyLmh0bWwoYmF1ZC50b0ZpeGVkKDIpKVxuXG4gICAgLy9cbiAgICAvLyBjb25zb2xlLmxvZyhhZ2VudC5nZXRfc3RhdGUoKS5TWU5DX0NPVU5UKVxuXG4gIH1cblxuICByZXR1cm4ge1xuICAgIHRpY2s6IHRpY2ssXG4gICAgY29ubmVjdDogY29ubmVjdFxuICB9XG5cbn1cbiJdfQ==
