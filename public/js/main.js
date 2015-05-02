window.onload = function () {
  "use strict";

  console.log('main.js / window.onload anonymous function')

  window.alice = require('./agent.js')
  var dataArray = alice.getBuffer()
  var bufferLength = dataArray.length

  var WIDTH = 1024
  var HEIGHT = 768

  window.d = dataArray
  window.draw = draw

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
    // dataArray = alice.getBuffer()
    // window.d = dataArray
    // // analyser.getFloatFrequencyData(dataArray)
    //
    // var total = 0
    // for(i=0;i<bufferLength;i++){
    //   // dataArraySlope[i] = dataArray[i] - dataArray[i+1]
    //   total += dataArray[i]
    // }
    //
    // var avg = total / (bufferLength)
    //
    // var count_peaks = 0
    // var peaks = []
    //
    // var threshold = 2
    // var minValue = threshold * avg
    //
    counter++
    if(counter % 60 === 1){


      alice.getBuffer()
      // console.log('peak ranges (grouped)')
      // var peak_ranges = alice.group_peak_ranges()
      //
      // if(peak_ranges){
      //   console.log(peak_ranges)
      //   console.log(peak_ranges.length)
      // }

      // console.log(alice.group_peak_ranges())

      for(i=0;i<bufferLength;i++){
        bars[i].attr('height', dataArray[i] * 2)
      }

    }

    window.requestAnimationFrame(draw);

  }

  draw()


}
