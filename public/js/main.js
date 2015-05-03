window.onload = function () {
  "use strict";

  var udp_mode = true

  console.log('main.js / window.onload anonymous function')

  var message_to_send = 'this is a test that the modulation / demodulation works correctly \nalso bumping the speed up to ~240 baud, this rules!! \n'
  var output_msg = ''

  var Agent = require('./agent.js')

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

  var dataArray = alice.getBuffer()
  // var bufferLength = dataArray.length
  var bufferLength = 512

  var WIDTH = 1024
  var HEIGHT = 256

  var barWidth = (WIDTH / bufferLength);

  var barHeight
  var x = 0
  var mod = 0.0
  var counter = 0
  var i

  window.byte_to_code = 0

  // create svg
  var svg = d3.select('div#container').append('svg')
    .attr('width',WIDTH)
    .attr('height', HEIGHT)
    .style('background-color', 'rgba(0,0,0,0.1)')

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

  alice.connect(bob)
  bob.connect(alice)


  setTimeout(draw,200)
  // function start(){
  //   alice.encode_range(22)
  //   draw()
  // }

  function draw() {

    counter++
    if(counter % 2 === 0){

      // visualize alices buffer data
      dataArray = alice.getBuffer()

      for(i=0;i<bufferLength;i++){
        bars[i].attr('height', dataArray[i])
      }

      var o = alice.tick()

      if(o.new_data){
        output_msg += o.data
        d3.select('pre.output_msg').html(output_msg)
      }

      bob.tick()


      // if(bob.poll() || udp_mode){
      //
      //   bob.read_byte_from_signal()
      //   window.byte_to_code = message_to_send[message_idx].charCodeAt(0)
      //   bob.encode_range(window.byte_to_code)
      //   message_idx += 1
      //   message_idx = message_idx % message_to_send.length
      //
      // } else {
      //   // console.log('bob miss')
      // }
      //
      // if(alice.poll()){
      //
      //   var alice_reads = alice.read_byte_from_signal()
      //
      //   output_msg += String.fromCharCode(alice_reads)
      //
      //   d3.select('div.output_msg').html(output_msg)
      //
      //   alice.encode_range(2)
      //
      // } else {
      //   // console.log('alice miss')
      // }

    }

    window.requestAnimationFrame(draw);

  }



}
