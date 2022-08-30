import { appkey } from "./appkey.json";

let canvas; // refenrence to canvas element
let ctx; //reference to context
let dragging = false;
let strokeColor = "black";
let canvasWidth = 600;
let canvasHeight = 300;
let lineWidth = canvasHeight / 200;
let isDrawing = true;

let strokeX = [];
let strokeY = [];
let strokesX = [];
let strokesY = [];
let removedStrokesX = [];
let removedStrokesY = [];
let strokesJSON = {};

let operationHistory = [];
let operationHistoryRedo = [];

let app_token = "";
let app_token_expires_at;
let session_id;

let latex_type;

class Position {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

let loc = new Position(0, 0);
let newLocation = new Position(0, 0);

function setupCanvas() {
  canvas = document.getElementById("my-canvas");
  ctx = canvas.getContext("2d");
  ctx.strokeColor = strokeColor;
  ctx.lineWidth = lineWidth;
  canvas.addEventListener("mousedown", MouseDown);
  canvas.addEventListener("mousemove", MouseMove);
  canvas.addEventListener("mouseup", MouseUp);
  GetAppToken();
}

function GetMousePosition(x, y) {
  let canvasSizeData = canvas.getBoundingClientRect();
  return {
    x: (x - canvasSizeData.left) * (canvas.width / canvasSizeData.width),
    y: (y - canvasSizeData.top) * (canvas.height / canvasSizeData.height),
  };
}

function MouseDown(event) {
  canvas.style.cursor = "crosshair";
  /*
  let rect = canvas.getBoundingClientRect(),
    scaleX = canvas.width / rect.width,
    scaleY = canvas.height / rect.height;

  loc.x = (event.clientX - rect.left) * scaleX;
  loc.y = (event.clientY - rect.top) * scaleY;
  */
  loc = GetMousePosition(event.clientX, event.clientY);
  if (loc.x > 0 && loc.x < canvasWidth && loc.y > 0 && loc.y < canvasHeight) {
    dragging = true;
    if (isDrawing) {
      AddPoint(loc.x, loc.y);
    } else {
      checkCollision();
    }
  }
}

function MouseMove(event) {
  canvas.style.cursor = "crosshair";

  if (dragging) {
    newLocation = GetMousePosition(event.clientX, event.clientY);
    if (
      newLocation.x > 0 &&
      newLocation.x < canvasWidth &&
      newLocation.y > 0 &&
      newLocation.y < canvasHeight
    ) {
      if (isDrawing) {
        AddPoint(newLocation.x, newLocation.y);
        ctx.beginPath();
        ctx.moveTo(loc.x, loc.y);
        ctx.lineTo(newLocation.x, newLocation.y);
        ctx.closePath();
        ctx.stroke();
        loc = newLocation;
      } else {
        checkCollision();
        loc = newLocation;
      }
    }
  }
}

function MouseUp(event) {
  dragging = false;
  if (isDrawing) {
    //console.log(strokeX, strokeY);
    //console.log(strokesX, strokesY);
    strokesX.push(strokeX);
    strokesY.push(strokeY);
    operationHistory.push("add");
    strokesJSON = { strokes: { x: strokesX, y: strokesY } };
    strokeX = [];
    strokeY = [];
  }
  RequestRecognition();
}

function AddPoint(x, y) {
  strokeX.push(x);
  strokeY.push(y);
}

function checkCollision() {
  for (let i = 0; i < strokesX.length; i++) {
    let tempStrokeX = strokesX[i];
    let tempStrokeY = strokesY[i];
    for (let j = 0; j < strokesX[i].length; j++) {
      if (
        tempStrokeX[j] >= loc.x - lineWidth * 3 &&
        tempStrokeX[j] <= loc.x + lineWidth * 3 &&
        tempStrokeY[j] >= loc.y - lineWidth * 3 &&
        tempStrokeY[j] <= loc.y + lineWidth * 3
      ) {
        removedStrokesX.push(strokesX[i]);
        removedStrokesY.push(strokesY[i]);
        strokesX.splice(i, 1);
        strokesY.splice(i, 1);
        operationHistory.push("remove");
        strokesJSON = { strokes: { x: strokesX, y: strokesY } };
        drawStrokes();
        return;
      }
    }
  }
}

function drawStrokes() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < strokesX.length; i++) {
    let tempStrokeX = strokesX[i];
    let tempStrokeY = strokesY[i];
    for (let j = 0; j < strokesX[i].length - 1; j++) {
      ctx.beginPath();
      ctx.moveTo(tempStrokeX[j], tempStrokeY[j]);
      ctx.lineTo(tempStrokeX[j + 1], tempStrokeY[j + 1]);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function ClearCanvas() {
  strokeX = [];
  strokeY = [];
  strokesX = [];
  strokesY = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  //console.log("clear canvas");
  document.getElementById("equation").innerHTML = "";
}

function Undo() {
  if (operationHistory.length <= 0) {
    return;
  }
  let operation = operationHistory.pop();
  if (operation == "add") {
    RemoveLastStroke();
  } else {
    RestoreLastStroke();
  }
  operationHistoryRedo.push(operation);
}

function Redo() {
  if (operationHistoryRedo.length <= 0) {
    return;
  }

  let operation = operationHistoryRedo.pop();
  if (operation == "add") {
    RestoreLastStroke();
  } else {
    RemoveLastStroke();
  }
  operationHistory.push(operation);
}

function RemoveLastStroke() {
  if (strokesX.length <= 0) {
    return;
  }
  removedStrokesX.push(strokesX.pop());
  removedStrokesY.push(strokesY.pop());
  strokesJSON = { strokes: { x: strokesX, y: strokesY } };
  drawStrokes();
  RequestRecognition();
}

function RestoreLastStroke() {
  if (removedStrokesX.length <= 0) {
    return;
  }
  strokesX.push(removedStrokesX.pop());
  strokesY.push(removedStrokesY.pop());
  strokesJSON = { strokes: { x: strokesX, y: strokesY } };
  drawStrokes();
  RequestRecognition();
}

function Cut() {
  if (isDrawing) {
    document.getElementById("cut").className = "selected";
  } else {
    document.getElementById("cut").className = "";
  }
  isDrawing = !isDrawing;
}

function GetAppToken() {
  let Hkey = ["app_key", "Content-Type"];
  let Hvalue = [appkey, "application/json"];
  let url = "https://api.mathpix.com/v3/app-tokens";
  let dataJSON = { include_strokes_session_id: true };
  let data = JSON.stringify(dataJSON);
  var xhr = new XMLHttpRequest();

  xhr.open("POST", url);

  for (let i = 0; i < Hkey.length; i++) {
    xhr.setRequestHeader(Hkey[i], Hvalue[i]);
  }

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      //console.log(xhr.status);
      let response = xhr.responseText;
      tokenJSON = JSON.parse(response);
      app_token = tokenJSON.app_token;
      app_token_expires_at = tokenJSON.app_token_expires_at;
      session_id = tokenJSON.strokes_session_id;
      console.log(tokenJSON);
    }
  };

  xhr.send(data);
}

function RequestRecognition() {
  let url = "https://api.mathpix.com/v3/strokes";
  let Hkey = ["app_token", "Content-Type"];
  let Hvalue = [app_token, "application/json"];
  let dataOptJson = {
    include_svg: true,
    include_latex: true,
    include_tsv: true,
    include_asciimath: true,
    include_mathml: true,
  };
  //let dataOpt = JSON.stringify(dataOptJson);
  let dataJSON = {
    strokes: strokesJSON,
    strokes_session_id: session_id,
    formats: ["latex_styled", "data"],
    data_options: {
      include_asciimath: true,
      include_mathml: true,
      include_latex: true,
    },
    include_line_data: true,
  };
  let data = JSON.stringify(dataJSON);
  console.log(data);
  var xhr = new XMLHttpRequest();

  xhr.open("POST", url);

  for (let i = 0; i < Hkey.length; i++) {
    xhr.setRequestHeader(Hkey[i], Hvalue[i]);
  }

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      //console.log(xhr.status);
      let response = xhr.responseText;
      let result = JSON.parse(response);
      console.log(result);
      //result = JSON.parse(result.data);
      //console.log(result);
      let resultText = result.latex_styled;
      let element = document.getElementById("equation");
      katex.render(resultText, element, {
        throwOnError: false,
      });
      //console.log(resultText);
    } else if (xhr.status === 401) {
      GetAppToken();
      RequestRecognition();
    }
  };

  xhr.send(data);
}

document.addEventListener("DOMContentLoaded", setupCanvas);
