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
  var freqRange = 5000
  var spread = (freqRange / n_osc)
  var initialFreq = 200

  // init()
  // getBuffer()

  function poll(){

    var valid_ranges = validate_ranges()
    // console.log(valid_ranges)

    if(prev_high_channel !== -1){
      prev_high_channel = current_high_channel
    }


    if(valid_ranges[8] === true && valid_ranges[9] === false){
      current_high_channel = 8
    } else {
      current_high_channel = 9
    }

    // console.log(current_high_channel, prev_high_channel)

    if(current_high_channel !== prev_high_channel){
      fresh_data = true
    }

    if(fresh_data){
      // console.log('found fresh data')
      // console.log(read_byte_from_signal())
    }

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
      local_gain.connect(context.destination)

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

    console.log(ranges)

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

  console.log('main.js / window.onload anonymous function')

  var message_to_send = '<3 Lindsey Bacon and the baby and skittie bees and mr d and yeah'
  var message_idx = 0


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
    if(counter % 30 === 1){

      // console.clear()
      // console.log(Date.now())

      alice.getBuffer()
      for(i=0;i<bufferLength;i++){
        bars[i].attr('height', dataArray[i])
      }

      if(alice.poll()){

        var alice_reads = alice.read_byte_from_signal()

        console.log('alice reads: ' + alice_reads)
        console.log()

        document.write(String.fromCharCode(alice_reads))

        window.byte_to_code = message_to_send[message_idx].charCodeAt(0)
        message_idx += 1
        message_idx = message_idx % message_to_send.length

        bob.encode_range(window.byte_to_code)

      } else {
        console.log('miss')
      }

    }

    window.requestAnimationFrame(draw);

  }

  setTimeout(draw,500)
  // draw()


}

},{"./agent.js":1}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvanMvYWdlbnQuanMiLCJwdWJsaWMvanMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMuYWdlbnQgPSBhZ2VudFxuXG5cbmZ1bmN0aW9uIGFnZW50KCl7XG5cbiAgLy8gY2hlY2sgZm9yIGdsb2JhbCBhdWRpbyBjdHhcbiAgLy8gdmFyIGNvbnRleHRcblxuICBpZih3aW5kb3cuY29udGV4dCA9PT0gdW5kZWZpbmVkKXtcbiAgICBjb25zb2xlLmxvZygnY3JlYXRpbmcgbmV3IHdpbmRvdy5BdWRpb0NvbnRleHQoKScpXG4gICAgd2luZG93LmNvbnRleHQgPSBuZXcgd2luZG93LkF1ZGlvQ29udGV4dCgpXG4gICAgLy8gdmFyIGNvbnRleHQgPSBuZXcgd2luZG93LkF1ZGlvQ29udGV4dCgpXG4gIH0gZWxzZSB7XG4gICAgLy8gY29udGV4dCA9IHdpbmRvdy5jb250ZXh0XG4gIH1cblxuICB2YXIgYW5hbHlzZXIgPSBjb250ZXh0LmNyZWF0ZUFuYWx5c2VyKClcbiAgLy8gdmFyIGxvY2FsX2FuYWx5c2VyID0gd2luZG93LmNvbnRleHQuY3JlYXRlQW5hbHlzZXIoKVxuICB2YXIgYW5hbHlzZXJEYXRhQXJyYXlcbiAgdmFyIGJ1ZmZlckxlbmd0aFxuXG4gIHZhciBwZWFrX3Jhbmdlc1xuICB2YXIgbWVhblxuICB2YXIgZ3JvdXBlZF9wZWFrX3Jhbmdlc1xuXG4gIHZhciBmbGlwX2Zsb3AgPSB0cnVlXG5cbiAgdmFyIHByZXZfaGlnaF9jaGFubmVsID0gLTFcbiAgdmFyIGN1cnJlbnRfaGlnaF9jaGFubmVsID0gMFxuICB2YXIgZnJlc2hfZGF0YSA9IGZhbHNlXG5cbiAgdmFyIG9zY19iYW5rID0gW11cbiAgdmFyIGdhaW5fYmFuayA9IFtdXG5cbiAgdmFyIG5fb3NjID0gMTBcbiAgdmFyIGZyZXFSYW5nZSA9IDUwMDBcbiAgdmFyIHNwcmVhZCA9IChmcmVxUmFuZ2UgLyBuX29zYylcbiAgdmFyIGluaXRpYWxGcmVxID0gMjAwXG5cbiAgLy8gaW5pdCgpXG4gIC8vIGdldEJ1ZmZlcigpXG5cbiAgZnVuY3Rpb24gcG9sbCgpe1xuXG4gICAgdmFyIHZhbGlkX3JhbmdlcyA9IHZhbGlkYXRlX3JhbmdlcygpXG4gICAgLy8gY29uc29sZS5sb2codmFsaWRfcmFuZ2VzKVxuXG4gICAgaWYocHJldl9oaWdoX2NoYW5uZWwgIT09IC0xKXtcbiAgICAgIHByZXZfaGlnaF9jaGFubmVsID0gY3VycmVudF9oaWdoX2NoYW5uZWxcbiAgICB9XG5cblxuICAgIGlmKHZhbGlkX3Jhbmdlc1s4XSA9PT0gdHJ1ZSAmJiB2YWxpZF9yYW5nZXNbOV0gPT09IGZhbHNlKXtcbiAgICAgIGN1cnJlbnRfaGlnaF9jaGFubmVsID0gOFxuICAgIH0gZWxzZSB7XG4gICAgICBjdXJyZW50X2hpZ2hfY2hhbm5lbCA9IDlcbiAgICB9XG5cbiAgICAvLyBjb25zb2xlLmxvZyhjdXJyZW50X2hpZ2hfY2hhbm5lbCwgcHJldl9oaWdoX2NoYW5uZWwpXG5cbiAgICBpZihjdXJyZW50X2hpZ2hfY2hhbm5lbCAhPT0gcHJldl9oaWdoX2NoYW5uZWwpe1xuICAgICAgZnJlc2hfZGF0YSA9IHRydWVcbiAgICB9XG5cbiAgICBpZihmcmVzaF9kYXRhKXtcbiAgICAgIC8vIGNvbnNvbGUubG9nKCdmb3VuZCBmcmVzaCBkYXRhJylcbiAgICAgIC8vIGNvbnNvbGUubG9nKHJlYWRfYnl0ZV9mcm9tX3NpZ25hbCgpKVxuICAgIH1cblxuICAgIHJldHVybiBmcmVzaF9kYXRhXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGluaXQobmFtZSl7XG5cbiAgICAvLyBjcmVhdGUgb3NjICsgZ2FpbiBiYW5rc1xuICAgIGZvcih2YXIgaWR4ID0gMDsgaWR4IDwgbl9vc2M7IGlkeCsrKXtcblxuICAgICAgbGV0IGxvY2FsX29zYyA9IGNvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpXG4gICAgICBsb2NhbF9vc2MuZnJlcXVlbmN5LnZhbHVlID0gKGlkeCAqIHNwcmVhZCkgKyBpbml0aWFsRnJlcVxuXG4gICAgICBsZXQgbG9jYWxfZ2FpbiA9IGNvbnRleHQuY3JlYXRlR2FpbigpXG4gICAgICBsb2NhbF9nYWluLmdhaW4udmFsdWUgPSAxLjAgLyAobl9vc2MpXG5cbiAgICAgIGxvY2FsX29zYy5jb25uZWN0KGxvY2FsX2dhaW4pXG5cbiAgICAgIC8vIGxvY2FsX2dhaW4uY29ubmVjdChhbmFseXNlcilcbiAgICAgIGxvY2FsX2dhaW4uY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKVxuXG4gICAgICBsb2NhbF9vc2Muc3RhcnQoKVxuXG4gICAgICBvc2NfYmFuay5wdXNoKGxvY2FsX29zYylcbiAgICAgIGdhaW5fYmFuay5wdXNoKGxvY2FsX2dhaW4pXG5cbiAgICB9XG5cbiAgICBhbmFseXNlci5uYW1lID0gbmFtZVxuICAgIGFuYWx5c2VyLmZmdFNpemUgPSAxMDI0XG4gICAgYW5hbHlzZXIuc21vb3RoaW5nVGltZUNvbnN0YW50ID0gMFxuICAgIGJ1ZmZlckxlbmd0aCA9IGFuYWx5c2VyLmZyZXF1ZW5jeUJpbkNvdW50XG4gICAgYW5hbHlzZXJEYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXJMZW5ndGgpXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbm5lY3Qob3RoZXJfYWdlbnQpe1xuXG4gICAgdmFyIG90aGVyX2dhaW5fYmFuayA9IG90aGVyX2FnZW50LmdldF9nYWluX2JhbmsoKVxuICAgIC8vIGNvbnNvbGUubG9nKG90aGVyX2FuYWx5c2VyKVxuXG4gICAgb3RoZXJfZ2Fpbl9iYW5rLmZvckVhY2goZnVuY3Rpb24oZ2Fpbk5vZGUpe1xuICAgICAgLy8gY29uc29sZS5sb2coZ2Fpbk5vZGUpXG4gICAgICBnYWluTm9kZS5jb25uZWN0KGFuYWx5c2VyKVxuICAgIH0pXG5cbiAgICBnZXRCdWZmZXIoKVxuXG4gICAgc2V0VGltZW91dChyZWdpc3Rlcl9wZWFrX3JhbmdlcywyMDApXG5cbiAgfVxuXG5cbiAgZnVuY3Rpb24gbl9jaGFubmVscygpe1xuICAgIHJldHVybiBuX29zY1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0X2dyb3Vwcygpe1xuICAgIHJldHVybiBncm91cGVkX3BlYWtfcmFuZ2VzXG4gIH1cblxuICBmdW5jdGlvbiBnZXRCdWZmZXIoKXtcbiAgICBhbmFseXNlci5nZXRCeXRlRnJlcXVlbmN5RGF0YShhbmFseXNlckRhdGFBcnJheSlcbiAgICByZXR1cm4gYW5hbHlzZXJEYXRhQXJyYXlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldF9nYWluX2JhbmsoKXtcbiAgICByZXR1cm4gZ2Fpbl9iYW5rXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfYW5hbHlzZXIoKXtcbiAgICByZXR1cm4gYW5hbHlzZXJcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlZ2lzdGVyX3BlYWtfcmFuZ2VzKCl7XG5cbiAgICBjb25zb2xlLmxvZygncmVnaXN0ZXJpbmcgcGVhayByYW5nZXMnKVxuXG4gICAgZ2V0QnVmZmVyKClcbiAgICBjb25zb2xlLmxvZyhhbmFseXNlckRhdGFBcnJheSlcblxuICAgIC8vIHB1c2ggb24gdG8gbmV3IGFycmF5IGZvciBzb3J0aW5nXG4gICAgdmFyIGQgPSBbXVxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBidWZmZXJMZW5ndGg7IGkrKyl7XG4gICAgICBpZihhbmFseXNlckRhdGFBcnJheVtpXSA+IDApe1xuICAgICAgICBkLnB1c2goYW5hbHlzZXJEYXRhQXJyYXlbaV0pXG4gICAgICB9XG4gICAgfVxuICAgIGQuc29ydChmdW5jdGlvbihhLGIpe1xuICAgICAgcmV0dXJuIGEtYlxuICAgIH0pXG4gICAgY29uc29sZS5sb2coJ01lYW46ICcrZFtNYXRoLmZsb29yKGQubGVuZ3RoLzIpXSlcblxuICAgIG1lYW4gPSBkW01hdGguZmxvb3IoZC5sZW5ndGgvMildXG5cbiAgICAvL1xuICAgIHBlYWtfcmFuZ2VzID0gW11cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgYnVmZmVyTGVuZ3RoOyBpKyspe1xuICAgICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbaV0gPiBtZWFuKXtcbiAgICAgICAgcGVha19yYW5nZXMucHVzaChpKVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHdpbmRvdy5wID0gcGVha19yYW5nZXNcblxuICAgIGdyb3VwX3BlYWtfcmFuZ2VzKClcblxuICB9XG5cbiAgZnVuY3Rpb24gY2hlY2tfcGVha19yYW5nZXMoKXtcblxuICAgIGdldEJ1ZmZlcigpXG5cbiAgICB2YXIgaGl0cyA9IFtdXG4gICAgcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbihkYXRhQXJyYXlfaWR4KXtcbiAgICAgIGlmKGFuYWx5c2VyRGF0YUFycmF5W2RhdGFBcnJheV9pZHhdID4gbWVhbil7XG4gICAgICAgIGhpdHMucHVzaCh0cnVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaGl0cy5wdXNoKGZhbHNlKVxuICAgICAgfVxuICAgIH0pXG5cbiAgICByZXR1cm4gaGl0c1xuXG4gIH1cblxuICBmdW5jdGlvbiBncm91cF9wZWFrX3Jhbmdlcygpe1xuXG4gICAgaWYocGVha19yYW5nZXMgPT09IHVuZGVmaW5lZCB8fCBwZWFrX3Jhbmdlcy5sZW5ndGggPT09IDApe1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBncm91cHMgPSBbXSAvLyBbIFsxLDIsM10sIFs4LDksMTBdLCBbMzAsMzEsMzJdICBdXG5cbiAgICB2YXIgY3VycmVudF9ncm91cF9pZHggPSAwXG5cbiAgICB2YXIgbG9jYWxfZ3JvdXAgPSBuZXcgQXJyYXkoKVxuXG4gICAgcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbihwZWFrX2lkeCwgaWR4KXtcblxuICAgICAgLy8gaWYgdGhlIE1hdGguYWJzKHBlYWtfaWR4IC0gcGVha19yYW5nZXNbaWR4KzFdKSA9PT0gMVxuICAgICAgLy8gICAgcHVzaCBwZWFrX2lkeCBvbiB0byBsb2NhbF9ncm91cFxuICAgICAgLy8gZWxzZVxuICAgICAgLy8gICAgcHVzaCBsb2NhbF9ncm91cCBvbiB0byBncm91cHNcbiAgICAgIC8vICAgIGNsZWFyIGxvY2FsX2dyb3VwXG4gICAgICAvLyAgICBwdXNoIHBlYWtfaWR4IG9uIHRvIGxvY2FsX2dyb3VwXG5cbiAgICAgIGlmKGlkeCA9PT0gcGVha19yYW5nZXMubGVuZ3RoLTEpe1xuICAgICAgICAvLyBjb25zb2xlLmxvZygnaGVyZScpXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYoTWF0aC5hYnMocGVha19pZHggLSBwZWFrX3Jhbmdlc1tpZHgrMV0pIDw9IDIpe1xuICAgICAgICBsb2NhbF9ncm91cC5wdXNoKHBlYWtfaWR4KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbG9jYWxfZ3JvdXAucHVzaChwZWFrX2lkeClcbiAgICAgICAgZ3JvdXBzLnB1c2gobG9jYWxfZ3JvdXApXG4gICAgICAgIGxvY2FsX2dyb3VwID0gbmV3IEFycmF5KClcbiAgICAgIH1cblxuICAgIH0pXG5cbiAgICBncm91cHMucHVzaChsb2NhbF9ncm91cClcblxuICAgIGdyb3VwZWRfcGVha19yYW5nZXMgPSBncm91cHNcblxuICAgIHJldHVybiBncm91cHNcblxuICB9XG5cbiAgZnVuY3Rpb24gc2V0X2dhaW4oY2hhbm5lbCwgdmFsdWUpe1xuICAgIC8vIGNoYW5uZWwgPSAobl9vc2MtMSkgLSBjaGFubmVsXG4gICAgZ2Fpbl9iYW5rW2NoYW5uZWxdLmdhaW4udmFsdWUgPSB2YWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gdmFsaWRhdGVfcmFuZ2VzKCl7XG5cbiAgICBpZihncm91cGVkX3BlYWtfcmFuZ2VzID09PSB1bmRlZmluZWQpe1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGdldEJ1ZmZlcigpXG5cbiAgICB2YXIgdmFsaWRfZ3JvdXBzID0gW11cblxuICAgIGdyb3VwZWRfcGVha19yYW5nZXMuZm9yRWFjaChmdW5jdGlvbihncm91cCl7XG5cbiAgICAgIC8vIGZvciBlYWNoIGVudHJ5IGluIHRoZSBncm91cFxuICAgICAgdmFyIGhpdHMgPSAwXG5cbiAgICAgIGdyb3VwLmZvckVhY2goZnVuY3Rpb24oaWR4KXtcbiAgICAgICAgaWYoYW5hbHlzZXJEYXRhQXJyYXlbaWR4XSA+PSBtZWFuKXtcbiAgICAgICAgICBoaXRzICs9IDFcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgLy8gY29uc29sZS5sb2coaGl0cylcblxuICAgICAgaWYoaGl0cyA+PSBncm91cC5sZW5ndGgvMil7XG4gICAgICAgIHZhbGlkX2dyb3Vwcy5wdXNoKHRydWUpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWxpZF9ncm91cHMucHVzaChmYWxzZSlcbiAgICAgIH1cblxuICAgIH0pXG5cbiAgICByZXR1cm4gdmFsaWRfZ3JvdXBzXG5cbiAgfVxuXG4gIGZ1bmN0aW9uIGVuY29kZV9ieXRlKGJ5dGUpe1xuXG4gICAgdmFyIGNoYXJzID0gZ2V0X2VuY29kZWRfYnl0ZV9hcnJheShieXRlKVxuXG4gICAgLy8gY29uc29sZS5sb2coY2hhcnMpXG5cbiAgICBjaGFycy5mb3JFYWNoKGZ1bmN0aW9uKGMsaWR4KXtcbiAgICAgIGlmKGMgPT09ICcwJyl7XG4gICAgICAgIHNldF9nYWluKGlkeCwwKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0X2dhaW4oaWR4LDEvbl9vc2MpXG4gICAgICB9XG4gICAgfSlcblxuICAgIGZsaXBfZmxvcCA9ICFmbGlwX2Zsb3BcbiAgICBpZihmbGlwX2Zsb3Ape1xuICAgICAgc2V0X2dhaW4oOCwxL25fb3NjKVxuICAgICAgc2V0X2dhaW4oOSwwKVxuICAgIH0gZWxzZSB7XG4gICAgICBzZXRfZ2Fpbig5LDEvbl9vc2MpXG4gICAgICBzZXRfZ2Fpbig4LDApXG4gICAgfVxuXG4gIH1cblxuICBmdW5jdGlvbiBnZXRfZW5jb2RlZF9ieXRlX2FycmF5KGJ5dGUpe1xuICAgIHJldHVybiBwYWQoYnl0ZS50b1N0cmluZygyKSw4KS5zcGxpdCgnJylcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRfYnl0ZV9mcm9tX3NpZ25hbCgpe1xuXG4gICAgdmFyIHJhbmdlcyA9IHZhbGlkYXRlX3JhbmdlcygpXG5cbiAgICBjb25zb2xlLmxvZyhyYW5nZXMpXG5cbiAgICB2YXIgYmluYXJ5X3N0cmluZyA9ICcnXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IDg7IGkrKyl7XG4gICAgICBpZihyYW5nZXNbaV0pe1xuICAgICAgICBiaW5hcnlfc3RyaW5nICs9ICcxJ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYmluYXJ5X3N0cmluZyArPSAnMCdcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmcmVzaF9kYXRhID0gZmFsc2VcblxuICAgIHJldHVybiBwYXJzZUludChiaW5hcnlfc3RyaW5nLDIpXG5cbiAgfVxuXG5cbiAgZnVuY3Rpb24gcGFkKG4sIHdpZHRoLCB6KSB7XG4gICAgeiA9IHogfHwgJzAnO1xuICAgIG4gPSBuICsgJyc7XG4gICAgcmV0dXJuIG4ubGVuZ3RoID49IHdpZHRoID8gbiA6IG5ldyBBcnJheSh3aWR0aCAtIG4ubGVuZ3RoICsgMSkuam9pbih6KSArIG47XG4gIH1cblxuXG4gIHZhciBrID0ge1xuICAgIGluaXQ6IGluaXQsXG4gICAgY29ubmVjdDogY29ubmVjdCxcbiAgICBnZXRfZ2Fpbl9iYW5rOiBnZXRfZ2Fpbl9iYW5rLFxuICAgIGdldF9hbmFseXNlcjogZ2V0X2FuYWx5c2VyLFxuICAgIGdldEJ1ZmZlcjogZ2V0QnVmZmVyLFxuICAgIGNoZWNrX3BlYWtfcmFuZ2VzOiBjaGVja19wZWFrX3JhbmdlcyxcbiAgICBncm91cF9wZWFrX3JhbmdlczogZ3JvdXBfcGVha19yYW5nZXMsXG4gICAgc2V0X2dhaW46IHNldF9nYWluLFxuICAgIHZhbGlkYXRlX3JhbmdlczogdmFsaWRhdGVfcmFuZ2VzLFxuICAgIG5fY2hhbm5lbHM6IG5fY2hhbm5lbHMsXG4gICAgZ2V0X2dyb3VwczogZ2V0X2dyb3VwcyxcbiAgICBlbmNvZGVfcmFuZ2U6IGVuY29kZV9ieXRlLFxuICAgIGdldF9lbmNvZGVkX2J5dGVfYXJyYXk6IGdldF9lbmNvZGVkX2J5dGVfYXJyYXksXG4gICAgcmVhZF9ieXRlX2Zyb21fc2lnbmFsOiByZWFkX2J5dGVfZnJvbV9zaWduYWwsXG4gICAgcG9sbDogcG9sbFxuXG4gIH1cblxuICByZXR1cm4ga1xuXG59XG4iLCJ3aW5kb3cub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICBjb25zb2xlLmxvZygnbWFpbi5qcyAvIHdpbmRvdy5vbmxvYWQgYW5vbnltb3VzIGZ1bmN0aW9uJylcblxuICB2YXIgbWVzc2FnZV90b19zZW5kID0gJzwzIExpbmRzZXkgQmFjb24gYW5kIHRoZSBiYWJ5IGFuZCBza2l0dGllIGJlZXMgYW5kIG1yIGQgYW5kIHllYWgnXG4gIHZhciBtZXNzYWdlX2lkeCA9IDBcblxuXG4gIHZhciBBZ2VudCA9IHJlcXVpcmUoJy4vYWdlbnQuanMnKVxuICAvLyByZXR1cm47XG5cbiAgd2luZG93LmFsaWNlID0gQWdlbnQuYWdlbnQoKVxuICBhbGljZS5pbml0KCdhbGljZScpXG5cbiAgd2luZG93LmJvYiA9IEFnZW50LmFnZW50KClcbiAgYm9iLmluaXQoJ2JvYicpXG5cbiAgYWxpY2UuY29ubmVjdChib2IpXG4gIGJvYi5jb25uZWN0KGFsaWNlKVxuXG4gIC8vIHJldHVybjtcblxuICB2YXIgZGF0YUFycmF5ID0gYWxpY2UuZ2V0QnVmZmVyKClcbiAgdmFyIGJ1ZmZlckxlbmd0aCA9IGRhdGFBcnJheS5sZW5ndGhcblxuICB2YXIgV0lEVEggPSAxMDI0XG4gIHZhciBIRUlHSFQgPSAyNTZcblxuICAvLyB3aW5kb3cuZCA9IGRhdGFBcnJheVxuICB3aW5kb3cuZHJhdyA9IGRyYXdcblxuICB2YXIgYmFyV2lkdGggPSAoV0lEVEggLyBidWZmZXJMZW5ndGgpO1xuXG4gIHZhciBiYXJIZWlnaHRcbiAgdmFyIHggPSAwXG4gIHZhciBtb2QgPSAwLjBcbiAgdmFyIGNvdW50ZXIgPSAwXG4gIHZhciBpXG5cbiAgd2luZG93LmJ5dGVfdG9fY29kZSA9IDFcblxuICAvLyBjcmVhdGUgc3ZnXG4gIHZhciBzdmcgPSBkMy5zZWxlY3QoJ2RpdiNjb250YWluZXInKS5hcHBlbmQoJ3N2ZycpXG4gICAgLmF0dHIoJ3dpZHRoJyxXSURUSClcbiAgICAuYXR0cignaGVpZ2h0JywgSEVJR0hUKVxuXG4gIHZhciBiYXJzID0gW11cbiAgZm9yKHZhciBzdmdiYXJzID0gMDsgc3ZnYmFycyA8IGJ1ZmZlckxlbmd0aDsgc3ZnYmFycysrKXtcbiAgICB2YXIgYmFyID0gc3ZnLmFwcGVuZCgncmVjdCcpXG4gICAgICAuYXR0cigneCcsIGJhcldpZHRoICogc3ZnYmFycylcbiAgICAgIC5hdHRyKCd5JywgMClcbiAgICAgIC5hdHRyKCd3aWR0aCcsIGJhcldpZHRoKVxuICAgICAgLmF0dHIoJ2hlaWdodCcsIDApXG5cbiAgICBsZXQgYmFyX2lkeCA9IHN2Z2JhcnNcbiAgICBiYXIub24oJ21vdXNlb3ZlcicsIGZ1bmN0aW9uKCl7XG4gICAgICBjb25zb2xlLmxvZyhiYXJfaWR4KVxuICAgIH0pXG5cbiAgICBiYXJzLnB1c2goYmFyKVxuICB9XG5cbiAgdmFyIHByZXZfcmFuZ2VzID0gW11cblxuICBmdW5jdGlvbiBkcmF3KCkge1xuXG4gICAgY291bnRlcisrXG4gICAgaWYoY291bnRlciAlIDMwID09PSAxKXtcblxuICAgICAgLy8gY29uc29sZS5jbGVhcigpXG4gICAgICAvLyBjb25zb2xlLmxvZyhEYXRlLm5vdygpKVxuXG4gICAgICBhbGljZS5nZXRCdWZmZXIoKVxuICAgICAgZm9yKGk9MDtpPGJ1ZmZlckxlbmd0aDtpKyspe1xuICAgICAgICBiYXJzW2ldLmF0dHIoJ2hlaWdodCcsIGRhdGFBcnJheVtpXSlcbiAgICAgIH1cblxuICAgICAgaWYoYWxpY2UucG9sbCgpKXtcblxuICAgICAgICB2YXIgYWxpY2VfcmVhZHMgPSBhbGljZS5yZWFkX2J5dGVfZnJvbV9zaWduYWwoKVxuXG4gICAgICAgIGNvbnNvbGUubG9nKCdhbGljZSByZWFkczogJyArIGFsaWNlX3JlYWRzKVxuICAgICAgICBjb25zb2xlLmxvZygpXG5cbiAgICAgICAgZG9jdW1lbnQud3JpdGUoU3RyaW5nLmZyb21DaGFyQ29kZShhbGljZV9yZWFkcykpXG5cbiAgICAgICAgd2luZG93LmJ5dGVfdG9fY29kZSA9IG1lc3NhZ2VfdG9fc2VuZFttZXNzYWdlX2lkeF0uY2hhckNvZGVBdCgwKVxuICAgICAgICBtZXNzYWdlX2lkeCArPSAxXG4gICAgICAgIG1lc3NhZ2VfaWR4ID0gbWVzc2FnZV9pZHggJSBtZXNzYWdlX3RvX3NlbmQubGVuZ3RoXG5cbiAgICAgICAgYm9iLmVuY29kZV9yYW5nZSh3aW5kb3cuYnl0ZV90b19jb2RlKVxuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZygnbWlzcycpXG4gICAgICB9XG5cbiAgICB9XG5cbiAgICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGRyYXcpO1xuXG4gIH1cblxuICBzZXRUaW1lb3V0KGRyYXcsNTAwKVxuICAvLyBkcmF3KClcblxuXG59XG4iXX0=
