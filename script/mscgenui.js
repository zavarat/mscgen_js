/*
msc {
  html [label="index.html"]
, ui [label="mscgenui.js"]
, msc [label="mscparser.js"]
, render [label="mscrender.js"]
, doc [label="window.document"];

  |||;
  html => ui [label="render"];
  ui =>> doc [label="get input from textarea"];
  doc >> ui [label="text"];
  ui =>> msc [label="parse(text)"];
  --- [label="okiedokie"];
  ui << msc [label="parseTree"];
  ui => render [label="renderParseTree(parseTree)"];
  render => doc [label="all kinds of domdocument stuff"];
  
  --- [label="parse error"];
  ui << msc [label="exception"];

}
*/

define(["log", "msc", "mscrender", "jquery"],
        function(log, msc_parse, msc_render, $) {

var gAutoRender = true;

$(document).ready(function(){
    showAutorenderState ();
    render();
    $("#autorender").bind({
        click : function(e) {
                    autorenderOnClick();
                }
    });
    $("#render").bind({
        click : function(e) {
                    renderOnClick();
                }
    });
    $("#msc_input").bind({
        keyup : function(e) {
                    msc_inputKeyup();
                }
    });
}); // document ready

function msc_inputKeyup () {
    if (gAutoRender) {
        render();
    }
}

function renderOnClick () {
    render();
}

function autorenderOnClick () {
    gAutoRender = !gAutoRender;
    if (gAutoRender) {
        render ();
    }
    showAutorenderState ();
}

function showAutorenderState () {
    if (gAutoRender) {
        $("#autorender").attr("checked", "autorenderOn");
    } else {
        $("#autorender").removeAttr ("checked", "autorenderOn");
    }
}

function render() {
    try {
        hideError();
        var lParseTree = mscparser.parse($("#msc_input").val());
        msc_render.clean();
        msc_render.renderParseTree(lParseTree);

    } catch (e) {
        displayError(
            e.line !== undefined && e.column !== undefined
        ? "Line " + e.line + ", column " + e.column + ": " + e.message
        : e.message);
    }
}

function clean() {
    var lDefTag = document.getElementsByTagNameNS(SVGNS, "defs")[0];
    var lBody = document.getElementById("body");
    var lOldDefs = document.getElementById("defs");
    var lOldSequence = document.getElementById("sequence");
    var lNewDefs = createGroup("defs");
    var lNewSequence = createGroup("sequence");
    lBody.replaceChild(lNewSequence, lOldSequence);
    lDefTag.replaceChild(lNewDefs, lOldDefs);

}

function hideError () {
    $("#error_output").hide();
}

function displayError (pString) {
    $("#error_output").show();
    $("#error_output").text(pString);
}

}); // define