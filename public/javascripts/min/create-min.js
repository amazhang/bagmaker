var newBag;$(document).ready(function(){newBag=_.extend({},bagObject),newBag.data.editMode=!0,newBag.newTextField();var e={bags:[newBag.data]};global.render(e,"bag",".content.create-page .bag-wrap",function(){newBag.htmlElement=$(".create-page .tote-wrap"),newBag.refreshType(),$(".editable-field").eq(0).addClass("selected"),$(".editable-field").eq(0).find("textarea").focus()}),$(document).hammer().on("tap",".bag-size-wrap .icon",function(e){e.preventDefault(),e.stopPropagation(),newBag.toggleSize($(this).hasClass("small-bag")?"small":"big"),$(this).siblings(".sel").removeClass("sel"),$(this).addClass("sel")}),$(document).on("keyup",".editable-field textarea",function(){newBag.updateTextAreaSize($(this))}),$(document).hammer().on("tap",".editable-field",function(e){e.preventDefault(),e.stopPropagation(),$(".editable-field").removeClass("selected"),$(this).addClass("selected")}),$(document).hammer().on("tap",":not(.editable-field)",function(){$(".editable-field.selected").removeClass("selected")}),$(document).hammer().on("drag",".editable-field",function(e){if("up"===e.gesture.direction||"down"===e.gesture.direction){var t=e.gesture.deltaY,a=Number($(this).attr("data-index")),i=Number(newBag.data.textfields[a].y),d=t+i;0>d?d=0:d+$(this).height()>$(this).parents(".textfields-wrap").height()&&(d=$(this).parents(".textfields-wrap").height()-$(this).height()),TweenLite.to($(this),0,{y:d+"px"})}}),$(document).hammer().on("dragend",".editable-field",function(e){if("up"===e.gesture.direction||"down"===e.gesture.direction){var t=e.gesture.deltaY,a=Number($(this).attr("data-index")),i=Number(newBag.data.textfields[a].y),d=t+i;0>d?d=0:d+$(this).height()>$(this).parents(".textfields-wrap").height()&&(d=$(this).parents(".textfields-wrap").height()-$(this).height()),newBag.data.textfields[a].y=d}})});