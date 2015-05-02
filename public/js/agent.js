"use strict";

module.exports = {
  getBuffer: getBuffer,
  check_peak_ranges: check_peak_ranges
}

// check for global audio ctx

if(window.context === undefined){
  window.context = new window.AudioContext()
}

var analyser = window.context.createAnalyser()
var bufferLength
var analyserDataArray
var peak_ranges
var mean

var osc_bank = []
var gain_bank = []

var n_osc = 18
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
