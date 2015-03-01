/*
msc {
  hscale="1.2";

  html [label="index.html", textbgcolor="#ddf"]
, ui [label="mscgenui.js"]
, msc [label="mscparser.js"]

, render [label="mscrender.js"]
, utls [label="mscrenderutensils.js"]
, doc [label="window.document", textbgcolor="#ddf"];


  html => ui [label="render"];
  ui =>> doc [label="get input from textarea"];
  doc >> ui [label="text"];
  ui =>> msc [label="parse(text)"];

  --- [label="[hunky dory]", linecolor="green"];
  ui << msc [label="AST"];
  ui => render [label="renderAST(AST, text)"];
  render => utls [label="low level helpers"];
  utls => doc [label="all kinds of dom manipulation"];
  render => doc [label="all kinds of dom manipulation"];
  render note render [label="move dom manipulation down?"];

  --- [label="[parse error]", linecolor="red"];
  ui << msc [label="exception"];
  ui =>> ui [label="show error"];

  ui =>> html [label="show error"];

  |||;
  ui note msc [label="There's a parser for mscgen and a separate one for ms genny.\nFor simplicity only showning one.", textbgcolor="#ffe"];
}
*/

/* jshint browser:true */
/* jshint unused:true */
/* global define */

define(["../parse/xuparser", "../parse/msgennyparser", "../render/graphics/renderast",
        "../render/text/ast2msgenny", "../render/text/ast2xu",
        "../utl/gaga", "../render/text/textutensils", "../render/text/colorize",
        "../utl/paramslikker",
        "../../lib/codemirror/lib/codemirror",
        "../utl/domquery",
        "../../lib/codemirror/addon/edit/closebrackets",
        "../../lib/codemirror/addon/edit/matchbrackets",
        "../../lib/codemirror/addon/display/placeholder",
        "../../lib/codemirror/mode/mscgen/mscgen",
        "../../lib/canvg/StackBlur",
        "../../lib/canvg/rgbcolor"
        ],
        function(mscparser, msgennyparser, msc_render,
            tomsgenny, tomscgen,
            gaga, txt, colorize,
            params,
            codemirror,
            dq
        ) {
"use strict";

var gAutoRender = true;
var gLanguage = "mscgen";
var gGaKeyCount = 0;
var gDebug = false;

var gCodeMirror =
    codemirror.fromTextArea(window.__msc_input, {
        lineNumbers       : true,
        autoCloseBrackets : true,
        matchBrackets     : true,
        theme             : "midnight",
        mode              : "xu",
        placeholder       : "Type your text (mscgen syntax or ms genny). Or drag a file to this area....",
        lineWrapping      : false
    });

var gErrorCoordinates = {
    line : 0,
    column : 0
  };

setupEditorEvents(gCodeMirror);
initializeUI(params.getParams (window.location.search));

function setupEditorEvents(pCodeMirror){
  pCodeMirror.on ("change",
      function() {
          msc_inputKeyup(getSource(), getLanguage());
          if (gGaKeyCount > 17) {
              gGaKeyCount = 0;
              gaga.g('send', 'event', '17 characters typed', getLanguage());
          } else {
              gGaKeyCount++;
          }
  });

  pCodeMirror.on ("drop",
      function(pUnused, pEvent) {
          /* if there is a file in the drop event clear the textarea,
           * otherwise do default handling for drop events (whatever it is)
           */
          if (pEvent.dataTransfer.files.length > 0) {
              setLanguage(txt.classifyExtension(pEvent.dataTransfer.files[0].name));
              setSource("");
              gaga.g('send', 'event', 'drop', gLanguage);
          }
  });
}

function initializeUI(pParams) {
    showAutorenderState (gAutoRender);
    showLanguageState (getSource(), getLanguage(), gAutoRender);
    render(getSource(), getLanguage());
    if (undefined === pParams.msc) {
        setSample();
    }
    if (window.__loading) {
        window.__loading.outerHTML = "";
    }
}

function msc_inputKeyup () {
    if (gAutoRender) {
        render(getSource(), getLanguage());
    }
}

function renderOnClick () {
    render(getSource(), getLanguage());
}

function autorenderOnClick () {
    gAutoRender = !gAutoRender;
    if (gAutoRender) {
        render (getSource(), getLanguage());
    }
    showAutorenderState (gAutoRender);
}

function getAST(pLanguage) {
    var lAST = {};
    var lLanguage = pLanguage ? pLanguage: getLanguage();
    if ("msgenny" === lLanguage) {
        lAST = msgennyparser.parse(getSource());
    } else if ("json" === lLanguage) {
        lAST = JSON.parse(getSource());
    } else { // we use the xu parser for both mscgen and xu
        lAST = mscparser.parse(getSource());
    }
    return lAST;
}

function switchLanguageOnClick (pLanguage) {
    var lPreviousLanguage = getLanguage();
    var lAST = {};
    var lTargetSource = "";
    try {
        lAST = getAST(lPreviousLanguage);
        if (lAST !== {}){
            lTargetSource = renderSource(lAST, pLanguage);
            setSource(lTargetSource);
        }
    } catch(e) {
        // do nothing
    }
    setLanguage(pLanguage);
    showLanguageState (lTargetSource, pLanguage, gAutoRender);
}

function clearOnClick(){
    if ("msgenny" === getLanguage()){
        setSource("");
    } else if ("json" === getLanguage()){
        setSource("");
    } else /* language == mscgen or xu */{
        setSource("msc{\n  \n}");
        setCursorInSource(1,3);
    }
}

function colorizeOnClick() {
    var lAST = {};

    try {
        lAST = getAST();

        if (lAST !== {}){
            lAST = colorize.colorize(lAST, false);
            setSource(renderSource(lAST, getLanguage()));
        }
    } catch(e) {
        // do nothing
    }
}

function unColorizeOnClick(){
    var lAST = {};

    try {
        lAST = getAST();

        if (lAST !== {}){
            lAST = colorize.uncolor(lAST);
            setSource(renderSource(lAST, getLanguage()));
        }
    } catch(e) {
        // do nothing
    }
}

function errorOnClick(){
    setCursorInSource(gErrorCoordinates.line -1, gErrorCoordinates.column -1);
}

function renderSource(pAST, pLanguage){
    var lTargetSource = "";

    if ("msgenny" === pLanguage){
        lTargetSource = tomsgenny.render(pAST);
    } else if ("json" === pLanguage){
        lTargetSource = JSON.stringify(pAST, null, "  ");
    } else { // for rendering mscgen we use the xu renderer
        lTargetSource = tomscgen.render(pAST);
    }
    return lTargetSource;
}


function setSource(pSource){
    gCodeMirror.setValue(pSource);
}

function getSource(){
    return gCodeMirror.getValue();
}

function setCursorInSource(pLine, pColumn){
    gCodeMirror.setCursor(pLine, pColumn);
    gCodeMirror.focus();
}

function setLanguage (pLanguage){
    gLanguage = pLanguage;
    if ("mscgen" === pLanguage){
        gCodeMirror.setOption("mode", "xu");
    } else {
        gCodeMirror.setOption("mode", pLanguage);
    }
    showLanguageState(getSource(), pLanguage, gAutoRender);
}

function getLanguage(){
    return gLanguage;
}

function setDebug(pDebug){
    gDebug = pDebug;
}

function setSample(pURL) {
    if ("none" === pURL || null === pURL || undefined === pURL){
        clearOnClick();
    } else {
        dq.ajax (pURL, function(pEvent){
            setLanguage(txt.classifyExtension(pURL));
            setSource(pEvent.target.response);
        });
    }
}

function render(pSource, pLanguage) {
    try {
        var lAST = {};
        hideError();
        dq.SS(window.__output_buttons).hide();
        msc_render.clean("__svg", window);
        lAST = getAST(pLanguage);
        msc_render.renderAST(lAST, pSource, "__svg", window);
        if (lAST.entities.length > 0) {
            dq.SS(window.__output_buttons).show();
        }
    } catch (e) {
        if (e.line !== undefined && e.column !== undefined) {
            gErrorCoordinates.line = e.line;
            gErrorCoordinates.column = e.column;
            displayError(
             "Line " + e.line + ", column " + e.column + ": " + e.message,
              ">>> " + pSource.split('\n')[e.line - 1] + " <<<");
        } else {
            gErrorCoordinates.line = 0;
            gErrorCoordinates.column = 0;
            displayError(e.message);
        }
    }
}

function showAutorenderState (pAutoRender) {
    if (pAutoRender) {
        window.__autorender.checked = true;
        dq.SS(window.__btn_render).hide();
    } else {
        window.__autorender.checked = false;
        dq.SS(window.__btn_render).show();
    }
}

function showLanguageState (pSource, pLanguage, pAutoRender) {
    if ("msgenny" === pLanguage) {
        window.__language_mscgen.checked = false;
        window.__language_msgenny.checked = true;
        window.__language_json.checked = false;
        dq.SS(window.__btn_colorize).hide();
        dq.SS(window.__btn_uncolorize).hide();
    } else if ("json" === pLanguage){
        window.__language_mscgen.checked = false;
        window.__language_msgenny.checked = false;
        window.__language_json.checked = true;
        dq.SS(window.__btn_colorize).show();
        dq.SS(window.__btn_uncolorize).show();
    } else /* "mscgen" === pLanguage || "xu" === pLanguage */{
        window.__language_mscgen.checked = true;
        window.__language_msgenny.checked = false;
        window.__language_json.checked = false;
        dq.SS(window.__btn_colorize).show();
        dq.SS(window.__btn_uncolorize).show();
    }
    if (pAutoRender) {
        render (pSource, pLanguage);
    }
}

function hideError () {
    dq.SS(window.__error).hide();
    window.__error_output.textContent = "";
    window.__error_context.textContent = "";
}

function displayError (pError, pContext) {
    dq.SS(window.__error).show();
    window.__error_output.textContent = pError;
    window.__error_context.textContent = pContext;
}

    return {
        autorenderOnClick: autorenderOnClick,
        switchLanguageOnClick: switchLanguageOnClick,
        colorizeOnClick: colorizeOnClick,
        unColorizeOnClick: unColorizeOnClick,
        renderOnClick: renderOnClick,
        setSample: setSample,

        errorOnClick: errorOnClick,

        getSource: getSource,
        setSource: setSource,
        getLanguage: getLanguage,
        setLanguage: setLanguage,
        getAST: getAST,
        setDebug: setDebug,
    };
}); // define
/*
 This file is part of mscgen_js.

 mscgen_js is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 mscgen_js is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with mscgen_js.  If not, see <http://www.gnu.org/licenses/>.
 */
