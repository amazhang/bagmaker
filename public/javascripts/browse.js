var browse = {
    toteBags : null, // array of tote objects
    currPage : 1,
    numPerPage : 24,
    currSort : "latest",
    loadedAll : false,
    totalBags : -1,
    currentlyBuilding : false,

    getToteObj : function(toteID, callback){
        var tote = _.findWhere(browse.toteBags, {"_id" : toteID});

        if (typeof tote === "undefined"){    
            $.getJSON('/data/' + browse.currSort + '/tote/' + toteID, function( data ){
                callback(data, -1);
            });
        }
        else{
            var index = _.indexOf(browse.toteBags, tote);
            callback(tote, index);
        }
    },

    getToteObjFromIndex : function(index, callback){
        if (browse.toteBags.length >= index)
            callback([browse.toteBags[index]]);
        else{
            $.getJSON("/data/" + browse.currSort + "/" + index, function( data ){
                callback(data);
            });
        }
    },

    sort : function($li){
        var attr = $li.attr("data-attr");
        var dir = $li.attr("data-dir");
        var sortName = $li.html();
        var newSort;

        $("nav .sort .name").html( sortName );
        if (sortName === "Latest") { newSort = "latest"; }
        else if (sortName === "Oldest") { newSort = "oldest"; }
        else if (sortName === "Popular") { newSort = "popular"; }
        else if (sortName === "Most Views") { newSort = "views"; }

        // it changed.
        if (newSort !== browse.currSort){
            browse.currSort = newSort;
            browse.currPage = 1;
            window.history.pushState("html", "Title", "/" + newSort);
            $("head title").html(sortName + " | Totebag Maker | Huge inc.");

            browse.animateOut(function(){
                $(".browse-tote-wrap").empty();
                browse.toteBags = null;
                browse.loadedAll = false;

                if ($li.hasClass("sort-option")){
                    $(".sort-option").removeClass("sel");
                    $li.addClass("sel");
                }

                browse.loadBags( function(){
                    browse.buildBagGrid();
                });
            });
        }
        
    },
    gridOrderHelper : function(input){
        var gridWidth = $(".tote-grid-element").width();
        var currColumns = Math.round($(window).width() / gridWidth);
        var mod = input % (currColumns * 2);

        if (mod < currColumns){
            return input;
        }
        else{
            return (input + ((currColumns - 1) - ( mod - currColumns) * 2));
        }
    },
    animateIn : function(startIndex, callback){
        startIndex = startIndex || 0;
        browse.animateInHelper(startIndex, callback);
    },
    animateInHelper : function(ind, callback){
        var totalGridElements = $(".tote-grid-element").length;
        if (ind >= totalGridElements) {
            setTimeout(function(){
                // catch all.
                $(".tote-grid-element.start").removeClass('start');
                
                if (callback && callback !== undefined){
                    callback();
                }
            }, (ind % browse.numPerPage) * 15);
            return;
        }
        else{
            setTimeout(function(){
                var output = browse.gridOrderHelper(ind);

                if ( $(".tote-grid-element").eq(output).length === 0 ){
                    output = ind;
                }

                //console.log(ind, output);
                $(".tote-grid-element").eq(output).removeClass("start");
                browse.animateInHelper(ind+1, callback);

            }, (ind % browse.numPerPage) * 15);
        }
    },
    // Animate grid out is the opposite of animateIn. Also, recursive.
    animateOut : function(callback){
        var totalGridElements = $(".tote-grid-element").length;
        
        if (totalGridElements > 24){
            TweenLite.to(".browse-tote-wrap", 0.3, {
                alpha: 0,
                ease: cssBezier,
                onComplete : function(){
                    $(".browse-tote-wrap").empty();
                    $(".browse-tote-wrap").css("opacity", "1");
                    callback();
                }
            });
        }
        else{
            browse.animateOutHelper( totalGridElements - 1, callback );
        }
    },
    animateOutHelper : function(ind, callback){
        var elementNum = $(".tote-grid-element").length;
        if (ind < 0) {
            setTimeout(function(){
                if (callback && callback !== undefined){
                    callback();
                }
            }, elementNum * 5);
            return;
        }
        else{
            setTimeout(function(){
                var output = browse.gridOrderHelper(ind);
                $(".tote-grid-element").eq(output).addClass("start");
                browse.animateOutHelper(ind-1, callback);
            }, (elementNum - ind) * 5);
        }
    },
    loadMoreBags : function(){
        if (browse.currentlyBuilding){
            return;
        }

        browse.loadBags( function(){ 
            browse.buildBagGrid();
        });
    },
    // grab tote data
    loadBags : function(callback){
        browse.currentlyBuilding = true;

        if (browse.toteBags === null){
            $.getJSON('/data/' + browse.currSort + '/page/' + browse.currPage, function( data ){
                // sort it by time - newest
                browse.toteBags = data;

                // No totes at all? Show empty state and bail out.
                if (data.length === 0){
                    $(".empty-state").removeClass("hidden");
                    $("nav.hidden").removeClass("hidden");
                    browse.loadedAll = true;
                    browse.currentlyBuilding = false;
                    return;
                }

                // Make sure empty state is hidden in case it was shown previously.
                $(".empty-state").addClass("hidden");

                // build grid.
                if (typeof callback !== "undefined"){
                    callback();
                }
            });
        }
        else{
            if (browse.loadedAll){
                return;
            }

            browse.currPage = browse.currPage + 1;
            $.getJSON('/data/' + browse.currSort + '/page/' + browse.currPage, function( data ){
                // we need to check data to see if its [] and then flag it as the end.
                if (data.length < browse.numPerPage){
                    browse.loadedAll = true;
                }

                browse.toteBags = browse.toteBags.concat(data);
                if (typeof callback !== "undefined"){
                    callback();
                }
            });
        }

    },
    buildBagGrid : function(animate, callback){
        if (typeof animate === "undefined"){
            animate = true;
        }
        var startIndex = ((browse.currPage - 1) * browse.numPerPage);
        var endIndex = startIndex + browse.numPerPage;
        var subsetTotes = browse.toteBags.slice(startIndex, endIndex);

        // create a slightly modified bag template html for each (add favoriting)
        $.get("/templates/_bag.html", function(html) {
            _.each(subsetTotes, function(tote){
                tote.swingTimer = null;
                var toteObj = {bags : [tote]};
                
                Handlebars.registerHelper("textToHTML", function(text){
                    return site.textToHTML(text);
                });

                var template = Handlebars.compile(html);
                var rendered = template(toteObj);

                // marking which ones are favorited.
                var heartWrap = "<button class='heart-outer-wrap'><div class='heart-wrap'>";
                var toteID = toteObj.bags[0]._id;
                if (likes.indexOf(toteID) > -1){
                    heartWrap = "<button class='heart-outer-wrap favorited'><div class='heart-wrap'>";
                }

                heartWrap += "<div class='heart-circle'></div>" +
                                "<div class='heart'>" + 
                                    '<svg width="32px" height="29px" viewBox="15 18 36 33"><path d="M39.9504969,20.4285714 C37.4437267,20.4285714 34.8843478,21.6982109 33,24.6490918 C31.1163354,21.6982109 28.5562733,20.4292823 26.0495031,20.4285714 C21.5825466,20.4285714 17.2857143,24.4592857 17.2857143,30.186881 C17.2857143,36.2365068 22.5158385,40.5508639 26.4539752,43.8067143 C30.5410559,47.1905238 31.688882,47.9113605 33,49.2812347 C34.311118,47.9113605 35.4589441,47.1905238 39.5460248,43.8067143 C43.4841615,40.5508639 48.7142857,36.2365068 48.7142857,30.186881 C48.7142857,24.4592857 44.4167702,20.4285714 39.9504969,20.4285714"></path></svg>'+
                                "</div>" +
                            "</div></button>";

                var $tote = $("<div />", {
                    //id : "tote-" + tote._id,
                    class : "tote-grid-element start " + toteObj.bags[0].color,
                    html :  heartWrap + rendered
                });
                $tote.appendTo(".browse-page.content .browse-tote-wrap");

                // on the last one, update the type sizing and animate it in.
                if ( tote === browse.toteBags[browse.toteBags.length-1] ){
                    $('.browse-page.content .browse-tote-wrap .clearfix').remove();
                    $('.browse-page.content .browse-tote-wrap').append("<div class='clearfix'></div>");
    
                    if (animate){
                        browse.animateIn(startIndex, function(){
                            browse.currentlyBuilding = false;
                            site.refreshTypeOnTotes();
                        });
                    }
                    else{
                        $(".tote-grid-element.start").addClass("noAnimate").removeClass("start").removeClass("noAnimate");
                        browse.currentlyBuilding = false;
                    }

                    $("nav.hidden").removeClass("hidden");
                    site.refreshTypeOnTotes();
                    if (typeof callback !== "undefined"){
                        callback();
                    }
                }
            });
        });      
    },
    // positions the view carousel with the $tote centered.
    view : function(toteId){
        // grab all the data.
        var currJsonURL = "/data/" + browse.currSort + "/tote/" + toteId;
        var toteObjArray = [];
        var toteIdArray = [];
        var currBag, nextBag, prevBag;

        $.getJSON(currJsonURL, function( data ){
            // toteIdArray.push(toteId);
            currBag = {bags : [data]};
            $(".view-controls .heart-outer-wrap").attr("class", "heart-outer-wrap " + data.color);
            
            var currIndex = data.index;
            var prevIndex = data.prevIndex;
            var nextIndex = data.nextIndex;
            browse.totalBags = data.totalBags;

            $(".view-carousel").attr("data-index", currIndex);

            browse.getToteObjFromIndex(prevIndex, function(prevData){
                prevBag = {bags : prevData};

                browse.getToteObjFromIndex(nextIndex, function(nextData){
                    nextBag = {bags : nextData};

                    toteObjArray = [prevBag, currBag, nextBag];
                    toteIdArray = [prevBag.bags[0]._id, currBag.bags[0]._id, nextBag.bags[0]._id];
                    loadToteViews();

                    $(".view-carousel").addClass("on");
                });
            });
        });
        
        function loadToteViews(){
            $.get("/templates/_bag.html", function(html) {
                Handlebars.registerHelper("textToHTML", function(text){
                    return site.textToHTML(text);
                });

                var template = Handlebars.compile(html);
                
                for (var i = 0; i < toteObjArray.length; i++){
                    var rendered = template(toteObjArray[i]);
                    
                    if (likes.indexOf(toteIdArray[i]) > -1){
                        // if its liked and its the middle one (the centered one), mark it as favorited.
                        if (i === 1){
                            $(".view-controls .heart-outer-wrap").addClass("favorited");
                        }
                    }

                    var $tote = $("<div />", {
                        "class" : "tote-grid-element view " + toteObjArray[i].bags[0].color,
                        "data-id" : toteIdArray[i],
                        "html" :  rendered
                    }).appendTo(".view-carousel-wrap");
                }

                // stop it from swinging.
                TweenLite.to(".view-carousel-wrap .tote-grid-element .actual-tote, .view-carousel-wrap .tote-grid-element .tote-shadow", 0, { rotation : "0deg" });
                TweenLite.to(".view-carousel-wrap .tote-grid-element .tote-shadow", 0.5, {
                    "alpha" : 1,
                    "ease" : cssBezier
                });
                $(".view-carousel-wrap .tote-grid-element.swinging").removeClass("swinging");
                
                //update bag size / favorites
                site.refreshTypeOnTotes();

                // scroll user to center the bag.
                var $tote = $(".view-carousel-wrap .tote-grid-element").eq(1);
                var viewToteHeight = $tote.find(".tote-wrap").height();
                var viewGridHeight = $tote.height();

                // scroll to the center if the bag height is smaller than the window height
                var scrollAmount = ((viewGridHeight - $(window).height()) / 2);
                // if the bag height is larger than the window height, scroll to the bottom.
                if (viewToteHeight > $(window).height()){
                    scrollAmount = viewToteHeight;
                }
                $(".view-carousel-wrap").scrollTop( scrollAmount );

                window.history.pushState("html", "Title", "/" + browse.currSort + "/tote/" + toteId);
                bagObject.upViewCount(toteId);

                $("head title").html("View Tote | Totebag Maker | Huge inc.");
                $("body").addClass("lock-scroll");
                $(".view-carousel").attr("data-display", toteId);
            });
        }
    },
    viewZoomIn : function($tote){
        var x = $tote.offset().left;
        var y = $tote.offset().top - $(window).scrollTop();
        var h = $tote.outerHeight();
        var w = $tote.outerWidth();
        var $dupe = $("<div />", {
            "id" : "zoomAnimation",
            "class" : $tote.attr("class") + "",
            "html" : $tote.html()
        });
        $dupe.find(".heart-outer-wrap").remove();
        $dupe.height(h);
        $dupe.width(w);

        // add all the shit.
        $(".zoomAnimationWrapper").append($dupe);
        TweenLite.to($dupe, 0, { x : x, y : y });

        $dupe.removeClass("swinging");
        TweenLite.to($dupe.find(".actual-tote"), 0.3, { rotation: "0deg" });
        TweenLite.to($dupe.find(".tote-shadow"), 0.3, { rotation: "0deg" });

        site.refreshTypeOnTotes();
        $("body").addClass("lock-scroll");
        
        // animating to full screen
        var windowWidth = $(window).width();
        var windowHeight = $(window).height();
        var ratio = Math.round(windowWidth / w);

        TweenLite.to($dupe, 0.5, {
            x : (ratio - 1)/2 * w,
            y : 0,
            height: (1.5 * windowHeight / ratio),
            scale : ratio,
            ease : cssBezier,
            onComplete : function(){
                // redraw the same bag instantly so that we aren't dealing with scale anymore
                TweenLite.to($dupe, 0, {
                    x : 0,
                    y : 0,
                    width : "100%",
                    height : (1.5 * windowHeight),
                    scale : 1
                });
                site.refreshTypeOnTotes();
                var animationToteHeight = $dupe.find(".tote-wrap").height();
                var animationGridHeight = $dupe.height();

                // scroll to the center if the bag height is smaller than the window height
                var scrollAmount = ( ( $(window).height() - animationToteHeight)/2);

                // if the bag height is larger than the window height, scroll to the bottom.
                if (animationToteHeight > $(window).height()){
                    scrollAmount = animationGridHeight;
                }

                $(".zoomAnimationWrapper").animate({
                    scrollTop : scrollAmount
                }, 300, function(){
                    var toteIndex = $tote.index();
                    var toteId = browse.toteBags[toteIndex]._id;
                    browse.view(toteId);

                    setTimeout(function(){
                        $("#zoomAnimation").remove();
                    }, 1000);
                });
            }
        });
    },
    viewZoomOut : function(){
        // find which tote in the grid it is.
        var toteID = $(".view-carousel").attr("data-display");
        var x,y,w,ratio,inverseRatio;

        // zooming out
        function zoomOutAnimate($dupe){
            TweenLite.to($dupe, 0.5, {
                x : (x - ((inverseRatio - 1) * 1/2 * w)),
                y : y - $(window).scrollTop(),
                scale : ratio,
                ease : cssBezier,
                height : (w / ratio),
                onComplete : function(){
                    $dupe.remove();
                    $(".view-controls button.disabled").removeClass("disabled");
                    window.history.pushState("html", "Title", "/" + browse.currSort);
                    $("head title").html("Totebag Maker | Huge inc.");
                }
            });
        }

        browse.getToteObj(toteID, function(tote, bagIndex){

            // if its in the grid DOM.
            if (bagIndex > -1){
                var $tote = $(".browse-tote-wrap .tote-grid-element").eq(bagIndex);

                // dupe that for the animation.
                var $dupe = $("<div />", {
                    "id" : "zoomAnimation",
                    "class" : $tote.attr("class") + "",
                    "html" : $tote.html()
                });
                $dupe.find(".heart-outer-wrap").remove();

                // get all them measurements.
                w = $tote.outerWidth();
                var windowWidth = $(window).width();
                var windowHeight = $(window).height();
                ratio = w / windowWidth;
                inverseRatio = Math.round(1/ratio);
                x = $tote.offset().left;
                y = $tote.offset().top;

                // morph the duplicate to be the right size.
                TweenLite.to($dupe, 0, {
                    x : 0,
                    y : 0,
                    width: "100%",
                    scale : 1,
                    height : (1.5 * windowHeight)
                });
                $(".zoomAnimationWrapper").append($dupe);
                site.refreshTypeOnTotes();

                // Getting the right scroll spot.
                var scrollAmount = $(".view-carousel-wrap").scrollTop();
                $(".zoomAnimationWrapper").scrollTop(scrollAmount);
                $(".view-carousel-wrap").empty();
                $(".view-carousel").removeClass("on");

                // Animation part of it.
                $("body").removeClass("lock-scroll");
                if ( (y > $(window).scrollTop() + $(window).outerHeight() - w) || (y < $(window).scrollTop() ) ){
                    $("body", "html").animate({
                        scrollTop : y - w,
                    }, 0, function(){
                        zoomOutAnimate($dupe);
                    });
                }
                else{
                    zoomOutAnimate($dupe);
                }
            }
            // if it's not.
            else{
                window.location.href = "/";
            }
        });
        
    },
    swingOnce : function($bag){
        // var $bag = $(".tote-grid-element").eq(index);
        var $tote = $bag.find(".actual-tote");
        var $shadow = $bag.find(".tote-shadow");

        // $shadow.parents(".shadow-blur").css("opacity", "1");

        //start at 0
        // swing to the left
        TweenLite.to($shadow, 0.5, { rotation : "-4deg", scaleX : 0.9, ease : gridBagBezier });
        TweenLite.to($tote, 0.5, {
            rotation : "5deg",
            ease : gridBagBezier,
            onComplete : function(){
                // swing to the right, double the distance, double the time.
                TweenLite.to($shadow, 0.5, {
                    rotation : "0deg",
                    scaleX : 1,
                    ease : gridBagBezier,
                    onComplete: function(){
                        TweenLite.to($shadow, 0.5, {
                            rotation : "4deg",
                            scaleX : 0.9,
                            ease : gridBagBezier
                        });
                    }
                }); 
                TweenLite.to($tote, 1, {
                    rotation : "-5deg",
                    ease : gridBagBezier,
                    onComplete : function(){
                        // swing back to 0
                        TweenLite.to($shadow, 0.5, {
                            rotation : "0.1deg",
                            scaleX : 1,
                            ease : gridBagBezier,
                            onComplete : function(){
                                // $shadow.parents(".shadow-blur").css("opacity", "0");
                            }
                        });
                        TweenLite.to($tote, 0.5, {
                            rotation : "-0.1deg",
                            ease : gridBagBezier
                        });
                    }
                });    
            }
        });
    },
    swing : function($tote){
        var index;
        if (typeof $tote.attr("data-id") === "undefined"){
            index = $tote.index();
        }
        else{
            index = parseInt($tote.attr("data-id"));
        }

        if ( !$tote.hasClass("swinging") ){
            browse.swingOnce($tote);
            $tote.addClass("swinging");
            browse.toteBags[index].swingTimer = setInterval(function(){ browse.swingOnce($tote); }, 1870);
        }
        // rolling over something thats already swinging
        else{
            clearTimeout(browse.toteBags[index].stopTimer);
        }
    },
    stopSwing : function($tote){
        var index;
        if (typeof $tote.attr("data-id") === "undefined"){
            index = $tote.index();
        }
        else{
            index = parseInt($tote.attr("data-id"));
        }

        browse.toteBags[index].stopTimer = setTimeout(function(){
            $tote.removeClass("swinging");
            clearInterval(browse.toteBags[index].swingTimer);
        }, 500);
    },
    syncSortView : function(){
        // update sort from URL.
        // browse.currSort = $("#sort").html();
        browse.currSort = $("#sort").html();
        $("#sort").remove();

        window.history.pushState("html", "Title", "/" + browse.currSort);

        // update the UI on the sort button.
        var sortName;
        if (browse.currSort === "latest") { sortName = "Latest"; }
        else if (browse.currSort === "oldest") { sortName = "Oldest"; }
        else if (browse.currSort === "popular") { sortName = "Popular"; }
        else if (browse.currSort === "views") { sortName = "Most Views"; }
        else { sortName = "Latest"; }
        
        $("nav .sort .selected-sort .name").html(sortName);
        $(".sort-option[data-name='" + browse.currSort + "']").addClass("sel");
    }
};

$(document).ready(function(){
    likes.fetchUserLikes();
    browse.syncSortView();

    browse.loadBags(function(){

        // check to see if its a view page actually.
        var viewId = $("#viewId").html();
        $("#viewId").remove();

        if (viewId === ""){
            browse.buildBagGrid();
        }
        else{
            browse.view(viewId);
            setTimeout(function(){
                browse.buildBagGrid(false);
            }, 500);
        }


        window.onpopstate = function(event) {
            var loc = document.location;
            // if we're in a view page, zoom out
            if ( $(".view-carousel").hasClass("on") ){
                browse.viewZoomOut();
            }

            else{
                window.location.href = "/";
            }
        };

    });

    $(".sort").hover(function(){
        $(".sort").toggleClass("on-state");
    });
    $(".sort ul li, .sort .sort-option").hammer().on("tap", function(){
        browse.sort($(this));
    });

    $(document).hammer().on("tap, release", "button.heart-outer-wrap", function(e){
        e.preventDefault();
        e.stopPropagation();

        var toteIndex;
        var toteID;

        // its in the view mode
        if ($(this).parents(".view-controls").length > 0){
            toteID = $(this).parents(".view-carousel").attr("data-display");
        }
        else{
            var $gridEle = $(this).parents(".tote-grid-element");
            toteIndex = $gridEle.index();
            
            var toteBag = browse.toteBags[toteIndex];
            toteID = toteBag._id;
        }

        //likes.toggleLike(toteID);
        if ($(this).hasClass("favorited")){
            likes.unfavorite($(this));
            likes.unlikeBag(toteID);

            // its in the view mode
            if ($(this).parents(".view-controls").length > 0){
                likes.unfavorite($(".browse-tote-wrap .tote-grid-element").eq(toteIndex).find(".heart-outer-wrap"));
            }
        }
        else{
            likes.favorite($(this));
            likes.likeBag(toteID);

            // its in the view mode
            if ($(this).parents(".view-controls").length > 0){
                likes.favorite($(".browse-tote-wrap .tote-grid-element").eq(toteIndex).find(".heart-outer-wrap"));
            }
        }
    });

    $(document).on("mouseenter", ".browse-tote-wrap .tote-grid-element", function(){
        browse.swing($(this));
    });

    $(document).on("mouseleave", ".browse-tote-wrap .tote-grid-element", function(){
        browse.stopSwing($(this));
    });

    $(".tote-grid-element").hover(function(){
        browse.swing($(this));
    }, function(){
        browse.stopSwing($(this));
    });

    $(document).hammer().on("release", ".browse-tote-wrap .tote-grid-element", function(e){
        e.preventDefault();
        e.stopPropagation();

        // if its meant to scroll
        if ( Math.abs(e.gesture.deltaX) > 10 || Math.abs(e.gesture.deltaY) > 10 )
            return;

        browse.viewZoomIn($(this));
    });
});