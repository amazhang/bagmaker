var newBag;

// currently, this function assumes that there is only one bag size toggle tool.
// This seems like a pretty fair assumption to make...
function toggleBagSizeUI(){
    var $toggle = $(".bag-size-wrap");
    if ($toggle.hasClass("small")){
        $toggle.removeClass("small");
        setTimeout(function(){
            $toggle.addClass("big");
        }, 300);

        newBag.toggleSize("big");
    }
    else{
        $toggle.removeClass("big");
        setTimeout(function(){
            $toggle.addClass("small");
        }, 300);

        newBag.toggleSize("small");
    }
}

$(document).ready(function(){
    newBag = _.extend({}, bagObject);
    newBag.data.editMode = true;
    newBag.newTextField();

    newBag.draw($(".content.create-page .bag-wrap"), function(){
        $(".editable-field").eq(0).addClass("selected");
        $(".editable-field").eq(0).find("textarea").focus();

        // scroll down
        setTimeout(function(){
            var scrollAmt = $(".content.create-page").height() - $(window).height();
            $(".content-wrap").animate({scrollTop : scrollAmt}, "fast");
        }, 100);
    });

    // bag size toggling
    $(document).hammer().on("tap", ".bag-size-wrap", function(e){
        e.preventDefault();
        e.stopPropagation();

        toggleBagSizeUI();
    });

    // expand and collapse color drawer
    $(document).hammer().on("tap", ".color-control-wrap .color-control", function(e){
        e.preventDefault();
        e.stopPropagation();

        $(this).parents(".color-control-wrap").toggleClass("expand");
    });
 
    // selecting a color
    $(document).hammer().on("tap", ".color-control-wrap .colors .color-wrap", function(e){
        e.preventDefault();
        e.stopPropagation();

        var color = $(this).parents(".color").attr("rel");
        newBag.changeColor(color);
        $(".colors .color.selected").removeClass("selected");
        $(this).parent(".color").addClass("selected");
        $(this).parents(".color-control-wrap").removeClass("expand");
    });

    //add a text field button
    $(document).hammer().on("tap", ".addTextfield:not(.disabled)", function(e){
        e.preventDefault();
        e.stopPropagation();

        if ($(".editable-field.new").length > 0){
            $(".editable-field").removeClass("selected");
            setTimeout( function(){
                $(".editable-field.new").eq(0).addClass("selected");
            }, 100);
        }
        else{
            newBag.newTextField();
            newBag.draw();
        }
    });

    // delete a text field
    $(document).hammer().on("tap", ".editable-field .corner.tr", function(e){
        e.preventDefault();
        e.stopPropagation();

        var id = $(this).parents(".editable-field").attr("id");
        newBag.deleteTextField(id, function(){
            if (newBag.data.textfields.length === 0)
                $("button.save").addClass("disabled");
        });
    });

    // enforce character limit
    $(document).on("keypress, keydown", ".editable-field textarea", function(e){
        var $textarea = $(this);
        var content = $textarea.val();
        var $clone = $textarea.siblings(".clone-text-wrap").find(".clone-text");

        var contentFormatted = site.textToHTML(content);
        $clone.html(contentFormatted);

        while ($clone.height() > $clone.parents(".textfields-wrap").height()){
            content = content.substr(0, content.length-1);
            contentFormatted = site.textToHTML(content);
            $clone.html(contentFormatted);

            if ($clone.height() < $clone.parents(".textfields-wrap").height()){
                $textarea.val(content);
            }
        }
    });

    // update the size of the text field in the UI as you type
    $(document).on("keypress, keyup", ".editable-field textarea", function(e){
        newBag.updateTextAreaSize($(this));
    });

    // select a text field
    $(document).hammer().on("tap", ".editable-field", function(e){
        e.preventDefault();
        e.stopPropagation();

        $(".editable-field").removeClass("selected");
        $(this).addClass("selected");
    });

    // when to deselect a text field
    $(document).hammer().on("tap", ":not(.editable-field, .editable-field *)", function(e){
        e.preventDefault();
        e.stopPropagation();

        $(".editable-field.selected").removeClass("selected");
    });

    // using the justification controls.
    $(document).hammer().on("tap", ".text-controls .justification > *", function(e){
        e.preventDefault();
        e.stopPropagation();
        
        var $field = $(this).parents(".editable-field");
        var tfData = _.findWhere(newBag.data.textfields, { "domid" : $field.attr("id") });
        
        $(this).siblings(".sel").removeClass("sel");

        // set the alignment shiz        
        var alignment = $(this).attr("class").split("-")[1];
        tfData.justify = alignment;
        $(this).parents(".editable-field").css("text-align", alignment);

        // make it selected
        $(this).addClass("sel");
    });

    // Strikethroughs.
    $(document).hammer().on("tap", ".text-controls .strikethrough", function(e){
        e.preventDefault();
        e.stopPropagation();
        
        var $field = $(this).parents(".editable-field");
        var tfData = _.findWhere(newBag.data.textfields, { "domid" : $field.attr("id") });
        
        // make it strikethrough
        if (!$(this).hasClass("sel")){
            $(this).addClass("sel");
            $field.addClass("strikethrough");
            tfData.strikethrough = "strikethrough";
        }
        // make it normal
        else{
            $(this).removeClass("sel");
            $field.removeClass("strikethrough");
            delete tfData.strikethrough;
        }
    });

    // manages type control sliders
    $(document).on("input", ".type-control input", function(e){
        e.preventDefault();
        e.stopPropagation();

        typeSliderHandler($(this));
    });

    function typeSliderHandler($input){
        var $field = $input.parents(".editable-field");
        var tfData = _.findWhere(newBag.data.textfields, { "domid" : $field.attr("id") });
        
        if ($input.parent().hasClass("size")){
            var newSize = $input.val();
            $field.css("font-size", newSize + "em");

            //font size to be saved
            tfData.fontSize = Number(newSize);
        }
        else if ($input.parent().hasClass("kerning")){
            var newKerning = $input.val();
            $field.css("letter-spacing", newKerning + "em");

            //kerning to be saved
            tfData.kerning = Number(newKerning);
        }
        else if ($input.parent().hasClass("leading")){
            var newLeading = $input.val();
            $field.css("line-height", newLeading + "em");

            //leading to be saved
            tfData.leading = Number(newLeading);
        }
        newBag.updateTextAreaSize( $field.find("textarea") );
    }

    // Computes the allowed Y range for a field within its textfields-wrap.
    //
    // The wrap uses content-box sizing with 10% padding, and the field is
    // absolutely positioned relative to the wrap's padding box. So the field
    // can validly travel from y=0 (top edge of padding box) all the way to
    // y = paddingBoxHeight - fieldOuterHeight (so the field's bottom sits at
    // the wrap's outer bottom edge).
    //
    // Reading getBoundingClientRect avoids stale values mid-animation —
    // important because `updateTextAreaSize` Tween-animates the field height
    // for 100ms whenever you type or change the font size.
    function computeDragBounds($field) {
        var fieldRect = $field[0].getBoundingClientRect();
        var wrapEl = $field.parents(".textfields-wrap")[0];
        var wrapRect = wrapEl.getBoundingClientRect();
        return {
            // Container's full inner area, padding included.
            containerHeight: wrapRect.height,
            // Field's true rendered height.
            fieldHeight: fieldRect.height
        };
    }

    function clampDragY(targetPx, $field) {
        var b = computeDragBounds($field);
        var maxY = Math.max(0, b.containerHeight - b.fieldHeight);
        if (targetPx < 0) return 0;
        if (targetPx > maxY) return maxY;
        return targetPx;
    }

    // manages dragging only the text-wrap tool, for Y axis only.
    $(document).hammer().on("drag", ".editable-field, editable-field .corner", function(e){
        if ( $(e.target).parents(".text-controls").length === 1) {
            return;
        }

        if (site.isTouch()){
            // locks scroll on drag.
            $(".content-wrap").css("overflow", "hidden");
            $("body").addClass("lock-scroll");
        }

        var $field = $(this);
        if ($(this).hasClass("corner")){
            $field = $(this).parents(".editable-field");
        }

        if (e.gesture.direction === "up" || e.gesture.direction === "down"){
            var dragDist = e.gesture.deltaY;
            var index = $field.attr("id");
            // parseFloat to keep sub-pixel accuracy; the bag-body font-size is
            // bagWidth/2 which is often fractional.
            var parentFontSize = parseFloat($field.parents(".bag-body").css("font-size"));

            var tf = _.findWhere(newBag.data.textfields, { "domid" : index });
            var amountMoved = tf.y * parentFontSize;

            var dragAmt = clampDragY(dragDist + amountMoved, $field);
            TweenLite.to($field, 0, { y : dragAmt + "px" });
        }
    });

    $(document).hammer().on("dragend", ".editable-field, editable-field .corner", function(e){
        if ( $(e.target).parents(".text-controls").length === 1) {
            return;
        }

        if (site.isTouch()){
            // unlocks scroll on release.
            $(".content-wrap").css("overflow", "auto");
            $("body").removeClass("lock-scroll");
        }

        var $field = $(this);
        if ($(this).parents(".editable-field").length !== 0){
            $field = $(this).parents(".editable-field");
        }

        if (e.gesture.direction === "up" || e.gesture.direction === "down"){
            var dragDist = e.gesture.deltaY;
            var index = $field.attr("id");
            var parentFontSize = parseFloat($field.parents(".bag-body").css("font-size"));

            var tf = _.findWhere(newBag.data.textfields, { "domid" : index });
            var amountMoved = tf.y * parentFontSize;

            var dragAmt = clampDragY(dragDist + amountMoved, $field);

            // save it in ems (relative to bag-body font-size, which is bagWidth/2)
            tf.y = dragAmt / parentFontSize;
        }
    });

    $(document).hammer().on("tap", "button.save:not(.disabled), button.save:not(.disabled) span", function(){
        newBag.saveAs();
    });
});