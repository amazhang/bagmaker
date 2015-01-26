function selectTool(t){deselectAll(),t.addClass("active"),t.hasClass("text-wrap")&&(t.find("textarea").attr("readonly",!1),t.find("textarea").focus())}function deselectTool(t){t.removeClass("active"),t.hasClass("text-wrap")&&t.find("textarea").attr("readonly",!0)}function deselectAll(){$(".tool").each(function(){deselectTool($(this))})}function updateTextAreaSize(){var t=$(".text-wrap textarea").val();dataText=t,""===t&&(t="Type Something.",dataText=null),$(".clone-text").html(t),TweenLite.to(".text-wrap",.1,{height:$(".clone-text").height()+10});var e=Number($(".text-wrap").attr("data-y"));e+$(".text-wrap").height()>.4*$(".tote-wrap").height()&&console.log("it happened")}function loadBags(){$.getJSON("/totes",function(t){totalBags=t.length})}function saveTote(){var t={text:dataText,yAxis:dataY,size:dataSize,color:dataColor,justification:dataJustify,fontSize:dataFontSize,kerning:dataKerning,leading:dataLeading,likes:0,timestamp:Math.round((new Date).getTime()/1e3),bagNum:totalBags+1};$.ajax({type:"POST",data:t,url:"/totes/createtote",dataType:"JSON"}).done(function(t){alert(""===t.msg?"added":"Error: "+t.msg)})}var totalBags,dataText=null,dataY=0,dataSize="small",dataColor="black",dataJustify="left",dataFontSize=5,dataKerning=-.03,dataLeading=1;$(document).ready(function(){updateTextAreaSize(),loadBags();var t=$(document).height()-$(window).height();$(window).scrollTop(t),$(document).hammer().on("tap",".tool, .bag-size-wrap .icon",function(t){t.stopPropagation()}),$(document).on("keyup",".text-wrap textarea",function(){updateTextAreaSize()}),$(document).hammer().on("tap",".tool",function(){selectTool($(this))}),$(document).hammer().on("tap",".content",function(){deselectAll()}),$(document).hammer().on("drag",".text-wrap",function(t){if(1!==$(t.target).parents(".text-controls").length&&("up"===t.gesture.direction||"down"===t.gesture.direction)){var e=t.gesture.deltaY,a=Number($(this).attr("data-y")),s=e+a;0>s?s=0:s+$(".text-wrap").height()>.4*$(".tote-wrap").height()&&(s=.4*$(".tote-wrap").height()-$(".text-wrap").height()),TweenLite.to(this,0,{y:s+"px"})}}),$(document).hammer().on("dragend",".text-wrap",function(t){if(1!==$(t.target).parents(".text-controls").length&&("up"===t.gesture.direction||"down"===t.gesture.direction)){var e=t.gesture.deltaY,a=Number($(this).attr("data-y")),s=e+a;0>s?s=0:s+$(".text-wrap").height()>.4*$(".tote-wrap").height()&&(s=.4*$(".tote-wrap").height()-$(".text-wrap").height()),$(this).attr("data-y",""+s),dataY=round(s,4)}}),$(document).hammer().on("tap",".color-wrap",function(){var t=$(this).attr("data-color");if($(".color-wrap.checked").attr("data-color")!==t){$(".color-wrap.checked").removeClass("checked"),$(this).addClass("checked");var e=$(".tote-wrap").attr("data-color");$(".tote-wrap").removeClass(e),$(".tote-wrap").addClass(t),$(".tote-wrap").attr("data-color",t),dataColor=$(".tote-wrap").attr("data-color")}}),$(document).on("input",".type-control input",function(){if($(this).parent().hasClass("size")){var t=$(this).val()+"em";$(".text-wrap, .clone-text").css("font-size",t),dataFontSize=$(this).val()}else if($(this).parent().hasClass("kerning")){var e=$(this).val()+"em";$(".text-wrap, .clone-text").css("letter-spacing",e),dataKerning=$(this).val()}else if($(this).parent().hasClass("leading")){var a=$(this).val()+"em";$(".text-wrap, .clone-text").css("line-height",a),dataLeading=$(this).val()}updateTextAreaSize()}),$(document).on("change",".type-control input",function(){if($(this).parent().hasClass("size")){var t=$(this).val()+"em";$(".text-wrap, .clone-text").css("font-size",t),dataFontSize=$(this).val()}else if($(this).parent().hasClass("kerning")){var e=$(this).val()+"em";$(".text-wrap, .clone-text").css("letter-spacing",e),dataKerning=$(this).val()}else if($(this).parent().hasClass("leading")){var a=$(this).val()+"em";$(".text-wrap, .clone-text").css("line-height",a),dataLeading=$(this).val()}updateTextAreaSize()}),$(document).hammer().on("tap",".justification *",function(){if(!$(this).hasClass("sel")){$(".justification .sel").removeClass("sel"),$(this).addClass("sel");var t=$(this).attr("data-just");$(".text-wrap textarea, .clone-text").css("text-align",t),dataJustify=t,updateTextAreaSize()}}),$(document).hammer().on("tap",".bag-size-wrap .icon",function(){$(this).hasClass("sel")||($(".bag-size-wrap .icon.sel").removeClass("sel"),$(this).addClass("sel"),"big"===$(this).attr("data-size")?$(".tote-wrap").removeClass("small").addClass("big"):$(".tote-wrap").removeClass("big").addClass("small"),dataSize=$(this).attr("data-size"),updateTextAreaSize())}),$(document).hammer().on("tap","nav .right-actions .save",function(){saveTote()})});