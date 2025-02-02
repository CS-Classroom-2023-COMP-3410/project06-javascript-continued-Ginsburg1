/****************************************************
 * script.js - Vanilla JS Chess with:
 * - Clocks
 * - Light/Dark Mode
 * - Move Table (White & Black in one row)
 * - Highlight-Only-Safe-Moves
 * - "Help" Button: naive best-move highlight in green
 ****************************************************/

let board = [];                 
let selectedSquare = null;      
let currentTurn = 'W';          
let gameOver = false;
const ROWS = 8;
const COLS = 8;

/* == Clock Variables == */
let whiteTimeLeft = 300; // 5 minutes
let blackTimeLeft = 300;
let clockInterval = null;
let activeColor = 'W';   

/* == Move Table Data == */
let movesData = [];
let currentMoveNumber = 1;

/* Piece->Unicode mapping */
const pieceToUnicode = {
  'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔',
  'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
  '.': ''
};

/* Basic piece values for naive evaluation */
const pieceValue = {
  'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 100,
  'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 100,
  '.': 0
};

/* Standard chess initial layout */
const initialLayout = [
  ['r','n','b','q','k','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  ['.','.','.','.','.','.','.','.'],
  ['.','.','.','.','.','.','.','.'],
  ['.','.','.','.','.','.','.','.'],
  ['.','.','.','.','.','.','.','.'],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R']
];

// On load
window.onload = function() {
  createBoardHTML();

  document.getElementById('setTimeBtn').addEventListener('click', setTimeAndStart);
  document.getElementById('resetBtn').addEventListener('click', resetGame);
  document.getElementById('toggleThemeBtn').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
  });

  // New: Help button
  document.getElementById('helpBtn').addEventListener('click', showBestMove);
};

// =============== Board Creation ===============
function createBoardHTML() {
  const chessboardDiv = document.getElementById('chessboard');
  chessboardDiv.innerHTML = '';

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      let squareDiv = document.createElement('div');
      squareDiv.classList.add('square');
      if ((row + col) % 2 === 0) squareDiv.classList.add('light');
      else squareDiv.classList.add('dark');

      squareDiv.dataset.row = row;
      squareDiv.dataset.col = col;
      squareDiv.addEventListener('click', onSquareClick);

      chessboardDiv.appendChild(squareDiv);
    }
  }
}

// =============== Game Setup/Reset ===============
function setTimeAndStart() {
  let minutes = parseInt(document.getElementById('timeInput').value, 10);
  if (isNaN(minutes) || minutes < 1) minutes = 5;

  whiteTimeLeft = minutes * 60;
  blackTimeLeft = minutes * 60;

  initGame();
  startClock();
}

function initGame() {
  board = initialLayout.map(row => row.slice());
  currentTurn = 'W';
  gameOver = false;
  selectedSquare = null;

  movesData = [];
  currentMoveNumber = 1;
  renderMovesTable();

  updateBoardUI();
  updateStatus('');

  activeColor = 'W';  
  updateClockDisplay();
}

function resetGame() {
  stopClock();
  initGame();
}

// =============== Clock Logic ===============
function startClock() {
  stopClock();
  clockInterval = setInterval(tickClock, 1000);
}
function stopClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}
function tickClock() {
  if (gameOver) {
    stopClock();
    return;
  }
  if (activeColor === 'W') {
    whiteTimeLeft--;
    if (whiteTimeLeft <= 0) {
      whiteTimeLeft = 0;
      gameOver = true;
      updateStatus('White ran out of time! Black wins.');
      stopClock();
    }
  } else {
    blackTimeLeft--;
    if (blackTimeLeft <= 0) {
      blackTimeLeft = 0;
      gameOver = true;
      updateStatus('Black ran out of time! White wins.');
      stopClock();
    }
  }
  updateClockDisplay();
}
function updateClockDisplay() {
  document.getElementById('whiteClock').textContent = formatTime(whiteTimeLeft);
  document.getElementById('blackClock').textContent = formatTime(blackTimeLeft);
}
function formatTime(sec) {
  let m = Math.floor(sec / 60), s = sec % 60;
  let mm = (m<10)? '0'+m : m;
  let ss = (s<10)? '0'+s : s;
  return mm + ':' + ss;
}

// =============== Board Interaction ===============
function onSquareClick(e) {
  if (gameOver) return;
  const row = +e.currentTarget.dataset.row;
  const col = +e.currentTarget.dataset.col;

  if (!selectedSquare) {
    if (!isEmptySquare(row, col)) {
      const piece = board[row][col];
      if (isCorrectTurnPiece(piece)) {
        selectedSquare = { row, col };
        highlightSelectedSquare(row, col);
      }
    }
  } else {
    // Attempt a move
    const fromRow = selectedSquare.row;
    const fromCol = selectedSquare.col;
    if (tryMove(fromRow, fromCol, row, col)) {
      // Switch turn
      currentTurn = (currentTurn === 'W') ? 'B' : 'W';
      activeColor = currentTurn;
      updateBoardUI();
    }
    selectedSquare = null;
    clearHighlights();
  }
}

// Attempt to move from (r1,c1) to (r2,c2).
function tryMove(r1, c1, r2, c2) {
  if (gameOver) return false;
  const moves = generateValidMoves(r1, c1, board);

  // Must be in possible moves
  if (!moves.some(m => m.r === r2 && m.c === c2)) {
    updateStatus('Invalid move!');
    return false;
  }

  // Check king safety
  let testBoard = copyBoard(board);
  let piece = testBoard[r1][c1];
  testBoard[r2][c2] = piece;
  testBoard[r1][c1] = '.';
  if (piece === 'P' && r2 === 0) testBoard[r2][c2] = 'Q';
  if (piece === 'p' && r2 === 7) testBoard[r2][c2] = 'q';

  if (kingInCheck(currentTurn, testBoard)) {
    updateStatus("Can't move into check!");
    return false;
  }

  // Perform the real move
  const captured = board[r2][c2];
  board[r2][c2] = board[r1][c1];
  board[r1][c1] = '.';
  if (piece === 'P' && r2 === 0) board[r2][c2] = 'Q';
  if (piece === 'p' && r2 === 7) board[r2][c2] = 'q';

  updateBoardUI();
  recordMove(r1, c1, r2, c2, captured);

  // Check for checkmate/stalemate
  let oppColor = (currentTurn === 'W') ? 'B' : 'W';
  if (kingInCheck(oppColor, board)) {
    if (noMovesAvailable(oppColor, board)) {
      updateStatus('Checkmate! ' + colorName(currentTurn) + ' wins!');
      gameOver = true;
      stopClock();
    } else {
      updateStatus(colorName(oppColor) + ' is in check!');
    }
  } else {
    if (noMovesAvailable(oppColor, board)) {
      updateStatus('Stalemate! Draw!');
      gameOver = true;
      stopClock();
    } else {
      updateStatus('');
    }
  }
  return true;
}

// Highlight only squares that don't leave your king in check
function highlightSelectedSquare(r, c) {
  clearHighlights();
  const squares = document.querySelectorAll('.square');
  let idx = r * 8 + c;
  squares[idx].classList.add('selected');

  let rawMoves = generateValidMoves(r, c, board);

  // Filter out moves that leave you in check
  let safeMoves = [];
  for (let mv of rawMoves) {
    let temp = copyBoard(board);
    let piece = temp[r][c];
    temp[mv.r][mv.c] = piece;
    temp[r][c] = '.';

    if (piece === 'P' && mv.r === 0) temp[mv.r][mv.c] = 'Q';
    if (piece === 'p' && mv.r === 7) temp[mv.r][mv.c] = 'q';

    if (!kingInCheck(currentTurn, temp)) {
      safeMoves.push(mv);
    }
  }

  for (let sm of safeMoves) {
    let highlightIdx = sm.r * 8 + sm.c;
    squares[highlightIdx].classList.add('highlight');
  }
}

function clearHighlights() {
  document.querySelectorAll('.square').forEach(sq => {
    sq.classList.remove('selected','highlight','help-move');
  });
}

// =============== The "Help" Button Logic ===============
function showBestMove() {
  if (gameOver) {
    updateStatus('Game is over! No help available.');
    return;
  }

  // Clear old highlights (including any old "help-move")
  clearHighlights();

  // Gather all "safe" moves for the current side
  let allSafeMoves = getAllSafeMovesForCurrentPlayer();

  if (allSafeMoves.length === 0) {
    updateStatus('No moves available.');
    return;
  }

  // Evaluate each move with a naive 1-ply material difference
  // We'll pick the maximum difference if White, or minimum if Black
  let bestMove = null;
  let bestEval = (currentTurn === 'W') ? -Infinity : +Infinity;

  for (let {fromR, fromC, toR, toC} of allSafeMoves) {
    // Make a copy, do the move
    let testBoard = copyBoard(board);
    let piece = testBoard[fromR][fromC];
    let captured = testBoard[toR][toC];
    testBoard[toR][toC] = piece;
    testBoard[fromR][fromC] = '.';

    // Pawn promotion
    if (piece === 'P' && toR === 0) testBoard[toR][toC] = 'Q';
    if (piece === 'p' && toR === 7) testBoard[toR][toC] = 'q';

    // Evaluate
    let evalScore = evaluateBoard(testBoard);

    if (currentTurn === 'W') {
      // White wants to maximize
      if (evalScore > bestEval) {
        bestEval = evalScore;
        bestMove = {fromR, fromC, toR, toC};
      }
    } else {
      // Black wants to minimize
      if (evalScore < bestEval) {
        bestEval = evalScore;
        bestMove = {fromR, fromC, toR, toC};
      }
    }
  }

  // Highlight the best move squares in green
  if (bestMove) {
    const squares = document.querySelectorAll('.square');

    let fromIndex = bestMove.fromR * 8 + bestMove.fromC;
    let toIndex   = bestMove.toR   * 8 + bestMove.toC;

    squares[fromIndex].classList.add('help-move');
    squares[toIndex].classList.add('help-move');

    updateStatus('Suggested move: ' + 
      toAlgebraic(bestMove.fromR,bestMove.fromC) + 
      ' -> ' + 
      toAlgebraic(bestMove.toR,bestMove.toC)
    );
  }
}

// Returns array of all "safe" moves for the current player
function getAllSafeMovesForCurrentPlayer() {
  let color = currentTurn;
  let safeMoves = [];

  // For each piece of `color` on the board, generate valid moves
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      let p = board[r][c];
      if (p !== '.' &&
          ((color === 'W' && isWhitePiece(p)) ||
           (color === 'B' && isBlackPiece(p)))) 
      {
        let rawMoves = generateValidMoves(r, c, board);
        // Filter out ones leaving the king in check
        for (let mv of rawMoves) {
          let testBoard = copyBoard(board);
          let piece = testBoard[r][c];
          testBoard[mv.r][mv.c] = piece;
          testBoard[r][c] = '.';

          if (piece === 'P' && mv.r === 0) testBoard[mv.r][mv.c] = 'Q';
          if (piece === 'p' && mv.r === 7) testBoard[mv.r][mv.c] = 'q';

          if (!kingInCheck(color, testBoard)) {
            safeMoves.push({
              fromR: r, fromC: c,
              toR: mv.r, toC: mv.c
            });
          }
        }
      }
    }
  }

  return safeMoves;
}

// A naive board evaluation from White's perspective
function evaluateBoard(testBoard) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      let p = testBoard[r][c];
      if (p !== '.') {
        // White piece => add value
        // Black piece => subtract value
        if (isWhitePiece(p)) {
          score += pieceValue[p];
        } else {
          score -= pieceValue[p];
        }
      }
    }
  }
  return score;
}

// =============== Move Table (White & Black) ===============
function recordMove(r1, c1, r2, c2, capturedPiece) {
  let fromAlg = toAlgebraic(r1, c1);
  let toAlg   = toAlgebraic(r2, c2);
  let sep     = (capturedPiece !== '.') ? 'x' : '-';
  let notation = fromAlg + sep + toAlg;

  if (currentTurn === 'W') {
    movesData.push({
      moveNum: currentMoveNumber,
      white: notation,
      black: ''
    });
  } else {
    let last = movesData[movesData.length - 1];
    if (!last) {
      movesData.push({
        moveNum: currentMoveNumber,
        white: '',
        black: notation
      });
    } else {
      last.black = notation;
    }
    currentMoveNumber++;
  }
  renderMovesTable();
}

function renderMovesTable() {
  const tbody = document.querySelector('#moveTable tbody');
  tbody.innerHTML = '';

  for (let entry of movesData) {
    let tr = document.createElement('tr');

    let tdNum   = document.createElement('td');
    tdNum.textContent = entry.moveNum;

    let tdWhite = document.createElement('td');
    tdWhite.textContent = entry.white;

    let tdBlack = document.createElement('td');
    tdBlack.textContent = entry.black;

    tr.append(tdNum, tdWhite, tdBlack);
    tbody.appendChild(tr);
  }
  const container = document.getElementById('moveTableContainer');
  if (container) container.scrollTop = container.scrollHeight;
}

// =============== Utilities ===============
function toAlgebraic(r, c) {
  const file = 'abcdefgh'[c];
  const rank = 8 - r;
  return file + rank;
}

function generateValidMoves(r, c, curBoard) {
  const piece = curBoard[r][c];
  if (piece === '.') return [];

  let moves = [];
  switch(piece.toLowerCase()) {
    case 'p': moves = pawnMoves(r,c,curBoard); break;
    case 'r': moves = rookMoves(r,c,curBoard); break;
    case 'n': moves = knightMoves(r,c,curBoard); break;
    case 'b': moves = bishopMoves(r,c,curBoard); break;
    case 'q': moves = queenMoves(r,c,curBoard); break;
    case 'k': moves = kingMoves(r,c,curBoard); break;
  }
  // Filter out capturing same color
  return moves.filter(m => !sameColor(piece, curBoard[m.r][m.c]));
}

// Pawn
function pawnMoves(r,c,cb){
  const piece=cb[r][c];
  let direction=isWhitePiece(piece)?-1:1;
  let moves=[];
  let f1=r+direction;
  // forward
  if(inBounds(f1,c)&&cb[f1][c]==='.'){
    moves.push({r:f1,c});
    if(isWhitePiece(piece)&&r===6&&cb[r-2][c]==='.'){
      moves.push({r:r-2,c});
    }
    if(isBlackPiece(piece)&&r===1&&cb[r+2][c]==='.'){
      moves.push({r:r+2,c});
    }
  }
  [c-1,c+1].forEach(cc=>{
    if(inBounds(f1,cc)&&!isEmptySquare(f1,cc,cb)){
      if(!sameColor(piece,cb[f1][cc])) moves.push({r:f1,c:cc});
    }
  });
  return moves;
}

// Rook
function rookMoves(r,c,cb){
  let moves=[];
  // up
  for(let i=r-1;i>=0;i--){
    moves.push({r:i,c});
    if(!isEmptySquare(i,c,cb))break;
  }
  // down
  for(let i=r+1;i<8;i++){
    moves.push({r:i,c});
    if(!isEmptySquare(i,c,cb))break;
  }
  // left
  for(let j=c-1;j>=0;j--){
    moves.push({r,c:j});
    if(!isEmptySquare(r,j,cb))break;
  }
  // right
  for(let j=c+1;j<8;j++){
    moves.push({r,c:j});
    if(!isEmptySquare(r,j,cb))break;
  }
  return moves;
}

// Knight
function knightMoves(r,c,cb){
  let offsets=[
    [-2,-1],[-2,1],[-1,-2],[-1,2],
    [1,-2],[1,2],[2,-1],[2,1]
  ];
  let moves=[];
  for(let [dr,dc]of offsets){
    let nr=r+dr,nc=c+dc;
    if(inBounds(nr,nc)) moves.push({r:nr,c:nc});
  }
  return moves;
}

// Bishop
function bishopMoves(r,c,cb){
  let moves=[];
  // up-left
  {let i=r-1,j=c-1;while(inBounds(i,j)){moves.push({r:i,c:j});if(!isEmptySquare(i,j,cb))break;i--;j--;}}
  // up-right
  {let i=r-1,j=c+1;while(inBounds(i,j)){moves.push({r:i,c:j});if(!isEmptySquare(i,j,cb))break;i--;j++;}}
  // down-left
  {let i=r+1,j=c-1;while(inBounds(i,j)){moves.push({r:i,c:j});if(!isEmptySquare(i,j,cb))break;i++;j--;}}
  // down-right
  {let i=r+1,j=c+1;while(inBounds(i,j)){moves.push({r:i,c:j});if(!isEmptySquare(i,j,cb))break;i++;j++;}}
  return moves;
}

// Queen = Rook + Bishop
function queenMoves(r,c,cb){
  return rookMoves(r,c,cb).concat(bishopMoves(r,c,cb));
}

// King
function kingMoves(r,c,cb){
  let moves=[];
  for(let dr=-1;dr<=1;dr++){
    for(let dc=-1;dc<=1;dc++){
      if(dr===0&&dc===0)continue;
      let nr=r+dr,nc=c+dc;
      if(inBounds(nr,nc)) moves.push({r:nr,c:nc});
    }
  }
  return moves;
}

/* Utility */
function inBounds(r,c){return r>=0&&r<8&&c>=0&&c<8;}
function isEmptySquare(r,c,b=board){return b[r][c]==='.';}
function isWhitePiece(p){return(p>='A'&&p<='Z');}
function isBlackPiece(p){return(p>='a'&&p<='z');}
function sameColor(p1,p2){
  if(p1==='.'||p2==='.')return false;
  return(isWhitePiece(p1)&&isWhitePiece(p2))||
         (isBlackPiece(p1)&&isBlackPiece(p2));
}
function isCorrectTurnPiece(piece){
  return piece!=='.' && (
    (currentTurn==='W'&&isWhitePiece(piece))||
    (currentTurn==='B'&&isBlackPiece(piece))
  );
}
function copyBoard(src){return src.map(r=>r.slice());}
function updateBoardUI(){
  const squares=document.querySelectorAll('.square');
  for(let i=0;i<squares.length;i++){
    let row=Math.floor(i/8),col=i%8;
    squares[i].textContent=pieceToUnicode[board[row][col]];
  }
  document.getElementById('turnDisplay').textContent=colorName(currentTurn);
}
function updateStatus(msg){
  document.getElementById('status').textContent=msg;
}

// Check if color's king is in check
function kingInCheck(color,testBoard){
  let kingChar=(color==='W')?'K':'k';
  let kingPos=null;
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      if(testBoard[r][c]===kingChar){
        kingPos={r,c};
        break;
      }
    }
    if(kingPos)break;
  }
  if(!kingPos)return false; 

  // If any enemy piece can capture that pos => check
  for(let rr=0;rr<8;rr++){
    for(let cc=0;cc<8;cc++){
      let p=testBoard[rr][cc];
      if(p==='.')continue;
      if((color==='W'&&isBlackPiece(p))||
         (color==='B'&&isWhitePiece(p))){
        let moves=generateValidMoves(rr,cc,testBoard);
        if(moves.some(m=>m.r===kingPos.r&&m.c===kingPos.c)){
          return true;
        }
      }
    }
  }
  return false;
}

// If no valid safe moves for color => checkmate/stalemate
function noMovesAvailable(color,testBoard){
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      let p=testBoard[r][c];
      if(p==='.')continue;
      if((color==='W'&&isWhitePiece(p))||
         (color==='B'&&isBlackPiece(p))){
        let pm=generateValidMoves(r,c,testBoard);
        for(let m of pm){
          let tmp=copyBoard(testBoard);
          tmp[m.r][m.c]=tmp[r][c];
          tmp[r][c]='.';
          if(!kingInCheck(color,tmp)) return false;
        }
      }
    }
  }
  return true;
}
function colorName(turn){return turn==='W'?'White':'Black';}
