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
