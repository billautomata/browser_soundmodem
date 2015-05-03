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
