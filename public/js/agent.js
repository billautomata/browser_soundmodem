"use strict";

module.exports = {
  getBuffer: getBuffer,
  check_peak_ranges: check_peak_ranges,
  group_peak_ranges: group_peak_ranges,
  set_gain: set_gain,
  validate_ranges: validate_ranges
}

// check for global audio ctx

if(window.context === undefined){
  window.context = new window.AudioContext()
}

var analyser = window.context.createAnalyser()
var analyserDataArray
var bufferLength

var peak_ranges
var mean
var grouped_peak_ranges

var osc_bank = []
var gain_bank = []

var n_osc = 3
var freqRange = 18000
var spread = (freqRange / n_osc)
var initialFreq = 1000

init()
getBuffer()

function init(){

  // create osc + gain banks
  for(var idx = 0; idx < n_osc; idx++){

    let local_osc = context.createOscillator()
    local_osc.frequency.value = (idx * spread) + initialFreq

    let local_gain = context.createGain()
    local_gain.gain.value = 1.0 / (n_osc)

    local_osc.connect(local_gain)
    local_gain.connect(analyser)

    // local_gain.connect(context.destination)

    local_osc.start()

    osc_bank.push(local_osc)
    gain_bank.push(local_gain)

  }

  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0
  bufferLength = analyser.frequencyBinCount
  analyserDataArray = new Uint8Array(bufferLength)

  setTimeout(register_peak_ranges,100)

}

function getBuffer(){
  analyser.getByteFrequencyData(analyserDataArray)
  return analyserDataArray
}

function register_peak_ranges(){

  getBuffer()

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

  window.p = peak_ranges

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

    console.log(hits)

    if(hits >= group.length/2){
      valid_groups.push(true)
    } else {
      valid_groups.push(false)
    }

  })

  return valid_groups

}
