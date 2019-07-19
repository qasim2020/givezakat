$(document).on('hover','.card-select',function(e) {
  $(this).closest('.card').toggleClass('active');
})

$(document).on('click','.card-select',function(e){

  $(this).closest('.card').toggleClass('card-selected');

  $.each($(this).closest('.card').find('path'),function() {
    if ($(this).attr('fill') == '#05386B') return $(this).attr('fill', '#C0C1C5');
    $(this).attr('fill','#05386B');
  })

  $.each($(this).closest('.card').find('circle'),function() {
    if ($(this).attr('fill') == '#05386B') return $(this).attr('fill', '#C0C1C5');
    $(this).attr('fill','#05386B');
  })

  $('.card-hover').find('path').attr('fill', '#C0C1C5');

  updatecart();

})

$(document).on('click','.place-2 > svg',function() {
  $('.place-2 > svg').not(this).removeClass('active').parent().siblings('.card-browser').addClass('d-none');
  $(this).toggleClass('active');
  $(this).parent().siblings('.card-browser').toggleClass('d-none');
})

$(document).on('click','.card-browser',function(e){
  if (e.target.nodeName == 'BUTTON') return 'not this';
  $(this).addClass('d-none');
})

$(document).on('click','.card',function(e) {
  if ($(e.target).closest('.card-browser').length || e.target.nodeName == 'IMG' || e.target.nodeName == 'BUTTON' || $(e.target).closest('.check-box').hasClass('check-box')) return console.log('open browser');
  $('.place-2 > svg').removeClass('active');
  $('.card').not(this).find('.card-hover').removeClass('card-active').addClass('card-inactive');
  $(this).find('.card-hover').toggleClass('card-active card-inactive');
})

function opennav() {
  $('.nav-menu').css({'z-index': '150',opacity: 1})
}

function closenav() {
  $('.nav-menu').css({'z-index': '-2', opacity: 0});
};

$('.nav-item').on('mouseenter mouseleave',function(){
  $(this).toggleClass('text-offwhite text-white');
});
var sticky;
if ($(window.document.body).find('.nav-bar-home').length)
{ sticky = $('.nav-bar-home:eq(0)').offset().top; }

window.onscroll = function() {
  myFunction()
};

function myFunction() {
  if (window.pageYOffset >= sticky) {
    $('.nav-bar-home').addClass('sticky');
    console.log(sticky);
  } else {
    $('.nav-bar-home').removeClass('sticky');
  }
}

$('#footer').find('svg').on('mouseenter mouseleave',function() {
  if (this.classList[0] == 'heart-icon') return;
  let activeColor = $(this).attr('active-color');
  let prvsColor = $(this).attr('fill');
  console.log(prvsColor);
  if (prvsColor != activeColor) {
    $(this).attr({fill: activeColor});
    return;
  }
  $(this).attr({fill: 'none'});

})

$('.heart-icon').on('mouseenter mouseleave',function(){
  let activeColor = $(this).attr('active-color');
  let prvsColor = $(this).find('path').attr('fill');
  console.log(prvsColor,activeColor);
  if (prvsColor != activeColor) {
    $(this).find('path').attr({fill: activeColor});
    return;
  }
  $(this).find('path').attr({fill: '#afafaf'});
});
