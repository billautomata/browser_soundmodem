window.onload = function () {
  "use strict";

  console.log('main.js / window.onload anonymous function')

  window.alice = require('./agent.js')

  console.log(alice.getBuffer())

  var bufferLength = alice.getBuffer().length

  // var context = new AudioContext()
  // var analyser = context.createAnalyser()
  //
  // var osc_bank = []
  // var gain_bank = []
  //
  // window.gb = gain_bank
  // var n_osc = 8
  //
  // var freqRange = 18000 // hz
  // var spread = (freqRange / n_osc)  // hz
  //
  // console.log(spread)
  // var initialFreq = 1000
  //
  // // create tones
  // for(var idx = 0; idx < n_osc; idx++){
  //
  //   let local_osc = context.createOscillator()
  //
  //   local_osc.frequency.value = (idx * spread) + initialFreq
  //
  //   let local_gain = context.createGain()
  //   local_gain.gain.value = 1.0 / (n_osc)
  //
  //   // local_gain.gain.value *= Math.random()
  //
  //   local_osc.connect(local_gain)
  //   local_gain.connect(analyser)
  //
  //   gain_bank.push(local_gain)
  //
  //   // local_gain.connect(context.destination)
  //
  //   local_osc.start()
  //
  // }

  var WIDTH = 1024
  var HEIGHT = 768
  //
  //
  // analyser.fftSize = 1024;
  // analyser.smoothingTimeConstant = 0
  // var bufferLength = analyser.frequencyBinCount;
  // var dataArray = new Uint8Array(bufferLength);
  // // var dataArray = new Float32Array(bufferLength)
  // var dataArraySlope = new Float32Array(bufferLength)

  var dataArray

  window.d = dataArray
  // analyser.getFloatFrequencyData(dataArray);

  window.draw = draw
  //
  // window.analyser = analyser

  var barWidth = (WIDTH / bufferLength);

  var barHeight
  var x = 0
  var mod = 0.0
  var counter = 0
  var i

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

    bars.push(bar)
  }

  function draw() {

    // if(mod === 0.0){
    //   mod = 0.5
    // } else {
    //   mod = 0.0
    // }

    // gainNode.gain.value = mod

    // var random_bank = Math.floor(Math.random()*gain_bank.length)
    // gain_bank[2].gain.value = 0


    // analyser.getByteTimeDomainData(dataArray);
    dataArray = alice.getBuffer()
    window.d = dataArray
    // analyser.getFloatFrequencyData(dataArray)

    var total = 0
    for(i=0;i<bufferLength;i++){
      // dataArraySlope[i] = dataArray[i] - dataArray[i+1]
      total += dataArray[i]
    }

    var avg = total / (bufferLength)

    var count_peaks = 0
    var peaks = []

    var threshold = 2
    var minValue = threshold * avg

    counter++
    if(counter % 60 === 1){

      var last_valid_peak_index = 0
      for(i=0;i<bufferLength;i++){

        bars[i].attr('height', dataArray[i] * 2)
          .attr('fill', 'red')

        if(dataArray[i] > minValue){

          // push an index on to the peak index list
          peaks.push(i)

          bars[i].attr('fill', 'green')

        }

      }

      console.log('average: ' + avg)
      console.log(peaks.length)

      var peak_groups = 0

      var current_peak_streak = false
      for(var p = 0; p<peaks.length-1; p++){

        if(peaks[p]-peaks[p+1] === -1){

          if(!current_peak_streak){
            peak_groups += 1
            bars[peaks[p]].attr('height', HEIGHT).attr('fill','purple')
          }

          current_peak_streak = true

        } else {

          if(current_peak_streak){
            bars[peaks[p]].attr('height', HEIGHT).attr('fill','orange')
          }

          current_peak_streak = false

        }
      }

      if(peaks.length > 0){
        bars[peaks[peaks.length-1]].attr('height', HEIGHT).attr('fill','orange')
      }

      console.log('peak groups: ' + peak_groups)

      // console.log(bufferLength)
      // console.log(dataArray)
    }

    window.requestAnimationFrame(draw);

  }

  draw()


}
