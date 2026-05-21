// TO DO:
// -Admin view.
// -404 page.

var cssBezier = new Ease(BezierEasing(0.7, 0, 0.3, 1));
var gridBagBezier = new Ease(BezierEasing(0.42, 0, 0.58, 1));
 
//google analytics
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments);},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m);
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-58975311-1', 'auto');

// Likes API
//
// Phase 3 rewrite (2026): used to track likes client-side via $.cookie("likes")
// and PUT the whole tote back via /totes/updatetote (which let anyone overwrite
// anyone else's tote). Now identity is the httpOnly bm_uid cookie set server-
// side, and like/unlike call dedicated POST/DELETE endpoints.
//
// We keep the userLikes array + indexOf() helper so the rest of the legacy
// jQuery code (browse.js, view.js) doesn't need surgery — they still ask
// "is this tote liked by the current user?" via likes.indexOf(toteID). We
// just seed userLikes from the server's likedByMe field instead of a cookie.
var likes = {
    userLikes : [],
    // Backwards-compat shim. Server identity is now in the httpOnly bm_uid
    // cookie — there's nothing to fetch client-side. Left as a no-op so old
    // callsites (browse.js $(document).ready) don't break.
    fetchUserLikes : function(){
        // no-op
    },
    // Call when tote JSON comes back from a /data/* endpoint. Each tote has
    // a server-set `likedByMe` boolean — fold that into our cache so the
    // existing UI code (which asks likes.indexOf(toteID)) keeps working.
    seedFromTotes : function(totesArray){
        if (!totesArray) return;
        for (var i = 0; i < totesArray.length; i++){
            var t = totesArray[i];
            if (t && t._id && t.likedByMe && likes.userLikes.indexOf(t._id) === -1){
                likes.userLikes.push(t._id);
            }
        }
    },
    likeBag : function(toteID){
        if (likes.indexOf(toteID) > -1){
            return false;
        }
        // Optimistic UI: assume server accepts.
        likes.userLikes.push(toteID);

        // Sync heart state across the view page <-> grid like the old code did.
        if ( $(".view-carousel").hasClass("on") ){
            var toteIndex = parseInt($(".view-carousel").attr("data-index"));
            likes.favorite($(".browse-tote-wrap .tote-grid-element").eq(toteIndex).find(".heart-outer-wrap"));
        }

        $.ajax({
            type: 'POST',
            url: '/totes/' + toteID + '/like',
            dataType: 'json'
        }).done(function(response){
            // Sync the in-memory tote's count + any visible badge.
            likes.updateLikeCount(toteID, response.likeCount);
        }).fail(function(){
            // Roll back the optimistic mark.
            var idx = likes.userLikes.indexOf(toteID);
            if (idx > -1) likes.userLikes.splice(idx, 1);
            $(".tote-wrap[data-id='" + toteID + "']").parents(".tote-grid-element").find(".heart-outer-wrap").removeClass("favorited");
            $(".view-carousel[data-display='" + toteID + "'] .heart-outer-wrap").removeClass("favorited");
        });
    },
    unlikeBag : function(toteID){
        var toteIndex = likes.indexOf(toteID);
        if (toteIndex === -1) return false;

        // Optimistic UI.
        likes.userLikes.splice(toteIndex, 1);

        if ( $(".view-carousel").hasClass("on") ){
            var idx = parseInt($(".view-carousel").attr("data-index"));
            likes.unfavorite($(".browse-tote-wrap .tote-grid-element").eq(idx).find(".heart-outer-wrap"));
        }

        $.ajax({
            type: 'DELETE',
            url: '/totes/' + toteID + '/like',
            dataType: 'json'
        }).done(function(response){
            likes.updateLikeCount(toteID, response.likeCount);
        }).fail(function(){
            // Roll back.
            if (likes.userLikes.indexOf(toteID) === -1) likes.userLikes.push(toteID);
        });
    },
    // Push a fresh server-blessed count into the in-memory tote + DOM badge.
    updateLikeCount : function(toteID, n){
        if (typeof browse !== "undefined" && browse.toteBags){
            var tote = _.findWhere(browse.toteBags, { "_id" : toteID });
            if (tote) tote.likeCount = n;
        }
        // Grid badge — lives as a sibling of .tote-wrap inside .tote-grid-element.
        $(".tote-wrap[data-id='" + toteID + "']").closest(".tote-grid-element").find(".like-count").text(n);
        // View-page badge — only matters if this tote is centered in the carousel.
        if ($(".view-carousel").attr("data-display") === toteID){
            $(".view-like-count").text(n);
        }
    },
    indexOf : function(toteID){
        return likes.userLikes.indexOf(toteID);
    },
    toggleLike : function(toteID){
        if (likes.indexOf(toteID) > -1){
            likes.unlikeBag(toteID);
        }
        else{
            likes.likeBag(toteID);
        }
    },

    /******************************************************************
        this is sort of legacy from a previous favoriting animation
        but we should leave these functions here in case we want to
        make a new favoriting animation utilizing TweenLite.

        Essentially, its purpose is to be the function for the
        animation and currently we just need to toggle a class.
    *******************************************************************/
    favorite : function($heartOuterWrap){        
        $heartOuterWrap.addClass("favorited");
    },
    unfavorite : function($heartOuterWrap){
        $heartOuterWrap.removeClass("favorited");
    }
};

var site = {
    colors : ["black", "white", "red"],
    validTextfieldRegex : /\S+/,
    chars : "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz".split(''),
    randomString : function(length){
        var string = '';
        for (var i = 0; i < length; i++){
            string += site.chars[ Math.floor(Math.random() * site.chars.length) ];
        }
        return string;
    },
    breakpts : {
        sml : 650,
        med : 960,
        lrg : 1440
    },
    transistionEnd : 'webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend',
    breakpt : function() {
        var ww = window.innerWidth;
        var breakptval = 'lrg';

        for( var key in site.breakpts){
            if( site.breakpts[key] >= ww ){
                breakptval = key;
                break;
            }
        }
        return breakptval;
    },
    isTouch : function() {
        return !!('ontouchstart' in window);
    },
    textToHTML : function(str){
        // order matters. HTML strip + hardcoding whitespace.
        str = str.replace(/[<]/g, "&lt;")
                 .replace(/[>]/g, "&gt;")
                 .replace(/\n/g, "<br/>")
                 .replace(/[ ]{2}/g, " &nbsp;");
                 
        return str;
    },
    htmlToText : function(str){
        // order matters. HTML strip + hardcoding whitespace.
        str = str.replace(/(&lt;)/g, "<")
                 .replace(/(&gt;)/g, ">")
                 .replace(/(<br\/>)/g, "<br/>")
                 .replace(/( &nbsp;){2}/g, "  ");
        return str;
    },
    refreshTypeOnTotes : function(){
        _.each($(".actual-tote"), function(tote){
            var width = $(tote).find(".bag-body").width();
            var fontSize = width / 2;
            $(tote).find(".bag-body").css("font-size", (fontSize + "px"));
            $(tote).find(".bag-bottom").css("font-size", (fontSize + "px"));

            if ( $(tote).find(".editable-field").length > 0 ){
                var fields = $(tote).find(".textfields-wrap .editable-field");
                for (var i = 0; i < fields.length; i++){
                    bagObject.updateTextAreaSize( $(fields[i]).find("textarea") );
                }
            }
            if ( $(tote).find(".text").length > 0 ){
                var texts = $(tote).find(".textfields-wrap .text");
                for (var j = 0; j < texts.length; j++){
                    var newX = Number($(texts[j]).attr("data-x")) * fontSize;
                    var newY = Number($(texts[j]).attr("data-y")) * fontSize;
                    TweenLite.to(texts[j], 0, { x : newX, y : newY });
                }
            }
        });
    },
    getTransformValue : function($el, orientation){
        var matrix = $el.css('transform').replace(/[^0-9\-.,]/g, '').split(',');
        var x = matrix[12] || matrix[4];
        var y = matrix[13] || matrix[5];

        if (x === undefined){
            x = 0;
        }
        if (y === undefined){
            y = 0;
        }

        if (orientation === "x"){
            return x;
        }
        else if (orientation === "y"){
            return y;
        }
    },
    render : function(obj, tpl, target, onComplete) {
        $.get("/templates/_"+tpl+".html", function(html) {
            
            Handlebars.registerHelper("textToHTML", function(text){
                return site.textToHTML(text);
            });

            var template = Handlebars.compile(html);
            var rendered = template(obj);

            $(target).html(rendered);

            if(typeof onComplete !== 'undefined'){
                onComplete();
            }
        });
    },
    breakpts : {
        sml : 640,
        med : 940,
        lrg : 1280
    },
    breakpt : function() {
        var ww = window.innerWidth;
        var breakptval = 'lrg';

        for( var key in site.breakpts){
            if( site.breakpts[key] >= ww ){
                breakptval = key;
                break;
            }
        }
        return breakptval;
    }
};

var bagObject = {
    data : {
                textfields : [],
                size : "small",
                color : "black",
                likes : 0,
                views : 0,
                editMode : false
            },
    
    htmlElement : null,
    parent : null,

    //refresh type based on bag size.
    refreshType : function(){
        var $theTote = this.htmlElement;
        var width = $theTote.find(".bag-body").width();
        var fontSize = width / 2;
        $theTote.find(".bag-body").css("font-size", (fontSize + "px"));
        $theTote.find(".bag-bottom").css("font-size", (fontSize + "px"));

        setTimeout(function(){
            site.refreshTypeOnTotes();
        }, 100);
    },

    upViewCount : function(toteID){
        var toteJsonURL = "/data/latest/tote/" + toteID;
        ga('send', 'pageview'); // count the view page.
        var tote;

        $.getJSON(toteJsonURL, function( data ){
            tote = data;
        
            if (typeof tote.views !== "number" || tote.views === null){
                tote.views = 1;
            }
            else{
                tote.views = tote.views + 1;
            }

            // sort of hacky, the only way i know how to update a tote. you aren't allowed
            // to update it with the sacred _id variable already assigned.
            var clone = _.extend({}, tote);
            delete clone._id;

            // use ajax to post tote to db
            $.ajax({
                type: 'PUT',
                data: JSON.stringify(clone),
                url: '/totes/updatetote/' + toteID,
                contentType:"application/json; charset=utf-8",
                dataType: 'json'
            }).done(function( response, status ){

            }).fail(function( response, status ){

            });
        }); 
    },

    //big to small, refresh type afterwards.
    toggleSize : function(size){
        var bag = this;

        if (size === "big" || (bag.data.size === "small" && typeof size === "undefined")) {
            bag.data.size = "big";
            bag.htmlElement.removeClass("small").addClass("big");
        }
        else if (size === "small" || (bag.data.size === "big" && typeof size === "undefined") ){
            bag.data.size = "small";
            bag.htmlElement.removeClass("big").addClass("small");
        }

        setTimeout( function(){
            bag.refreshType();
        }, 300 );
    },

    // change color
    changeColor : function(color){
        var bag = this;

        if (_.contains(site.colors, color)){
            $(bag.htmlElement).attr("class", "tote-wrap " + color + " " + bag.data.size);
            bag.data.color = color;
        }
    },

    updateTextAreaSize : function($textarea){
        var bag = this;

        var $field = $textarea.parents(".editable-field");
        var textFieldID = $field.attr("id");
        var $clone = $textarea.siblings(".clone-text-wrap").find(".clone-text");
        var content = $textarea.val();

        $("button.save").removeClass("disabled");
        $(".clone-text-wrap").removeClass("invisible");

        if (content === "" || !site.validTextfieldRegex.test(content) ){
            $("button.save").addClass("disabled");
            $(".clone-text-wrap").addClass("invisible");

            if (content === ""){
                $clone.html("Type something.");
            }

        }
        else{
            var contentFormatted = site.textToHTML(content);
            $clone.html(contentFormatted);
        }

        while (content !== "" && $clone.height() > $clone.parents(".textfields-wrap").height()){
            content = content.substr(0, content.length-1);
            contentFormatted = site.textToHTML(content);
            $clone.html(contentFormatted);

            if ($clone.height() < $clone.parents(".textfields-wrap").height()){
                $textarea.val(content);
            }
        }


        if (bag.data && bag.data.textfields){
            // saving it.
            var theTextField = _.findWhere(bag.data.textfields, { "domid" : textFieldID });
            theTextField.text = content;

            // // double checking for character limit.
            // if (theTextField.text.length >= site.textfieldMaxLength){
            //     theTextField.text = theTextField.text.substr(0, site.textfieldMaxLength);
            // }

            if ($textarea.val() === ""){
                $field.addClass("new");
            }
            else{
                $field.removeClass("new");
            }

            // dealing with x and y
            var parentFontSize = parseInt($field.parents(".bag-body").css("font-size"));
            var newX = theTextField.x * parentFontSize;
            var newY = theTextField.y * parentFontSize;
            TweenLite.to($field, 0, { x : newX, y : newY });
        }
        TweenLite.to($field, 0.1, { height : $clone.height() } );
    },
    draw : function($parent, onComplete){
        var bag = this;

        // if a $parent wasn't defined, and ones already assigned, use that one.
        if (typeof $parent === "undefined" && bag.parent !== null){
            $parent = $(bag.parent);
        }

        else if (bag.parent === null && typeof $parent === "undefined"){
            console.log("you done fucked up");
            return;
        }
        // if there is no parent assigned to the bag, the parameter is assigned.
        else if (bag.parent === null && typeof $parent !== "undefined"){
            bag.parent = $parent;
        }

        var viewObj = { bags : [bag.data]};

        site.render(viewObj, "bag", bag.parent, function(){
            bag.htmlElement = bag.parent.find(".tote-wrap");
            site.refreshTypeOnTotes();

            if (typeof onComplete !== "undefined"){
                onComplete();
            }
        });
    },
    // right now this is function is only intended for the create page.
    newTextField : function(){
        var emptyTextObj = {
            y : 0,
            x : 0,
            width : "100%",
            justify : "left",
            fontSize : 0.28,
            kerning : -0.03,
            leading : 1
        };
        var domid = site.randomString(16);
        // if it finds something (not undefined), choose another id.
        while ( typeof _.findWhere(this.data.textfields, {"domid" : domid }) !== "undefined" ){
            domid = site.randomString(16);
        }
        emptyTextObj.domid = domid;

        this.data.textfields.push(emptyTextObj);

        if (this.data.textfields.length >= 4){
            $(".addTextfield").addClass("disabled");
        }
    },
    deleteTextField : function(domid, callback){
        var bag = this;
        var $field = $(this.htmlElement).find(".editable-field#" + domid);
        TweenLite.to($field, 0.3, {
            scale : 1.15,
            alpha : 0,
            onComplete : function(){
                $field.remove();
                bag.data.textfields = _.reject(bag.data.textfields, function(tf){
                    return tf.domid === domid;
                });
                if (bag.data.textfields.length < 4){
                    $(".addTextfield").removeClass("disabled");
                }

                if (typeof callback !== "undefined"){
                    callback();
                }
            }
        });
    },
    saveAs : function(){
        
        // double checks before we save it.
        if (this.data.textfields.length === 0 || this.data.textfields.length > 4)
            return;

        for (var i = 0; i < this.data.textfields.length; i++){
            // refuse any empty space text fields.
            if ( !site.validTextfieldRegex.test(this.data.textfields[i].text) ){
                return;
            }
        }

        var bagData = _.extend({}, this.data);
        delete bagData.editMode;
        bagData.timestamp = Math.round(new Date().getTime() / 1000);

        // use ajax to post tote to db
        $.ajax({
            type: 'POST',
            data: JSON.stringify(bagData),
            url: '/totes/createtote',
            contentType:"application/json; charset=utf-8",
            dataType: 'json'
        }).done(function( response, status ){
            // Check for successful (blank) response
            window.location.href = "/";
        }).fail(function( response, status ){
            alert('Something went wrong :(. Error: ' + response.msg);
        });
    }
};

function resizeHelper(){
    site.refreshTypeOnTotes();

    setTimeout(function(){
        site.refreshTypeOnTotes();
    }, 1000);

    if (site.breakpt() !== "sml"){
        TweenLite.to("nav", 0, { y : 0 });
    }
    else{
        scrollHelper();
    }
}


function scrollHelper(){
    var scroll = $("body").scrollTop();

    if ($(".content").hasClass("browse-page")){
        // when it gets one tile away from the end, it will load more.
        var distToEnd = $(document).height() - $(window).height() - scroll;
        if (distToEnd < $(".browse-tote-wrap .tote-grid-element").outerHeight()) {
            browse.loadMoreBags();
        }
    }
}

$(document).ready(function(){
    // Phase 3: identity is now the httpOnly bm_uid cookie set by the server.
    // The old client-side "likes" cookie is intentionally not migrated.

    $(document).hammer().on("tap", "button.close.createpage, button.close.createpage span", function(){
        window.location.href = "/";
    });

    site.refreshTypeOnTotes();
    $(window).resize(function(){
        resizeHelper();
    });

    $(window).scroll(function(){
        scrollHelper();
    });

    $(document).hammer().on("tap", ".create button, .create button span", function(){
        window.location.href = "/totes/newtote";
    });

    ga('send', 'pageview');
});