var viewPage = {
    // return a $(".tote-grid-element") object most optimally from either
    // a loaded element, or render one if it hasn't be rendered before.
    getToteGridHTML : function(data, callback){
        // if its an array, just take the [0] of it.
        if ( typeof data[0] !== "undefined"){
            data = data[0];
        }

        var toteId = data._id;
        var alreadyLoaded = _.findWhere(browse.toteBags, { "_id" : toteId });
        
        // if it hasn't been loaded before, render it.
        if (typeof alreadyLoaded === "undefined"){
            var toteObj = { bags : [data] };

            $.get("/templates/_bag.html", function(html) {
                Handlebars.registerHelper("textToHTML", function(text){
                    return site.textToHTML(text);
                });

                var template = Handlebars.compile(html);
                var rendered = template(toteObj);

                var $renderedTote = $("<div />", {
                    "class" : "tote-grid-element view " + toteObj.bags[0].color,
                    "data-id" : toteObj.bags[0]._id,
                    "html" :  rendered
                });

                callback($renderedTote, -1);
            });
        }

        // if we have already rendered it before, just grab the existing html.
        else{
            var toteIndex = _.indexOf(browse.toteBags, alreadyLoaded);
            var $tote = $(".browse-tote-wrap .tote-grid-element").eq(toteIndex);

            var $renderedTote = $("<div />", {
                "class" : $tote.attr("class") + " view",
                "data-id" : toteId,
                "html" :  $tote.html()
            });

            callback($renderedTote, toteIndex);
        }
    },
    nextTote : function(){
        var $carousel = $(".view-carousel-wrap");
        var currIndex = parseInt($(".view-carousel").attr("data-index"));
        var toteId = $(".view-carousel .tote-grid-element:last-child").attr("data-id");
        var dist = $carousel.find(".tote-grid-element").outerWidth();
        
        var loadNextIndex = currIndex + 2;
        var nextIndex = currIndex + 1;
        if (currIndex >= browse.totalBags - 2){
            loadNextIndex = 2 - (browse.totalBags - currIndex);
        }
        if (nextIndex >= browse.totalBags){
            nextIndex = 0;
        }

        browse.getToteObjFromIndex(loadNextIndex, animateNextTote);

        function animateNextTote(data){
            viewPage.getToteGridHTML(data, function($nextTote, nextToteId){
    
                if ($(".browse-tote-wrap .tote-grid-element").length < loadNextIndex){
                    browse.loadMoreBags();
                }

                // animating a swing with the carousel.
                TweenLite.to(".view-carousel .tote-grid-element .actual-tote", 0.3, {
                    rotation : "-10deg",
                    ease : gridBagBezier,
                    onComplete : function(){
                        TweenLite.to(".view-carousel .tote-grid-element .actual-tote", 0.3, {
                            rotation : "0deg",
                            ease : gridBagBezier,
                        });
                    }
                });
                TweenLite.to(".view-carousel .tote-grid-element .tote-shadow", 0.3, {
                    rotation : "10deg",
                    scaleX : 0.9,
                    ease : gridBagBezier,
                    onComplete : function(){
                        TweenLite.to(".view-carousel .tote-grid-element .tote-shadow", 0.3, {
                            rotation : "0deg",
                            ease : gridBagBezier,
                        });
                    }
                });
            
                TweenLite.to($carousel, 0.5, {
                    x : -dist,
                    ease: cssBezier,
                    onComplete : function() {
                        $carousel.append( $nextTote );

                        $carousel.find(".tote-grid-element:first-child").remove();
                        TweenLite.to($carousel, 0, { x : 0 });

                        $(".view-carousel").attr("data-display", toteId ).attr("data-index", nextIndex);

                        window.history.pushState("html", "Title", "/" + browse.currSort + "/tote/" + toteId);
                        // $("head title").html("View Tote | Maker | Huge inc.");
                        site.refreshTypeOnTotes();
                        $(".view-carousel-wrap .tote-grid-element .tote-shadow").css("opacity", "1");
                        var alreadyLoadedToteObj = _.findWhere(browse.toteBags, { "_id" : toteId });
                        $(".view-controls .heart-outer-wrap").attr("class", "heart-outer-wrap " + alreadyLoadedToteObj.color);
                        viewPage.updateLikes();
                        bagObject.upViewCount(toteId);
                    }
                });
            });
        }
    },
    prevTote : function(){
        var $carousel = $(".view-carousel-wrap");
        var currIndex = parseInt($(".view-carousel").attr("data-index"));
        var toteId = $(".view-carousel .tote-grid-element:first-child").attr("data-id");
        var dist = $carousel.find(".tote-grid-element").outerWidth();

        var loadPrevIndex = currIndex - 2;
        var prevIndex = currIndex - 1;
        if (currIndex <= 1){
            loadPrevIndex = browse.totalBags - (2 - currIndex);
        }
        if (prevIndex < 0){
            prevIndex = browse.totalBags - 1;
        }

        browse.getToteObjFromIndex(loadPrevIndex, animatePrevTote);

        function animatePrevTote(data){
           viewPage.getToteGridHTML(data, function($prevTote, prevToteId){

                // animation
                TweenLite.to(".view-carousel .tote-grid-element .actual-tote", 0.3, {
                    rotation : "10deg",
                    ease : gridBagBezier,
                    onComplete : function(){
                        TweenLite.to(".view-carousel .tote-grid-element .actual-tote", 0.3, {
                            rotation : "0deg",
                            ease : gridBagBezier,
                        });
                    }
                });
                TweenLite.to(".view-carousel .tote-grid-element .tote-shadow", 0.3, {
                    rotation : "-10deg",
                    scaleX : 0.9,
                    ease : gridBagBezier,
                    onComplete : function(){
                        TweenLite.to(".view-carousel .tote-grid-element .tote-shadow", 0.3, {
                            rotation : "0deg",
                            ease : gridBagBezier,
                        });
                    }
                });

                TweenLite.to($carousel, 0.5, {
                    x : dist,
                    ease: cssBezier,
                    onComplete : function() {
                        $carousel.prepend( $prevTote );

                        $carousel.find(".tote-grid-element:last-child").remove();
                        TweenLite.to($carousel, 0, { x : 0 });

                        $carousel.parents(".view-carousel").attr("data-display", toteId ).attr("data-index", prevIndex);;
                        window.history.pushState("html", "Title", "/" + browse.currSort + "/tote/" + toteId);

                        // $("head title").html("View Tote | Maker | Huge inc.");
                        site.refreshTypeOnTotes();
                        $(".view-carousel-wrap .tote-grid-element .tote-shadow").css("opacity", "1");
                        var alreadyLoadedToteObj = _.findWhere(browse.toteBags, { "_id" : toteId });
                        $(".view-controls .heart-outer-wrap").attr("class", "heart-outer-wrap " + alreadyLoadedToteObj.color);
                        viewPage.updateLikes();
                        bagObject.upViewCount(toteId);
                    }
                });
            });
        }
    },
    updateLikes : function(){
        var toteID = $(".view-carousel").attr("data-display");

        // user likes it and the button isn't already liked
        if (likes.indexOf(toteID) > -1 && !$(".view-controls .heart-outer-wrap").hasClass("favorited") ){
            likes.favorite($(".view-controls .heart-outer-wrap"));
        }
        // user doesnt like it and the button is liked.
        else if (likes.indexOf(toteID) === -1 && $(".view-controls .heart-outer-wrap").hasClass("favorited")) {
            likes.unfavorite($(".view-controls .heart-outer-wrap"));
        }

        // Phase 3: keep the view-page like-count badge in sync with the centered tote.
        // .view-like-count is always in the DOM (from index.pug) — we toggle .hidden
        // when count is 0 to match the grid's "no badge when zero" behavior.
        if (typeof browse !== "undefined" && browse.toteBags){
            var centered = _.findWhere(browse.toteBags, { "_id" : toteID });
            var n = (centered && typeof centered.likeCount === "number") ? centered.likeCount : 0;
            var $vlc = $(".view-like-count");
            $vlc.parent().removeClass("red white black").addClass(centered.color);
            if (n > 0){
                $vlc.text(n).removeClass("hidden");
            } else {
                $vlc.text("").addClass("hidden");
            }
        }
    }
};

$(document).ready(function(){
    $(document).hammer().on("tap", ".view-controls button.left", function(){
        viewPage.prevTote();
    });

    $(document).hammer().on("tap", ".view-controls button.right", function(){
        viewPage.nextTote();
    });

    $(document).hammer().on("tap", ".view-carousel.on button.close, .view-carousel.on button.close span", function(e){
        e.preventDefault();
        e.stopPropagation();

        browse.viewZoomOut();
    });

    $(document).on("keyup", function(e){
        if ($(".view-carousel").hasClass("on")){
            // right
            if (e.keyCode === 39){
                viewPage.nextTote();
            }

            // left
            else if (e.keyCode === 37){
                viewPage.prevTote();
            }

            // up
            else if (e.keyCode === 38){
                var currScroll = $(".view-carousel-wrap").scrollTop();
                $(".view-carousel-wrap").scrollTop(currScroll - 10);
            }

            // down
            else if (e.keyCode === 40){
                var currScroll = $(".view-carousel-wrap").scrollTop();
                $(".view-carousel-wrap").scrollTop(currScroll + 10);
            }

            // escape
            else if (e.keyCode === 27){
                browse.viewZoomOut();
            }
        }
    });

    $(document).hammer().on("drag", ".view-carousel-wrap", function(e){
        e.preventDefault();
        e.stopPropagation();

        var dir = e.gesture.direction;
        if (dir === "left" || dir === "right"){
            if (site.isTouch()){
                // locks scroll on drag
                $(".view-carousel-wrap").css("overflow", "hidden");
            }

            TweenLite.to($(this), 0, { "x" : e.gesture.deltaX });
        
            if (dir === "left"){
                // animating a swing with the carousel.
                TweenLite.to(".view-carousel .tote-grid-element .actual-tote", 0.3, {
                    rotation : "-3deg",
                    ease : gridBagBezier,
                    onComplete : function(){
                        TweenLite.to(".view-carousel .tote-grid-element .actual-tote", 0.3, {
                            rotation : "0deg",
                            ease : gridBagBezier,
                        });
                    }
                });
                TweenLite.to(".view-carousel .tote-grid-element .tote-shadow", 0.3, {
                    rotation : "3deg",
                    scaleX : 0.9,
                    ease : gridBagBezier,
                    onComplete : function(){
                        TweenLite.to(".view-carousel .tote-grid-element .tote-shadow", 0.3, {
                            rotation : "0deg",
                            ease : gridBagBezier,
                        });
                    }
                });
            }
            else{
                // animating a swing with the carousel.
                TweenLite.to(".view-carousel .tote-grid-element .actual-tote", 0.3, {
                    rotation : "3deg",
                    ease : gridBagBezier,
                    onComplete : function(){
                        TweenLite.to(".view-carousel .tote-grid-element .actual-tote", 0.3, {
                            rotation : "0deg",
                            ease : gridBagBezier,
                        });
                    }
                });
                TweenLite.to(".view-carousel .tote-grid-element .tote-shadow", 0.3, {
                    rotation : "-3deg",
                    scaleX : 0.9,
                    ease : gridBagBezier,
                    onComplete : function(){
                        TweenLite.to(".view-carousel .tote-grid-element .tote-shadow", 0.3, {
                            rotation : "0deg",
                            ease : gridBagBezier,
                        });
                    }
                });
            }
        }
    });

    $(document).hammer().on("dragend", ".view-carousel-wrap", function(e){
        e.preventDefault();
        e.stopPropagation();

        var dir = e.gesture.direction;

        if (site.isTouch() && (dir === "left" || dir === "right")) {
            // unlocks scroll on release.
            $(".view-carousel-wrap").css("overflow", "auto");
        }

        if (dir === "left"){
            viewPage.nextTote();
        }
        else if (dir === "right"){
            viewPage.prevTote();
        }
    });

    // i have no idea why this bug is happening, but here's a fix...
    $(".view-carousel-wrap").scroll(function(){
        var scroll = $(".view-carousel-wrap").scrollTop();
        var carouselHeight = $(".view-carousel-wrap").height();

        if (scroll > (carouselHeight/2))
            $(".view-carousel-wrap").scrollTop(carouselHeight / 2);
    });
});