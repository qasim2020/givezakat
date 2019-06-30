$('.card-select').on('hover',function(e) {
  $(this).closest('.card').toggleClass('active');
})

$('.card-select').on('click',function(e){
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

})

$('.place-2 > svg').on('click',function() {
  $('.place-2 > svg').not(this).removeClass('active').parent().siblings('.card-browser').addClass('d-none');
  $(this).toggleClass('active');
  $(this).parent().siblings('.card-browser').toggleClass('d-none');
})

$('.card-browser').on('click',function(e){
  if (e.target.nodeName == 'BUTTON') return 'not this';
  $(this).addClass('d-none');
})

$('.card').on('click',function(e) {
  if (e.target.nodeName == 'IMG' || e.target.nodeName == 'BUTTON' || $(e.target).closest('.check-box').hasClass('check-box')) return console.log('open browser');
  $('.place-2 > svg').removeClass('active');
  $('.card').not(this).find('.card-hover').removeClass('card-active').addClass('card-inactive');
  $(this).find('.card-hover').toggleClass('card-active card-inactive');
})

function opennav() {
  $('.nav-menu').css({'z-index': '2',opacity: 1})
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
