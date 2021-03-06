'use strict';

var canvas, ctx, flag = false,
    prevX = 0,
    currX = 0,
    prevY = 0,
    currY = 0;

var lineColor = 'red',
    lineWidth = 2;

var toggle = 'off';
var highlighter = false; 

var tabUrl = CryptoJS.SHA1(document.URL).toString();

var getCurrentUser = function(callback){
  chrome.runtime.sendMessage({action: 'getUser'}, function(response) {
    callback(response.user);
  });
};

var saveUserCanvas = function(){
  var data = canvas.toDataURL();
  chrome.runtime.sendMessage(
    {action: 'saveCanvas', site: tabUrl, data: data},
    function(response) {
      if (response.saveStatus) {
        console.log('saving user canvas');
      } else {
        console.log('failed to save canvas');
    }
  });
};

var drawLine = function(){
  ctx.beginPath();
  ctx.moveTo(prevX + pageXOffset, prevY + pageYOffset);
  ctx.lineTo(currX + pageXOffset, currY + pageYOffset);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.closePath();
};

var findxy = function(res, e){
  if (res === 'down') {
    flag = true;
    prevX = currX;
    prevY = currY;
    currX = e.clientX - canvas.offsetLeft;
    currY = e.clientY - canvas.offsetTop;
    ctx.beginPath();
    ctx.fillStyle = lineColor;
    ctx.fillRect(currX, currY, 2, 2);
    ctx.closePath();
  }
  if (res === 'up' || res === 'out') {
    flag = false;
  }
  if (res === 'move') {
    if (flag) {
      prevX = currX;
      prevY = currY;
      currX = e.clientX - canvas.offsetLeft;
      currY = e.clientY - canvas.offsetTop;
      drawLine();
    }
  }
};

var turnEditOn = function($canvas){
  $canvas.css({zIndex: 100, position: 'absolute', top: 0,left: 0,'pointer-events': ''})
    .on('mousemove', function(e){findxy('move', e);})
    .on('mousedown', function(e){findxy('down', e);})
    .on('mouseup', function(e){
      findxy('up', e);
      saveUserCanvas();
    })
    .on('mouseout', function(e){ findxy('out', e);})

  getCurrentUser(function(user){
    canvas = document.getElementsByClassName(user)[0];
    ctx = canvas.getContext('2d');
  });
};

var turnEditOff = function($canvas){
  $canvas.css({position: 'absolute', top: 0,left: 0, 'pointer-events': 'none'})
    .off();
};

var appendCanvasElement = function(name){
  $('<canvas id="graffeo-canvas"></canvas>')
    .css({position: 'absolute', top: 0, left: 0, 'pointer-events': 'none'})
    .attr('width', document.body.scrollWidth)
    .attr('height', document.body.scrollHeight)
    .attr('class', name)
    .appendTo('body');
};

var drawCanvasElement = function(context, data){
  var imageObj = new Image();
  imageObj.src = data;
  imageObj.onload = function(){
    context.drawImage(this, 0, 0);
  };
};

var toggleUserCanvasOn = function(){
  if ( toggle === 'off' ) {
    getCurrentUser(function(user){
      var userCanvas = $('.' + user);
      if (userCanvas.length === 0){
        appendCanvasElement(user);
        userCanvas = $('.' + user);
        turnEditOn(userCanvas);
      } else {
        turnEditOn(userCanvas);
      }
      toggle = 'on';
    });
  }
};

var toggleUserCanvasOff = function(){
  getCurrentUser(function(user){
    var userCanvas = $('.' + user);
    turnEditOff(userCanvas);
    toggle = 'off';
  });
};

var removeGraffeoCanvasAll = function(){
  console.log('helo remove')
 $('canvas#graffeo-canvas').remove();
};

var clearUserCanvas = function(){
  ctx.clearRectangle(0, 0, canvas.width, canvas.height);
  saveUserCanvas();
};

var onCanvasData = function(site, user, data) {
  // if the user does not already have a canvas
  if (tabUrl === site) {
    if (!document.getElementsByClassName(user)[0]) {
      appendCanvasElement(user);
    }
    var context = document.getElementsByClassName(user)[0].getContext('2d');
    drawCanvasElement(context, data);
  }
};

var eraseUserCanvas = function(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

var addImage = function(src, event){
  var img = new Image();
  img.setAttribute('crossOrigin', 'anonymous');
  img.src = chrome.extension.getURL(src);
  img.onload = function(){
    ctx.drawImage(img, event.clientX - 25, event.clientY - 25);
  };
};

var addOneTimeClickEvent = function(element, callback, src){
  element.on('click', function(event){
    callback(src, event);
    element.off('click');
  });
};

// Message Handler
chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse){
    // Toggle User Canvas Messages
    if ( request.toggle === 'off' ){
        toggleUserCanvasOff();
        sendResponse({confirm:'canvas turned off'});
    } else if ( request.toggle === 'on' ){
        toggleUserCanvasOn();
        sendResponse({confirm:'canvas turned on'});

    // Initialize toggle status for popup button
    } else if ( request.getStatus === true ){
      sendResponse({status:toggle});
    } else if ( request.getHighlighterStatus === true){
      sendResponse({status:highlighter});
    } else if ( request.toggleHighlighterStatus === true){
      if(highlighter === true)
        highlighter = false;
      else
        highlighter = true;
      
      sendResponse({status:highlighter});
    } else if (request.canvasData) { // new Canvas data
      onCanvasData(request.site, request.user, request.data);
    } else if (request.erase){
      eraseUserCanvas();
    } else if (request.changeColor){
      lineColor = request.changeColor;
    } else if (request.image){
      getCurrentUser(function(user){
        var userCanvas = $('.'+ user);
        addOneTimeClickEvent(userCanvas, addImage, request.image);
      });
    }
  }
);

// Register for data for the site
chrome.runtime.sendMessage({action: 'startSiteData', site: tabUrl});

// Unregister for data for the site
$(window).unload(function (){
  chrome.runtime.sendMessage({action: 'stopSiteData', site: tabUrl});
});
