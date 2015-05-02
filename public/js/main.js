window.onload = function () {
  "use strict";

  console.log('main.js / window.onload anonymous function')


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
    if(counter % 10 === 1){

      console.clear()
      console.log(Date.now())

      alice.getBuffer()
      for(i=0;i<bufferLength;i++){
        bars[i].attr('height', dataArray[i])
      }

      console.log('here')

      // does the encoded byte match?
      var current_signal_byte = alice.read_byte_from_signal()
      console.log('current signal byte ' + current_signal_byte)

      // return true;

      // if(current_signal_byte === window.byte_to_code){
      //   window.byte_to_code += 1
      //   console.log(window.byte_to_code)
      //   window.byte_to_code = window.byte_to_code % 255
      // } else {
      //   console.log('too slow!')
      // }


      // var ranges = alice.validate_ranges()
      // var test_byte = alice.get_encoded_byte_array(window.byte_to_code)
      //
      // var no_misses = true
      // for(var i = 0; i < 8; i++){
      //   if((ranges[i] === true && test_byte[i] === '1') ||
      //     (ranges[i] === false && test_byte[i] === '0')){
      //       // do nothing
      //     } else {
      //       no_misses = false
      //       console.log('miss')
      //     }
      //
      //
      // }
      //
      // if(no_misses){
      // }


      // console.log('encoding ' + window.byte_to_code)
      // bob.encode_range(window.byte_to_code)


      // console.log(ranges)
      // if(ranges[channel_to_check] === false){
      //   channel_to_check += 1
      //   channel_to_check = channel_to_check % alice.n_channels()
      // }
      //
      // for(var i = 0; i < alice.n_channels(); i++){
      //   if(i === channel_to_check){
      //     // console.log('here'+i)
      //     alice.set_gain(i,0.0)
      //   } else {
      //     alice.set_gain(i,1.0/alice.n_channels())
      //   }
      // }
      //
      // var all_matched = true
      // ranges.forEach(function(v,i){
      //   if(v !== prev_ranges[i]){
      //     all_matched = false
      //   }
      // })
      // if(all_matched){
      //   console.log('MISS')
      // }
      //
      // prev_ranges = ranges

    }

    window.requestAnimationFrame(draw);

  }

  setTimeout(draw,500)
  // draw()


}
