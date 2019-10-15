$('.info-circle').on('mouseenter mouseleave', function() {

  let posn = {
    left: $(this).offset().left,
    top: $(this).offset().top,
    right: $(this).offset().right,
    bottom: $(this).offset().bottom
  };
  let data = $(this).attr('my-data');
  $('.popover').html(data);
  $(this).toggleClass('hovered');
  $('.popover').toggleClass('opacity-1');

  if ((posn.left + $('.popover').width()/2) > $(window).width()) {
    console.log('cond 1');
    return $('.popover').css({
      right: 20,
      top: posn.top - $('.popover').height() - $(this).height() - 20,
    });
  }

  if ((posn.left < $('.popover').width()/2)) {
    console.log('cond 2');
    return $('.popover').css({
      left: posn.left,
      top: posn.top - $('.popover').height() - $(this).height() - 20,
    });
  }

  $('.popover').css({
    left: posn.left - ($('.popover').width()/2),
    top: posn.top - $('.popover').height() - $(this).height() - 20,
  });

});

$(document).on('hover','.card-select',function(e) {
  $(this).closest('.card').toggleClass('active');
})

$(document).on('click','.card-select',function(e){

  changeCardState(this);

  if ($(this).closest('.card').hasClass('card-selected')) {
    updatedue($(this).closest('.card').attr('id'), 'push');
  } else {
    updatedue($(this).closest('.card').attr('id'), 'pop');
  }

})

function changeCardState(elem){

  $(elem).closest('.card').toggleClass('card-selected');

  $.each($(elem).closest('.card').find('path'),function() {
    if ($(this).attr('fill') == 'darkcyan') return $(this).attr('fill', 'darkcyan');
    $(this).attr('fill','darkcyan');
  });

  $.each($(elem).closest('.card').find('circle'),function() {
    if ($(this).attr('fill') == 'darkcyan') return $(this).attr('fill', 'darkcyan');
    $(this).attr('fill','darkcyan');
  });

  $('.card-hover').find('path').attr('fill', '#C0C1C5');
}

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
  if ($(e.target).closest('.card-specialNote').length || $(e.target).closest('.card-browser').length || e.target.nodeName == 'IMG' || e.target.nodeName == 'BUTTON' || $(e.target).closest('.check-box').hasClass('check-box')) return;
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

$('.card-specialNote > svg:nth-child(1)').on('click', function() {
  $(this).closest('.card-specialNote').addClass('d-none');
})

$('.view-details').on('click', function() {
  $(this).closest('.card').find('.card-specialNote').removeClass('d-none');
})
