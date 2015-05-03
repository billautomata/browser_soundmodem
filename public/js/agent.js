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
